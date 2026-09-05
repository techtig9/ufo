'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import {
  INVITABLE_ROLES,
  ROLE_CAPABILITIES,
  WORKSPACE_ROLES,
  roleAtLeast,
  type WorkspaceRole,
} from '@/lib/workspace-roles';

export interface Member {
  id: string;
  role: WorkspaceRole;
  created_at: string;
  member: { id: string; name: string | null; email: string } | null;
}


export function MemberTable({
  workspaceId,
  members,
  viewerRole,
  viewerId,
}: {
  workspaceId: string;
  members: Member[];
  viewerRole: WorkspaceRole | null;
  viewerId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

  const canManage = roleAtLeast(viewerRole, 'admin');

  async function changeRole(userId: string, role: string) {
    setBusy(userId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not change the role');
        return;
      }
      toast.success('Role updated');
      router.refresh();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(null);
    }
  }

  async function remove(member: Member) {
    const userId = member.member?.id;
    if (!userId) return;
    setBusy(userId);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members?userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not remove the member');
        return;
      }
      setConfirmRemove(null);
      if (userId === viewerId) {
        // You just removed your own access — there is nothing left to refresh.
        toast.success('You left the workspace');
        router.push('/dashboard/workspaces');
        return;
      }
      toast.success('Member removed');
      router.refresh();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ul className="divide-y divide-edge">
        {members.map((row) => {
          const person = row.member;
          const isSelf = person?.id === viewerId;
          const isOwner = row.role === 'owner';
          // The owner's role is fixed and the owner cannot be removed — the API
          // enforces both, and showing the control anyway would be a button
          // that only ever produces an error.
          const canEditRole = canManage && !isOwner;
          const canRemove = (canManage && !isOwner) || (isSelf && !isOwner);

          return (
            <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">
                  {person?.name || person?.email || 'Unknown user'}
                  {isSelf && <span className="ml-2 text-xs text-fg-faint">(you)</span>}
                </p>
                {person?.name && (
                  <p className="truncate text-xs text-fg-faint">{person.email}</p>
                )}
              </div>

              {canEditRole ? (
                <Select
                  label="Role"
                  hideLabel
                  containerClassName="w-[140px]"
                  value={row.role}
                  disabled={busy === person?.id}
                  options={INVITABLE_ROLES.map((r) => ({ value: r, label: r }))}
                  onChange={(e) => person && changeRole(person.id, e.target.value)}
                />
              ) : (
                <Badge variant={isOwner ? 'primary' : 'neutral'}>{row.role}</Badge>
              )}

              {canRemove && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === person?.id}
                  onClick={() => setConfirmRemove(row)}
                >
                  {isSelf ? 'Leave' : 'Remove'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="mt-6 space-y-1.5 border-t border-edge pt-4 text-xs text-fg-faint">
        {WORKSPACE_ROLES.map((role) => (
          <div key={role} className="flex gap-2">
            <dt className="w-16 shrink-0 font-medium text-fg-muted">{role}</dt>
            <dd>{ROLE_CAPABILITIES[role]}</dd>
          </div>
        ))}
      </dl>

      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        closeOnBackdrop={false}
        size="sm"
        title={confirmRemove?.member?.id === viewerId ? 'Leave this workspace?' : 'Remove this member?'}
        description={
          confirmRemove?.member?.id === viewerId
            ? 'You will lose access to the workspace’s projects. An admin would have to invite you back.'
            : `${confirmRemove?.member?.name || confirmRemove?.member?.email || 'This person'} will lose access to the workspace’s projects. Projects they created stay in the workspace.`
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === confirmRemove?.member?.id}
              onClick={() => confirmRemove && remove(confirmRemove)}
            >
              {confirmRemove?.member?.id === viewerId ? 'Leave workspace' : 'Remove member'}
            </Button>
          </div>
        }
      />
    </>
  );
}
