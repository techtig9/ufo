'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { INVITABLE_ROLES, ROLE_CAPABILITIES, type InvitableRole } from '@/lib/workspace-roles';

export interface Invite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

function inviteStatus(invite: Invite): { label: string; variant: 'success' | 'warning' | 'info' } {
  if (invite.accepted_at) return { label: 'Accepted', variant: 'success' };
  if (new Date(invite.expires_at).getTime() < Date.now()) return { label: 'Expired', variant: 'warning' };
  return { label: 'Pending', variant: 'info' };
}

export function InvitePanel({
  workspaceId,
  invites,
  canManage,
}: {
  workspaceId: string;
  invites: Invite[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('editor');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Shown once, so an admin can hand over the link when the email does not
  // arrive. The token is not readable from the database afterwards.
  const [lastLink, setLastLink] = useState<{ email: string; url: string } | null>(null);

  async function send() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter an email address.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send the invitation.');
        return;
      }
      setEmail('');
      setLastLink({ email: trimmed, url: data.acceptUrl });
      toast.success(`Invitation sent to ${trimmed}`);
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function revoke(invite: Invite) {
    setBusyId(invite.id);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/invites?inviteId=${encodeURIComponent(invite.id)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Could not revoke the invitation');
        return;
      }
      if (lastLink?.email === invite.email) setLastLink(null);
      toast.success('Invitation revoked');
      router.refresh();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="rounded-panel border border-edge bg-surface-subtle p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              type="email"
              label="Invite by email"
              containerClassName="min-w-[220px] flex-1"
              value={email}
              autoComplete="off"
              placeholder="teammate@company.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !sending) send();
              }}
            />
            <Select
              label="Role"
              containerClassName="w-[150px]"
              value={role}
              options={INVITABLE_ROLES.map((r) => ({ value: r, label: r }))}
              onChange={(e) => setRole(e.target.value as InvitableRole)}
            />
            <Button onClick={send} loading={sending} loadingLabel="Sending…">
              Send invite
            </Button>
          </div>
          <p className="mt-2 text-xs text-fg-faint">{ROLE_CAPABILITIES[role]}</p>
          {error && (
            <p role="alert" className="mt-2 text-xs text-status-error">
              {error}
            </p>
          )}

          {lastLink && (
            <div className="mt-4 rounded-lg border border-edge bg-surface p-3">
              <p className="text-xs text-fg-muted">
                An email is on its way to <strong className="text-fg">{lastLink.email}</strong>. If it
                does not arrive, send them this link — it is shown once and cannot be recovered
                later.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-surface-subtle px-2 py-1 text-[11px] text-fg-muted">
                  {lastLink.url}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(lastLink.url);
                    toast.success('Invite link copied');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {invites.length === 0 ? (
        <EmptyState
          title="No invitations"
          description={
            canManage
              ? 'Invite a teammate by email above.'
              : 'Only admins can invite people to this workspace.'
          }
        />
      ) : (
        <ul className="divide-y divide-edge">
          {invites.map((invite) => {
            const status = inviteStatus(invite);
            return (
              <li key={invite.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{invite.email}</p>
                  <p className="text-xs text-fg-faint">
                    {invite.role} ·{' '}
                    {invite.accepted_at
                      ? `joined ${new Date(invite.accepted_at).toLocaleDateString()}`
                      : `expires ${new Date(invite.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
                {canManage && !invite.accepted_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busyId === invite.id}
                    onClick={() => revoke(invite)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
