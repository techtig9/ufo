'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { GridField } from '@/components/ui/grid-field';

/**
 * Password prompt for a protected share link.
 *
 * Renders nothing about the prototype itself — no name, no screen count, no
 * thumbnail — because a lock that tells you what is behind it is a weaker lock.
 */
export function SharePasswordGate({ slug }: { slug: string }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/shares/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'That password is not correct.');
        setSubmitting(false);
        return;
      }

      // A full reload, so the server re-renders with the grant cookie set.
      window.location.reload();
    } catch {
      setError('Could not reach the server. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <GridField strength="strong" />
      <Panel className="relative w-full max-w-sm" hover={false}>
        <h1 className="font-display text-xl font-semibold">This prototype is protected</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Enter the password you were given to view it.
        </p>

        {error && (
          <div
            role="alert"
            data-testid="share-password-error"
            className="mt-4 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-accent-text"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-fg-muted" htmlFor="share-password">
              Password
            </label>
            <input
              id="share-password"
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none transition-colors duration-micro focus:border-brand"
            />
          </div>
          <Button type="submit" loading={submitting} loadingLabel="Checking" className="w-full">
            View prototype
          </Button>
        </form>
      </Panel>
    </div>
  );
}
