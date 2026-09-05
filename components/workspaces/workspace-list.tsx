'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/empty-state';
import type { WorkspaceRole } from '@/lib/workspace-roles';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  memberCount: number;
  projectCount: number;
  created_at: string;
}

const roleVariant: Record<WorkspaceRole, 'primary' | 'info' | 'neutral'> = {
  owner: 'primary',
  admin: 'info',
  editor: 'neutral',
  viewer: 'neutral',
};

export function WorkspaceList({ workspaces }: { workspaces: WorkspaceSummary[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the workspace a name.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not create the workspace.');
        return;
      }
      toast.success('Workspace created');
      setOpen(false);
      setName('');
      router.push(`/dashboard/workspaces/${data.workspace.id}`);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium text-fg">Workspaces</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Share projects with a team. Everyone in a workspace sees its projects; what they can do
            depends on their role.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>New workspace</Button>
      </div>

      {workspaces.length === 0 ? (
        <div className="mt-6 rounded-panel border border-edge bg-surface">
          <EmptyState
            icon={<span aria-hidden="true">◱</span>}
            title="No workspaces yet"
            description="Your projects are personal until you put them in a workspace. Create one to invite teammates."
            action={<Button onClick={() => setOpen(true)}>Create your first workspace</Button>}
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <Link
                href={`/dashboard/workspaces/${workspace.id}`}
                className="panel panel-hover block h-full p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-citron"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-base font-medium text-fg">{workspace.name}</h2>
                  <Badge variant={roleVariant[workspace.role]}>{workspace.role}</Badge>
                </div>
                <p className="mt-3 text-xs text-fg-faint">
                  {workspace.memberCount} {workspace.memberCount === 1 ? 'member' : 'members'} ·{' '}
                  {workspace.projectCount} {workspace.projectCount === 1 ? 'project' : 'projects'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New workspace"
        description="You will be its owner. You can invite people once it exists."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={create} loading={creating} loadingLabel="Creating…">
              Create workspace
            </Button>
          </div>
        }
      >
        <Input
          label="Workspace name"
          value={name}
          maxLength={80}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !creating) create();
          }}
          placeholder="Design team"
          error={error ?? undefined}
        />
      </Modal>
    </>
  );
}
