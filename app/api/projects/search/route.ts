import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Projects for the command palette.
 *
 * Read through the caller's own session, so RLS scopes it to their projects —
 * there is no path here that could list someone else's work. Capped, because
 * the palette filters client-side and a user with hundreds of projects should
 * not ship all of them to open a menu.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, archived_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[projects/search] load failed', error.message);
    return NextResponse.json({ projects: [] });
  }
  return NextResponse.json({ projects: data ?? [] });
}
