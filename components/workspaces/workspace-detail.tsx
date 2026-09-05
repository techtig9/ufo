'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { MemberTable, type Member } from '@/components/workspaces/member-table';
import { InvitePanel, type Invite } from '@/components/workspaces/invite-panel';
import { ActivityFeed, type ActivityEntry } from '@/components/workspaces/activity-feed';
import { roleAtLeast, type WorkspaceRole } from '@/lib/workspace-roles';

export interface WorkspaceProject {
  id: string;
  name: string;
  updated_at: string | null;
}

export function WorkspaceDetail({
  workspace,
  viewerRole,
  viewerId,
  members,
  invites,
  activity,
  projects,
}: {
  workspace: { id: string; name: string; created_at: string };
  viewerRole: WorkspaceRole | null;
  viewerId: string;
  members: Member[];
  invites: Invite[];
  activity: ActivityEntry[];
  projects: WorkspaceProject[];
}) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManage = roleAtLeast(viewerRole, 'admin');
  const isOwner = viewerRole === 'owner';

  async function rename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === workspace.name) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not rename the workspace');
        return;
      }
      toast.success('Workspace renamed');
      router.refresh();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setRenaming(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not delete the workspace');
        return;
      }
      toast.success('Workspace deleted');
      router.push('/dashboard/workspaces');
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setDeleting(false);
    }
  }

  const tabs = [
    {
      id: 'members',
      label: `Members (${members.length})`,
      content: (
        <MemberTable
          workspaceId={workspace.id}
          members={members}
          viewerRole={viewerRole}
          viewerId={viewerId}
        />
      ),
    },
    {
      id: 'invites',
      label: `Invitations (${invites.filter((i) => !i.accepted_at).length})`,
      content: <InvitePanel workspaceId={workspace.id} invites={invites} canManage={canManage} />,
    },
    {
      id: 'projects',
      label: `Projects (${projects.length})`,
      content:
        projects.length === 0 ? (
          <EmptyState
            title="No projects in this workspace"
            description="Move a project into this workspace from its editor to share it with everyone here."
          />
        ) : (
          <ul className="divide-y divide-edge">
            {projects.map((project) => (
              <li key={project.id} className="py-3">
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="text-sm text-fg hover:text-brand-text"
                >
                  {project.name}
                </Link>
                {project.updated_at && (
                  <p className="text-xs text-fg-faint">
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ),
    },
    {
      id: 'activity',
      label: 'Activity',
      content: <ActivityFeed activity={activity} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/workspaces" className="text-xs text-fg-faint hover:text-fg">
          ← All workspaces
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-medium text-fg">{workspace.name}</h1>
          {viewerRole && <Badge variant={isOwner ? 'primary' : 'neutral'}>{viewerRole}</Badge>}
        </div>
      </div>

      <div className="panel p-6">
        <Tabs tabs={tabs} defaultValue="members" />
      </div>

      {canManage && (
        <div className="panel p-6">
          <h2 className="font-display text-base font-medium text-fg">Workspace settings</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Input
              label="Name"
              containerClassName="min-w-[220px] flex-1"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              variant="secondary"
              onClick={rename}
              loading={renaming}
              disabled={!name.trim() || name.trim() === workspace.name}
            >
              Save name
            </Button>
          </div>

          {isOwner && (
            <div className="mt-6 border-t border-edge pt-5">
              <h3 className="text-sm font-medium text-fg">Delete this workspace</h3>
              <p className="mt-1 text-xs text-fg-muted">
                Everyone loses shared access and all invitations are cancelled. Projects are{' '}
                <strong className="text-fg">not</strong> deleted — each one returns to being a
                personal project of whoever created it.
              </p>
              <Button variant="danger" className="mt-3" onClick={() => setConfirmDelete(true)}>
                Delete workspace
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        closeOnBackdrop={false}
        size="sm"
        title={`Delete “${workspace.name}”?`}
        description={`${members.length} ${members.length === 1 ? 'member' : 'members'} will lose shared access. The ${projects.length} ${projects.length === 1 ? 'project' : 'projects'} in it are kept and revert to personal projects. This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={deleting} loadingLabel="Deleting…">
              Delete workspace
            </Button>
          </div>
        }
      />
    </div>
  );
}
