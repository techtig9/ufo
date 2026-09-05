import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Publishing status, view analytics and the publish log for a project.
 *
 * Everything is read through the caller's session, so the policies from
 * migration 013 scope it — a non-collaborator gets a 404, and share_view_stats
 * makes its own access check because it is SECURITY DEFINER.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const [{ data: stats }, { data: events }, { data: recent }] = await Promise.all([
    supabase.rpc('share_view_stats', { p_project: id, p_days: 30 }),
    supabase
      .from('share_publish_events')
      .select('id, action, had_password, expires_at, allow_comments, created_at, actor:users(name, email)')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    // Referrers, so an owner can see where a link is being opened from. Hosts
    // only — the full URL is never stored.
    supabase
      .from('share_views')
      .select('referrer_host, device, viewed_at')
      .eq('project_id', id)
      .order('viewed_at', { ascending: false })
      .limit(200),
  ]);

  const row = Array.isArray(stats) ? stats[0] : stats;

  const referrers = new Map<string, number>();
  const devices = new Map<string, number>();
  for (const view of recent ?? []) {
    const host = view.referrer_host || 'direct or private';
    referrers.set(host, (referrers.get(host) ?? 0) + 1);
    devices.set(view.device ?? 'unknown', (devices.get(view.device ?? 'unknown') ?? 0) + 1);
  }

  return NextResponse.json({
    stats: {
      totalViews: Number(row?.total_views ?? 0),
      recentViews: Number(row?.recent_views ?? 0),
      lastViewedAt: row?.last_viewed_at ?? null,
      activeDays: Number(row?.active_days ?? 0),
    },
    // Sampled from the most recent 200 views, which the client is told, rather
    // than presented as an all-time breakdown it is not.
    sample: {
      size: (recent ?? []).length,
      referrers: [...referrers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      devices: [...devices.entries()].sort((a, b) => b[1] - a[1]),
    },
    events: events ?? [],
  });
}
