'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { GridField } from '@/components/ui/grid-field';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';

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
    setSent(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <GridField strength="strong" />
      <Panel className="relative w-full max-w-sm" hover={false}>
        <h1 className="font-display text-xl font-semibold">Reset your password</h1>
        {sent ? (
          <p className="mt-4 text-sm text-white/60">
            If an account exists for <span className="text-white">{email}</span>, a reset link is
            on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm text-white/60" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Sending\u2026' : 'Send reset link'}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-white/50">
          <Link href="/login" className="text-studio-coral hover:underline">Back to login</Link>
        </p>
      </Panel>
    </div>
  );
}
