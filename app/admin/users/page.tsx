import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';

export default async function AdminUsersPage() {
  const admin = createAdminClient();
  const { data: users } = await admin
    .from('users')
    .select('id, name, email, role, created_at')
    .order('created_at', { ascending: false });

  return (
    <Panel hover={false} className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-white/40">
          <tr>
            <th className="px-4 py-3 font-normal">Name</th>
            <th className="px-4 py-3 font-normal">Email</th>
            <th className="px-4 py-3 font-normal">Role</th>
            <th className="px-4 py-3 font-normal">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {users?.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">{u.name ?? '\u2014'}</td>
              <td className="px-4 py-3 text-white/60">{u.email}</td>
              <td className="px-4 py-3 capitalize">{u.role}</td>
              <td className="px-4 py-3 text-white/40">{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
