import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * The workspace activity feed.
 *
 * Read through the caller's session so the "members read workspace activity"
 * policy scopes it — a non-member gets an empty list, not someone else's audit
 * trail. Rows are written service-role-side only, so the feed cannot be forged
 * by a client.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const limitParam = Number(new URL(request.url).searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;

  const { data, error } = await supabase
    .from('workspace_activity')
    .select('id, action, detail, created_at, project_id, actor:users(id, name, email)')
    .eq('workspace_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[workspace activity] load failed', error.message);
    return NextResponse.json({ error: 'Could not load activity' }, { status: 500 });
  }

  return NextResponse.json({ activity: data ?? [] });
}
