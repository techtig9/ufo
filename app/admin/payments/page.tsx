import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';

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
        <thead className="border-b border-white/10 text-white/40">
          <tr>
            <th className="px-4 py-3 font-normal">User</th>
            <th className="px-4 py-3 font-normal">Amount</th>
            <th className="px-4 py-3 font-normal">Status</th>
            <th className="px-4 py-3 font-normal">Paddle Transaction</th>
            <th className="px-4 py-3 font-normal">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {payments?.map((p: any) => (
            <tr key={p.id}>
              <td className="px-4 py-3 text-white/60">{p.users?.email}</td>
              <td className="px-4 py-3">${p.amount}</td>
              <td className="px-4 py-3 capitalize">{p.status}</td>
              <td className="px-4 py-3 text-white/40">{p.paddle_transaction_id}</td>
              <td className="px-4 py-3 text-white/40">{new Date(p.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
