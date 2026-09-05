import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WorkspaceDetail } from '@/components/workspaces/workspace-detail';
import type { Member } from '@/components/workspaces/member-table';
import type { Invite } from '@/components/workspaces/invite-panel';
import type { ActivityEntry } from '@/components/workspaces/activity-feed';
import type { WorkspaceRole } from '@/lib/workspace-roles';

export const metadata: Metadata = { title: 'Workspace' };

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Every query below runs through the caller's session, so migration 010's
  // policies decide what comes back. A non-member gets no workspace row and
  // therefore a 404 — the same answer as a workspace that does not exist, so
  // this page cannot be used to probe for one.
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!workspace) notFound();

  const [{ data: membership }, { data: members }, { data: invites }, { data: activity }, { data: projects }] =
    await Promise.all([
      supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('workspace_members')
        .select('id, role, created_at, member:users(id, name, email)')
        .eq('workspace_id', id)
        .order('created_at'),
      // Never selects token_hash — an admin managing invitations has no need
      // for the credential itself.
      supabase
        .from('workspace_invites')
        .select('id, email, role, expires_at, accepted_at, created_at')
        .eq('workspace_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('workspace_activity')
        .select('id, action, detail, created_at, project_id, actor:users(id, name, email)')
        .eq('workspace_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('projects')
        .select('id, name, updated_at')
        .eq('workspace_id', id)
        .order('updated_at', { ascending: false }),
    ]);

  return (
    <div className="mx-auto max-w-[1000px] p-2 pb-10">
      <WorkspaceDetail
        workspace={workspace}
        viewerRole={(membership?.role as WorkspaceRole) ?? null}
        viewerId={user.id}
        members={(members ?? []) as unknown as Member[]}
        invites={(invites ?? []) as Invite[]}
        activity={(activity ?? []) as unknown as ActivityEntry[]}
        projects={projects ?? []}
      />
    </div>
  );
}
