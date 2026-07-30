'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { GridField } from '@/components/ui/grid-field';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';

export default function SignupPage() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const ref = searchParams.get('ref');
  const supabase = createClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const extraParams = `${plan ? `&plan=${plan}` : ''}${ref ? `&ref=${ref}` : ''}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      toast.error('Please accept the Terms and Privacy Policy to continue');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard${extraParams}`,
        captchaToken: captchaToken ?? undefined,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard${extraParams}` },
    });
  }

  if (sent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <GridField strength="strong" />
        <Panel className="relative max-w-sm text-center" hover={false}>
          <h1 className="font-display text-xl font-semibold">Check your email</h1>
          <p className="mt-3 text-sm text-white/60">
            We sent a verification link to <span className="text-white">{email}</span>. Click it
            to activate your account.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <GridField strength="strong" />
      <Panel className="relative w-full max-w-sm" hover={false}>
        <h1 className="font-display text-xl font-semibold">Create your account</h1>
        {plan && (
          <p className="mt-1 text-xs text-studio-coral">
            Signing up for the {plan.charAt(0).toUpperCase() + plan.slice(1)} plan
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-white/60" htmlFor="name">Name</label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>
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
          <div>
            <label className="text-sm text-white/60" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>
          <Button type="submit" disabled={loading || !agreed} className="w-full">
            {loading ? 'Creating account\u2026' : 'Create account'}
          </Button>
          <label className="flex items-start gap-2 text-xs text-white/50">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-studio-citron"
            />
            <span>
              I agree to the{' '}
              <Link href="/legal/terms" className="text-studio-citron hover:underline">Terms</Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="text-studio-citron hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          <TurnstileWidget onVerify={setCaptchaToken} />
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-white/30">
          <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
        </div>
        <Button variant="secondary" onClick={handleGoogle} className="w-full">
          Continue with Google
        </Button>
        <p className="mt-6 text-center text-sm text-white/50">
          Already have an account? <Link href="/login" className="text-studio-coral hover:underline">Log in</Link>
        </p>
      </Panel>
    </div>
  );
}
