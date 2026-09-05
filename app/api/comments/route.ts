import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { commentSchema } from '@/lib/schemas';
import { checkAnonymousRateLimit, clientIpFrom } from '@/lib/rate-limit';
import { recordMentions, type CommentContext } from '@/lib/comment-collaboration';
import { withObservability } from '@/lib/observability';

/**
 * Post a comment on a shared prototype.
 *
 * Deliberately unauthenticated — anonymous stakeholder feedback is the point of
 * a share link, and the RLS policy "anyone can add a comment on a public share"
 * is what restricts writes to published shares.
 *
 * What RLS does NOT check is that the screen and the parent comment actually
 * belong to the share being commented on: `screen_id` is a plain column, so a
 * caller could previously attach a comment to any screen id it could guess, or
 * reparent a reply under a thread on someone else's share. Those are verified
 * here. Volume is also capped per IP, since an open write endpoint with no
 * throttle is a spam vector.
 */
async function handlePOST(request: Request) {
  const rate = await checkAnonymousRateLimit(clientIpFrom(request.headers), 'comments', 20, 600);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many comments from this connection. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds ?? 600) } }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = commentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid comment' },
      { status: 400 }
    );
  }
  const { shareId, screenId, authorName, body, x, y, parentId } = parsed.data;

  const supabase = await createClient();

  // The share must exist and be public. Reading it through the anon session
  // means RLS ("public shares are readable") governs this lookup too — which
  // since migration 010 also means an expired or password-protected share
  // returns nothing here unless the caller can genuinely see it.
  const { data: share } = await supabase
    .from('shares')
    .select('id, project_id, is_public, slug, allow_comments')
    .eq('id', shareId)
    .maybeSingle();

  if (!share || !share.is_public) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
  }

  // Commenting turned off is a real setting, not just a hidden composer: the
  // endpoint is open to anyone holding the link, so it has to be checked here
  // too or the control would be decoration.
  if (share.allow_comments === false) {
    return NextResponse.json(
      { error: 'Commenting is turned off for this prototype' },
      { status: 403 }
    );
  }

  // The screen must belong to that share's project.
  const { data: screen } = await supabase
    .from('screens')
    .select('id')
    .eq('id', screenId)
    .eq('project_id', share.project_id)
    .maybeSingle();

  if (!screen) {
    return NextResponse.json({ error: 'Screen not found on this prototype' }, { status: 404 });
  }

  // A reply's parent must be on the same share, and must itself be top level —
  // replies are one level deep by design (migration 005).
  if (parentId) {
    const { data: parent } = await supabase
      .from('comments')
      .select('id, share_id, parent_id')
      .eq('id', parentId)
      .maybeSingle();

    if (!parent || parent.share_id !== shareId) {
      return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
    }
    if (parent.parent_id) {
      return NextResponse.json({ error: 'Replies cannot be nested further' }, { status: 400 });
    }
  }

  // A signed-in commenter is attributed; an anonymous visitor stays a name.
  // Both paths are supported deliberately — anonymous stakeholder feedback is
  // the point of a share link.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('comments')
    .insert({
      share_id: shareId,
      screen_id: screenId,
      author_name: authorName,
      author_id: user?.id ?? null,
      body,
      x,
      y,
      parent_id: parentId ?? null,
    })
    .select('id, author_name, author_id, body, created_at, x, y, resolved, parent_id, assigned_to')
    .single();

  if (error || !data) {
    console.error('[comments] insert failed', error?.message);
    return NextResponse.json({ error: 'Could not post comment' }, { status: 500 });
  }

  // Mentions are resolved AFTER the insert and never block it: the comment is
  // the user's content and must be saved even if mail delivery is failing.
  // recordMentions filters every mentioned id against the project's actual
  // collaborators, so a token naming a stranger notifies nobody.
  let mentioned: string[] = [];
  try {
    const admin = createAdminClient();
    const { data: project } = await admin
      .from('projects')
      .select('id, name, user_id, workspace_id')
      .eq('id', share.project_id)
      .maybeSingle();

    if (project) {
      const context: CommentContext = {
        projectId: project.id,
        projectName: project.name,
        workspaceId: project.workspace_id,
        ownerId: project.user_id,
        shareSlug: share.slug,
      };
      mentioned = await recordMentions(data.id, body, context, {
        id: user?.id ?? null,
        name: authorName,
      });
    }
  } catch (e) {
    console.error('[comments] mention handling failed', e instanceof Error ? e.message : 'unknown');
  }

  return NextResponse.json({ ...data, mentionedCount: mentioned.length });
}

/**
 * Wrapped for observability: each request gets a correlation id (honouring an
 * upstream `x-request-id`), is timed and logged with its status, and a thrown
 * error becomes a 500 carrying only that id — never the exception's message,
 * which can contain a connection string or schema detail.
 */
export const POST = withObservability('comments', handlePOST);
