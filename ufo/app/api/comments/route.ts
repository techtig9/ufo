import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// No auth required — RLS policy "anyone can add a comment on a public
// share" is what actually enforces that this only works for published
// shares, not an app-level check here.
export async function POST(request: Request) {
  const { shareId, screenId, authorName, body } = await request.json();

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Comment can\u2019t be empty' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('comments')
    .insert({ share_id: shareId, screen_id: screenId, author_name: authorName, body, x: 50, y: 50 })
    .select('id, author_name, body, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Could not post comment' }, { status: 500 });
  }
  return NextResponse.json(data);
}
