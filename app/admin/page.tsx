import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';

export default async function AdminOverviewPage() {
  const admin = createAdminClient();

  const [{ count: userCount }, { count: activeSubs }, { count: paymentCount }] = await Promise.all([
    admin.from('users').select('id', { count: 'exact', head: true }),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).neq('plan', 'free'),
    admin.from('payments').select('id', { count: 'exact', head: true }),
  ]);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Panel>
        <p className="text-sm text-white/50">Total users</p>
        <p className="mt-2 text-3xl font-semibold">{userCount ?? 0}</p>
      </Panel>
      <Panel>
        <p className="text-sm text-white/50">Paid subscriptions</p>
        <p className="mt-2 text-3xl font-semibold">{activeSubs ?? 0}</p>
      </Panel>
      <Panel>
        <p className="text-sm text-white/50">Total payments logged</p>
        <p className="mt-2 text-3xl font-semibold">{paymentCount ?? 0}</p>
      </Panel>
    </div>
  );
}
