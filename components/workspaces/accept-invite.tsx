'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type Result =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'joined'; workspaceId: string; workspaceName: string; role: string };

export function AcceptInvite({
  token,
  signedInAs,
}: {
  token: string;
  signedInAs: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<Result>({ kind: 'idle' });
  const [accepting, setAccepting] = useState(false);

  async function accept() {
    setAccepting(true);
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: 'error', message: data.error ?? 'This invitation could not be accepted.' });
        return;
      }
      setState({
        kind: 'joined',
        workspaceId: data.workspace?.id ?? '',
        workspaceName: data.workspace?.name ?? 'the workspace',
        role: data.role,
      });
      router.refresh();
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server. Please try again.' });
    } finally {
      setAccepting(false);
    }
  }

  if (state.kind === 'joined') {
    return (
      <div className="text-center">
        <h1 className="font-display text-2xl font-medium text-fg">
          You joined {state.workspaceName}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          You are a <strong className="text-fg">{state.role}</strong>. Its projects are now in your
          dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href={`/dashboard/workspaces/${state.workspaceId}`}>
            <Button>Open workspace</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary">Go to dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="font-display text-2xl font-medium text-fg">You have been invited</h1>
      <p className="mt-2 text-sm text-fg-muted">
        {/* The workspace name is deliberately not shown before acceptance: this
            page is reachable by anyone holding the link, and the invitation
            details are only confirmed once the signed-in address matches. */}
        Accept to join the workspace you were invited to.
      </p>
      {signedInAs && (
        <p className="mt-3 text-xs text-fg-faint">
          Signed in as <strong className="text-fg-muted">{signedInAs}</strong>. The invitation must
          have been sent to this address.
        </p>
      )}

      <Button className="mt-6" onClick={accept} loading={accepting} loadingLabel="Joining…">
        Accept invitation
      </Button>

      {state.kind === 'error' && (
        <div role="alert" className="mt-5 rounded-lg border border-status-error/30 bg-status-error/10 p-3">
          <p className="text-sm text-status-error">{state.message}</p>
          <Link href="/dashboard" className="mt-2 inline-block text-xs text-brand-text hover:underline">
            Go to your dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
