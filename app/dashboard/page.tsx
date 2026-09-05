import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { ProjectCard } from '@/components/projects/project-card';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import type { Plan } from '@/lib/types';

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: projects }, { data: profile }, { count: publishedCount }, { count: projectCount }] = await Promise.all([
    supabase.from('subscriptions').select('plan, credits_remaining, credits_reset_at').eq('user_id', user!.id).single(),
    supabase
      .from('projects')
      .select('id, name, project_type, created_at, is_favorite, tags, archived_at')
      .eq('user_id', user!.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('users').select('name').eq('id', user!.id).single(),
    supabase
      .from('shares')
      .select('id, projects!inner(user_id)', { count: 'exact', head: true })
      .eq('is_public', true)
      .eq('projects.user_id', user!.id),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).is('archived_at', null),
  ]);

  const plan = (subscription?.plan ?? 'free') as Plan;
  const total = PLAN_MONTHLY_CREDITS[plan];
  const remaining = subscription?.credits_remaining ?? 0;
  const usedPct = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0;

  // Real generation count for the current billing cycle — every successful call to
  // /api/generate writes a `request_log` row (route: 'generate'), so this is an exact
  // count, not an estimate. request_log has no user-facing RLS policy (service-role
  // only, see schema.sql), so it's read here with the admin client, scoped to this user.
  let generationsThisCycle = 0;
  if (subscription?.credits_reset_at) {
    const admin = createAdminClient();
    const { count } = await admin
      .from('request_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('route', 'generate')
      .gte('created_at', subscription.credits_reset_at);
    generationsThisCycle = count ?? 0;
  }

  const checklistItems = [
    { label: 'Generate your first project', done: (projectCount ?? 0) > 0, href: '/dashboard/ai-designer' },
    { label: 'Add your name in Settings', done: !!profile?.name, href: '/dashboard/settings' },
    { label: 'Publish a shareable prototype link', done: (publishedCount ?? 0) > 0, href: '/dashboard/projects' },
  ];

  const stats = [
    { label: 'Projects', value: projectCount ?? 0, href: '/dashboard/projects' },
    { label: 'Published', value: publishedCount ?? 0, href: '/dashboard/projects' },
    { label: 'AI generations this cycle', value: generationsThisCycle, href: '/dashboard/ai-designer' },
    { label: 'Credits remaining', value: remaining.toLocaleString(), href: '/dashboard/billing' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-5 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <DashboardGreeting name={profile?.name ? profile.name.split(' ')[0] : null} />
          <p className="mt-1 max-w-xl text-sm text-white/40">Generate websites, refine them with AI, and manage every project from one focused workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/templates"><Button variant="secondary">Browse templates</Button></Link>
          <Link href="/dashboard/ai-designer"><Button>+ New Project</Button></Link>
        </div>
      </div>

      <OnboardingChecklist items={checklistItems} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Panel className="h-full">
              <p className="text-[10px] uppercase tracking-wider text-white/35">{stat.label}</p>
              <p className="mt-1.5 font-display text-2xl font-semibold text-white">{stat.value}</p>
            </Panel>
          </Link>
        ))}
      </div>

      <Panel className="bg-gradient-to-br from-violet-500/10 via-[#111218] to-studio-citron/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Credits this cycle</span>
          <span>{remaining.toLocaleString()} / {total.toLocaleString()}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-studio-citron to-studio-coral" style={{ width: `${usedPct}%` }} />
        </div>
      </Panel>

      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-studio-citron">Workspace</p>
            <h2 className="mt-1 text-lg font-medium">Recent projects</h2>
          </div>
          <Link href="/dashboard/projects" className="text-xs text-white/40 hover:text-white">View all →</Link>
        </div>

        {!projects?.length ? (
          <EmptyState
            title="No projects yet"
            description="Generate your first AI prototype to get started."
            action={<Link href="/dashboard/ai-designer" className="text-sm text-studio-coral hover:underline">Generate your first one →</Link>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
