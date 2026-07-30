import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';

export default async function AdminActivityPage() {
  const admin = createAdminClient();
  const { data: entries } = await admin
    .from('request_log')
    .select('id, route, meta, created_at, users(email)')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <Panel hover={false} className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-white/40">
          <tr>
            <th className="px-4 py-3 font-normal">User</th>
            <th className="px-4 py-3 font-normal">Route</th>
            <th className="px-4 py-3 font-normal">Detail</th>
            <th className="px-4 py-3 font-normal">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {entries?.map((e: any) => (
            <tr key={e.id}>
              <td className="px-4 py-3 text-white/60">{e.users?.email ?? '\u2014'}</td>
              <td className="px-4 py-3 font-mono text-xs text-studio-citron">{e.route}</td>
              <td className="px-4 py-3 text-white/40">{e.meta ? JSON.stringify(e.meta) : '\u2014'}</td>
              <td className="px-4 py-3 text-white/40">{new Date(e.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {!entries?.length && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-white/30">No activity logged yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}
