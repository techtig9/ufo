import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { commentSchema } from '@/lib/schemas';
import { checkAnonymousRateLimit, clientIpFrom } from '@/lib/rate-limit';

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
export async function POST(request: Request) {
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
  // means RLS ("public shares are readable") governs this lookup too.
  const { data: share } = await supabase
    .from('shares')
    .select('id, project_id, is_public')
    .eq('id', shareId)
    .maybeSingle();

  if (!share || !share.is_public) {
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
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

  const { data, error } = await supabase
    .from('comments')
    .insert({
      share_id: shareId,
      screen_id: screenId,
      author_name: authorName,
      body,
      x,
      y,
      parent_id: parentId ?? null,
    })
    .select('id, author_name, body, created_at, x, y, resolved, parent_id')
    .single();

  if (error || !data) {
    console.error('[comments] insert failed', error?.message);
    return NextResponse.json({ error: 'Could not post comment' }, { status: 500 });
  }
  return NextResponse.json(data);
}
