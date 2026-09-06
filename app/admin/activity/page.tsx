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
        <thead className="border-b border-edge text-fg-faint">
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
              <td className="px-4 py-3 text-fg-muted">{e.users?.email ?? '\u2014'}</td>
              <td className="px-4 py-3 font-mono text-xs text-brand-text">{e.route}</td>
              <td className="px-4 py-3 text-fg-faint">{e.meta ? JSON.stringify(e.meta) : '\u2014'}</td>
              <td className="px-4 py-3 text-fg-faint">{new Date(e.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {!entries?.length && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-fg-faint">No activity logged yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Panel>
  );
}
