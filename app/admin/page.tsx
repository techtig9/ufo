import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';
import { StatGrid, type Stat } from '@/components/admin/stat-grid';
import { PLAN_PRICE_USD } from '@/lib/credits';
import type { Plan } from '@/lib/types';

/**
 * Admin overview.
 *
 * Revenue is computed two ways and both are labelled, because conflating them
 * is how a dashboard ends up lying: MRR is what the current active
 * subscriptions are worth per month, while collected is the sum of payments
 * that actually completed. They differ legitimately — refunds, part-months,
 * failed renewals — and a single "revenue" number would hide which.
 */

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const admin = createAdminClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    { count: userCount },
    { data: subscriptions },
    { data: payments },
    { count: projectCount },
    { count: newUsers },
  ] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }),
    admin.from('subscriptions').select('plan, status'),
    admin.from('payments').select('amount, status, created_at'),
    admin.from('projects').select('id', { count: 'exact', head: true }),
    admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString()),
  ]);

  const paid = (subscriptions ?? []).filter((s) => s.plan !== 'free');
  const mrr = paid.reduce((sum, s) => sum + (PLAN_PRICE_USD[s.plan as Plan] ?? 0), 0);

  // Only completed payments count as collected. A pending or failed row is not
  // money.
  const completed = (payments ?? []).filter((p) => p.status === 'completed' || p.status === 'paid');
  const collectedAllTime = completed.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const collectedThisMonth = completed
    .filter((p) => p.created_at && new Date(p.created_at) >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const byPlan = new Map<string, number>();
  for (const s of subscriptions ?? []) byPlan.set(s.plan, (byPlan.get(s.plan) ?? 0) + 1);

  const stats: Stat[] = [
    { label: 'Users', value: userCount ?? 0, hint: `${newUsers ?? 0} joined this month` },
    {
      label: 'Paid subscriptions',
      value: paid.length,
      hint: userCount ? `${Math.round((paid.length / userCount) * 100)}% of users` : undefined,
    },
    {
      label: 'MRR',
      value: `$${mrr.toLocaleString()}`,
      hint: 'active paid plans at list price',
    },
    {
      label: 'Collected this month',
      value: `$${collectedThisMonth.toLocaleString()}`,
      hint: `$${collectedAllTime.toLocaleString()} all time`,
    },
  ];

  return (
    <div className="space-y-6">
      <StatGrid stats={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel hover={false}>
          <h2 className="font-medium">Plan mix</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(['free', 'starter', 'pro', 'business'] as Plan[]).map((plan) => (
              <li key={plan} className="flex justify-between">
                <span className="capitalize text-fg-muted">{plan}</span>
                <span>{(byPlan.get(plan) ?? 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fg-faint">
            MRR is list price × active paid subscriptions. It is not the same as money collected —
            refunds, part-months and failed renewals make them differ, so both are shown.
          </p>
        </Panel>

        <Panel hover={false}>
          <h2 className="font-medium">Projects</h2>
          <p className="mt-2 font-display text-3xl font-semibold">
            {(projectCount ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-fg-faint">
            {userCount ? `${(( projectCount ?? 0) / userCount).toFixed(1)} per user on average` : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/admin/ai" className="text-brand-text hover:underline">AI usage →</Link>
            <Link href="/admin/email" className="text-brand-text hover:underline">Email delivery →</Link>
            <Link href="/admin/system" className="text-brand-text hover:underline">System health →</Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
