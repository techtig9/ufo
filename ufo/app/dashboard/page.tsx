import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import type { Plan } from '@/lib/types';

export default async function DashboardHome() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: subscription }, { data: projects }, { data: profile }, { data: publicShares }] = await Promise.all([
    supabase.from('subscriptions').select('plan, credits_remaining').eq('user_id', user!.id).single(),
    supabase
      .from('projects')
      .select('id, name, project_type, created_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('users').select('name').eq('id', user!.id).single(),
    supabase
      .from('shares')
      .select('id, projects!inner(user_id)')
      .eq('is_public', true)
      .eq('projects.user_id', user!.id)
      .limit(1),
  ]);

  const plan = (subscription?.plan ?? 'free') as Plan;
  const total = PLAN_MONTHLY_CREDITS[plan];
  const remaining = subscription?.credits_remaining ?? 0;
  const usedPct = total > 0 ? Math.min(100, Math.round(((total - remaining) / total) * 100)) : 0;

  const checklistItems = [
    { label: 'Generate your first project', done: (projects?.length ?? 0) > 0, href: '/dashboard/ai-designer' },
    { label: 'Add your name in Settings', done: !!profile?.name, href: '/dashboard/settings' },
    { label: 'Publish a shareable prototype link', done: (publicShares?.length ?? 0) > 0, href: '/dashboard/projects' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4">
      <div className="flex items-center justify-between">
        <div>
          <DashboardGreeting name={profile?.name ? profile.name.split(' ')[0] : null} />
          <p className="text-white/50">Here&rsquo;s where your projects stand.</p>
        </div>
        <Link href="/dashboard/ai-designer">
          <Button>+ New Project</Button>
        </Link>
      </div>

      <OnboardingChecklist items={checklistItems} />

      <Panel>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">Credits this cycle</span>
          <span>{remaining.toLocaleString()} / {total.toLocaleString()}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-studio-citron to-studio-coral"
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </Panel>

      <div>
        <h2 className="mb-4 text-lg font-medium">Recent projects</h2>
        {!projects?.length ? (
          <Panel className="text-center text-white/50">
            No projects yet.{' '}
            <Link href="/dashboard/ai-designer" className="text-studio-coral hover:underline">
              Generate your first one
            </Link>
            .
          </Panel>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
                <Panel className="h-full">
                  <div className="aspect-video rounded-lg bg-gradient-to-br from-studio-citron/20 to-studio-coral/10" />
                  <p className="mt-3 truncate font-medium">{p.name}</p>
                  <p className="text-xs capitalize text-white/40">{p.project_type}</p>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
