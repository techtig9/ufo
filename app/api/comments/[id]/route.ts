import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  collaboratorIds,
  notifyAssignment,
  type CommentContext,
} from '@/lib/comment-collaboration';

/**
 * Update a comment: resolve/unresolve it, or assign it to a collaborator.
 *
 * RLS is what actually restricts this — "owners manage comments on their
 * shares" (migration 005) plus "workspace members moderate comments"
 * (migration 011). An update by anyone else returns no row rather than an
 * error, which is why the 404 below matters: without it a forbidden write
 * would look like a successful one.
 */

const patchSchema = z
  .object({
    resolved: z.boolean().optional(),
    /** A collaborator's user id, or null to unassign. */
    assignedTo: z.string().uuid().nullable().optional(),
  })
  .refine((v) => v.resolved !== undefined || v.assignedTo !== undefined, {
    message: 'Nothing to update',
  });

/** The project behind a comment, for authorisation and notification. */
async function commentContext(commentId: string): Promise<{
  context: CommentContext;
  body: string;
  assignedTo: string | null;
} | null> {
  const admin = createAdminClient();
  const { data: comment } = await admin
    .from('comments')
    .select('id, body, assigned_to, share:shares(slug, project_id)')
    .eq('id', commentId)
    .maybeSingle();

  const share = comment?.share as unknown as { slug: string; project_id: string } | null;
  if (!comment || !share) return null;

  const { data: project } = await admin
    .from('projects')
    .select('id, name, user_id, workspace_id')
    .eq('id', share.project_id)
    .maybeSingle();

  if (!project) return null;

  return {
    context: {
      projectId: project.id,
      projectName: project.name,
      workspaceId: project.workspace_id,
      ownerId: project.user_id,
      shareSlug: share.slug,
    },
    body: comment.body,
    assignedTo: comment.assigned_to,
  };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid update' },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.resolved !== undefined) update.resolved = parsed.data.resolved;

  const details = await commentContext(params.id);
  if (!details) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

  const assignedTo = parsed.data.assignedTo;
  if (assignedTo !== undefined) {
    if (assignedTo !== null) {
      // An assignee must be a collaborator on this project. Without this an
      // authorised user could assign work to an arbitrary account and cause an
      // email to be sent to it.
      const allowed = await collaboratorIds(details.context);
      if (!allowed.has(assignedTo)) {
        return NextResponse.json(
          { error: 'You can only assign a comment to someone with access to this project' },
          { status: 400 }
        );
      }
    }
    update.assigned_to = assignedTo;
    update.assigned_by = assignedTo ? user.id : null;
    update.assigned_at = assignedTo ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('comments')
    .update(update)
    .eq('id', params.id)
    .select('id, resolved, assigned_to')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }

  // Notify only on a genuine change of assignee, so re-saving the same value
  // does not re-send. Never blocks the response.
  if (assignedTo && assignedTo !== details.assignedTo) {
    const { data: profile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .maybeSingle();

    await notifyAssignment(params.id, details.body, assignedTo, details.context, {
      id: user.id,
      name: profile?.name || profile?.email || 'A collaborator',
    }).catch((e: unknown) => {
      console.error('[comments] assignment notify failed', e instanceof Error ? e.message : 'unknown');
    });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Replies reference their parent via `parent_id` with no ON DELETE CASCADE, so deleting
  // a comment that has replies fails on the foreign key unless the replies go first.
  // (Replies are one level deep — a reply's own parent_id is always null — so this single
  // pass is sufficient, no recursion needed.) RLS still governs every row touched here: a
  // caller who doesn't own the share can delete neither the replies nor the parent.
  const { error: repliesError } = await supabase.from('comments').delete().eq('parent_id', params.id);
  if (repliesError) {
    return NextResponse.json({ error: 'Could not delete replies to this comment' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', params.id)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
