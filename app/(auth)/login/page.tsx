'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { GridField } from '@/components/ui/grid-field';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  function goToNext() {
    router.push(searchParams.get('next') || '/dashboard');
    router.refresh();
  }

  async function handleResend() {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Verification email resent');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setUnconfirmed(false);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    if (error) {
      setLoading(false);
      if (error.message.toLowerCase().includes('confirm')) {
        setUnconfirmed(true);
      } else {
        toast.error(error.message);
      }
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setLoading(false);

    if (aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setFactorId(totp.id);
        setNeedsMfa(true);
        return;
      }
    }

    toast.success('Welcome back');
    goToNext();
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setLoading(false);
      toast.error(challengeError?.message ?? 'Could not start verification');
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: mfaCode });
    setLoading(false);
    if (error) {
      toast.error('Wrong code — try again');
      return;
    }
    toast.success('Welcome back');
    goToNext();
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (needsMfa) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <GridField strength="strong" />
        <Panel className="relative w-full max-w-sm" hover={false}>
          <h1 className="font-display text-xl font-semibold">Enter your 2FA code</h1>
          <p className="mt-1 text-sm text-white/50">From your authenticator app.</p>
          <form onSubmit={handleMfaVerify} className="mt-6 space-y-4">
            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="6-digit code"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
          </form>
        </Panel>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <GridField strength="strong" />
      <Panel className="relative w-full max-w-sm" hover={false}>
        <h1 className="font-display text-xl font-semibold">Log in to ufo</h1>
        <p className="mt-1 text-sm text-white/50">Welcome back. Enter your details below.</p>

        {unconfirmed && (
          <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
            Please confirm your email before logging in.{' '}
            <button type="button" onClick={handleResend} className="underline underline-offset-2">
              Resend verification email
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-white/60" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/60" htmlFor="password">Password</label>
              <Link href="/forgot-password" className="text-xs text-white/40 hover:text-white/70">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>

          <TurnstileWidget onVerify={setCaptchaToken} />

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <div className="mt-4 flex items-center gap-3 text-xs text-white/30">
          <div className="h-px flex-1 bg-white/10" />
          or
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <Button type="button" variant="secondary" onClick={handleGoogle} className="mt-4 w-full">
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-white/40">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-white/70 hover:text-white">
            Sign up
          </Link>
        </p>
      </Panel>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
    
