import { createAdminClient } from '@/lib/supabase/admin';
import { parseMentions, toPlainText } from '@/lib/mentions';
import { sendMentionEmail, sendCommentAssignmentEmail } from '@/lib/email';

/**
 * Server-side handling of comment mentions and assignment.
 *
 * The rule this file exists to enforce: **a mention may only ever reach someone
 * who can already see the project.** The comment endpoint is deliberately open
 * to anonymous visitors of a public share, so without this check a visitor
 * could paste an arbitrary user id into a mention token and make UFO email a
 * stranger, with attacker-chosen text, from UFO's own domain.
 *
 * So every mention is filtered against the project's workspace membership (plus
 * the project owner) before anything is written or sent. A token naming someone
 * who is not a collaborator is dropped silently — telling the author which ids
 * exist would turn this into a membership oracle.
 */

export interface CommentContext {
  projectId: string;
  projectName: string;
  workspaceId: string | null;
  ownerId: string;
  shareSlug: string | null;
}

/** Everyone allowed to be mentioned on this project: its owner plus workspace members. */
export async function collaboratorIds(context: CommentContext): Promise<Set<string>> {
  const allowed = new Set<string>([context.ownerId]);
  if (!context.workspaceId) return allowed;

  const admin = createAdminClient();
  const { data } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', context.workspaceId);

  for (const row of data ?? []) allowed.add(row.user_id);
  return allowed;
}

function commentUrl(context: CommentContext, commentId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  // Collaborators are signed in, so the editor is the right destination — it
  // shows resolved and unresolved threads, which the public view does not.
  return `${base}/dashboard/projects/${context.projectId}#comment-${commentId}`;
}

/** A short, safe preview of a comment body for an email. */
export function excerpt(body: string, limit = 240): string {
  const plain = toPlainText(body).replace(/\s+/g, ' ').trim();
  return plain.length > limit ? `${plain.slice(0, limit - 1)}…` : plain;
}

/**
 * Record the mentions in a comment body and notify the people named.
 *
 * Returns the user ids actually mentioned, so the caller can report an accurate
 * count rather than echoing back what the client claimed.
 */
export async function recordMentions(
  commentId: string,
  body: string,
  context: CommentContext,
  actor: { id: string | null; name: string }
): Promise<string[]> {
  const mentioned = parseMentions(body);
  if (mentioned.length === 0) return [];

  const allowed = await collaboratorIds(context);
  const valid = mentioned.filter((m) => allowed.has(m.userId) && m.userId !== actor.id);
  if (valid.length === 0) return [];

  const admin = createAdminClient();

  // Written service-role side: `comment_mentions` has no client write policy,
  // precisely so a mention cannot be forged into existence.
  const { error } = await admin
    .from('comment_mentions')
    .upsert(
      valid.map((m) => ({ comment_id: commentId, user_id: m.userId })),
      { onConflict: 'comment_id,user_id' }
    );

  if (error) {
    console.error('[mentions] insert failed', error.message);
    return [];
  }

  const { data: recipients } = await admin
    .from('users')
    .select('id, email, notify_collaboration_emails')
    .in('id', valid.map((m) => m.userId));

  const preview = excerpt(body);
  const url = commentUrl(context, commentId);

  await Promise.all(
    (recipients ?? [])
      .filter((r) => r.notify_collaboration_emails !== false && r.email)
      .map((r) =>
        sendMentionEmail(r.email, {
          actorName: actor.name,
          projectName: context.projectName,
          excerpt: preview,
          url,
        }).catch((e: unknown) => {
          // A comment must still post if the mail provider is down.
          console.error('[mentions] email failed', e instanceof Error ? e.message : 'unknown');
        })
      )
  );

  if (context.workspaceId) {
    await admin.from('workspace_activity').insert({
      workspace_id: context.workspaceId,
      actor_id: actor.id,
      project_id: context.projectId,
      action: 'comment.created',
      detail:
        valid.length === 1
          ? `and mentioned ${valid[0].label}`
          : `and mentioned ${valid.length} people`,
    });
  }

  return valid.map((m) => m.userId);
}

/** Notify the assignee of a comment, and record it on the workspace feed. */
export async function notifyAssignment(
  commentId: string,
  body: string,
  assigneeId: string,
  context: CommentContext,
  actor: { id: string; name: string }
): Promise<void> {
  // Assigning yourself is picking something up, not a notification.
  if (assigneeId === actor.id) return;

  const admin = createAdminClient();
  const { data: assignee } = await admin
    .from('users')
    .select('email, name, notify_collaboration_emails')
    .eq('id', assigneeId)
    .maybeSingle();

  if (assignee?.email && assignee.notify_collaboration_emails !== false) {
    await sendCommentAssignmentEmail(assignee.email, {
      actorName: actor.name,
      projectName: context.projectName,
      excerpt: excerpt(body),
      url: commentUrl(context, commentId),
    }).catch((e: unknown) => {
      console.error('[assignment] email failed', e instanceof Error ? e.message : 'unknown');
    });
  }

  if (context.workspaceId) {
    await admin.from('workspace_activity').insert({
      workspace_id: context.workspaceId,
      actor_id: actor.id,
      project_id: context.projectId,
      action: 'comment.assigned',
      detail: `to ${assignee?.name || 'a collaborator'}`,
    });
  }
}
