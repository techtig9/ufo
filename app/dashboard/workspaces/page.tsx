import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WorkspaceList, type WorkspaceSummary } from '@/components/workspaces/workspace-list';
import type { WorkspaceRole } from '@/lib/workspace-roles';

export const metadata: Metadata = {
  title: 'Workspaces',
  description: 'Share UFO projects with your team.',
};

interface MembershipRow {
  role: WorkspaceRole;
  workspace: { id: string; name: string; created_at: string } | null;
}

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('role, workspace:workspaces(id, name, created_at)')
    .eq('user_id', user.id);

  const rows = ((memberships ?? []) as unknown as MembershipRow[]).filter((m) => m.workspace);
  const ids = rows.map((m) => m.workspace!.id);

  // Counts come from head-only queries so the payload stays a number rather
  // than every row. RLS scopes both, so they can only ever count what this
  // member is allowed to see.
  const counts = await Promise.all(
    ids.map(async (id) => {
      const [{ count: memberCount }, { count: projectCount }] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', id),
        supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', id),
      ]);
      return { id, memberCount: memberCount ?? 0, projectCount: projectCount ?? 0 };
    })
  );

  const workspaces: WorkspaceSummary[] = rows
    .map((m) => {
      const count = counts.find((c) => c.id === m.workspace!.id);
      return {
        id: m.workspace!.id,
        name: m.workspace!.name,
        role: m.role,
        created_at: m.workspace!.created_at,
        memberCount: count?.memberCount ?? 0,
        projectCount: count?.projectCount ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-[1200px] p-2 pb-10">
      <WorkspaceList workspaces={workspaces} />
    </div>
  );
}
