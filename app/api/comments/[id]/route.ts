import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Toggle a comment's resolved state. RLS ("owners manage comments on their shares",
 * migration 005) is what actually restricts this to the project owner — not an
 * app-level check here, same pattern as the public POST route relying on RLS.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  if (typeof body.resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved must be a boolean' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('comments')
    .update({ resolved: body.resolved })
    .eq('id', params.id)
    .select('id, resolved')
    .single();

  // RLS silently returns no row (not an error) when the caller isn't the owner —
  // surface that as 404 rather than a misleading 200 with nothing changed.
  if (error || !data) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
