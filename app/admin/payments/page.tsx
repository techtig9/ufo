import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';

/**
 * Rendered per request, not prerendered.
 *
 * Without this Next statically generated this page at build time: it reads the
 * database from a server component but touches no dynamic API, so it qualified
 * for static generation and would have served the numbers as they stood when
 * the build ran — for the life of the deployment. An admin page showing stale
 * counts is worse than one showing none.
 */
export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from('payments')
    .select('id, amount, status, paddle_transaction_id, created_at, users(email)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <Panel hover={false} className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-edge text-fg-faint">
          <tr>
            <th className="px-4 py-3 font-normal">User</th>
            <th className="px-4 py-3 font-normal">Amount</th>
            <th className="px-4 py-3 font-normal">Status</th>
            <th className="px-4 py-3 font-normal">Paddle Transaction</th>
            <th className="px-4 py-3 font-normal">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-edge">
          {payments?.map((p: any) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-fg-muted">{p.users?.email}</td>
              <td className="px-4 py-3">${p.amount}</td>
              <td className="px-4 py-3 capitalize">{p.status}</td>
              <td className="px-4 py-3 text-fg-faint">{p.paddle_transaction_id}</td>
              <td className="px-4 py-3 text-fg-faint">{new Date(p.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
