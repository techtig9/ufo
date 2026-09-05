'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { GridField } from '@/components/ui/grid-field';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { reportAuthEvent } from '@/lib/report-auth-event';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Security notification for the reset request. The endpoint always answers
    // identically whether or not the address has an account, so this cannot be
    // used to probe for registered emails.
    reportAuthEvent('PASSWORD_RESET_REQUESTED', email);

    setSent(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <GridField strength="strong" />
      <Panel className="relative w-full max-w-sm" hover={false}>
        <h1 className="font-display text-xl font-semibold">Reset your password</h1>
        {sent ? (
          <p className="mt-4 text-sm text-fg-muted">
            If an account exists for <span className="text-fg">{email}</span>, a reset link is
            on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm text-fg-muted" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
              />
            </div>
            <Button type="submit" loading={loading} loadingLabel="Sending reset link" className="w-full">
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-fg-muted">
          <Link href="/login" className="text-accent-text hover:underline">Back to login</Link>
        </p>
      </Panel>
    </div>
  );
}
