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
import { safeRedirectPath } from '@/lib/safe-redirect';
import { reportAuthEvent } from '@/lib/report-auth-event';

/**
 * Failure codes set by /auth/callback. Previously a failed OAuth round-trip
 * redirected here with nothing to show, which is what made the Google problem
 * look like "the button does nothing".
 */
const CALLBACK_ERRORS: Record<string, string> = {
  oauth_provider_error:
    'Google declined the sign-in. If you cancelled, just try again — otherwise the Google provider may not be configured correctly.',
  missing_code:
    'The sign-in link came back without an authorization code. Please try signing in again.',
  exchange_failed:
    'We could not complete the sign-in with Google. Please try again, or use your email and password.',
  provisioning_failed:
    'You signed in, but we could not finish setting up your account. Please try again or contact support.',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  // safeRedirectPath: `next` is caller-supplied, so it must not be able to
  // send a just-authenticated user off-origin.
  const nextPath = safeRedirectPath(searchParams.get('next'));

  const errorCode = searchParams.get('error');
  const callbackError = errorCode
    ? (CALLBACK_ERRORS[errorCode] ?? 'Sign-in failed. Please try again.')
    : null;
  // Correlates the visible failure with the structured server log for support.
  const errorRef = searchParams.get('ref');

  function goToNext() {
    router.push(nextPath);
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

    reportAuthEvent('PASSWORD_LOGIN');
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
    reportAuthEvent('MFA_LOGIN_SUCCESS');
    toast.success('Welcome back');
    goToNext();
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    // signInWithOAuth's error was previously discarded, so a misconfigured
    // provider produced a button that silently did nothing.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      setGoogleLoading(false);
      toast.error(error.message || 'Could not start Google sign-in. Please try again.');
    }
    // On success the browser navigates to Google, so the loading state stays
    // on until the page unloads — deliberately not reset here.
  }

  if (needsMfa) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <GridField strength="strong" />
        <Panel className="relative w-full max-w-sm" hover={false}>
          <h1 className="font-display text-xl font-semibold">Enter your 2FA code</h1>
          <p className="mt-1 text-sm text-fg-muted">From your authenticator app.</p>
          <form onSubmit={handleMfaVerify} className="mt-6 space-y-4">
            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              placeholder="6-digit code"
              autoFocus
              className="w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
            <Button type="submit" loading={loading} loadingLabel="Verifying your code" className="w-full">
              Verify
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
        <p className="mt-1 text-sm text-fg-muted">Welcome back. Enter your details below.</p>

        {callbackError && (
          <div
            role="alert"
            data-testid="callback-error"
            className="mt-4 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error"
          >
            <p>{callbackError}</p>
            {errorRef && (
              <p className="mt-1 font-mono text-[11px] text-status-error/70">
                Reference: {errorRef}
              </p>
            )}
          </div>
        )}

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
            <label className="text-sm text-fg-muted" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-fg-muted" htmlFor="password">Password</label>
              <Link href="/forgot-password" className="text-xs text-fg-faint hover:text-fg-secondary">
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
              className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>

          <TurnstileWidget onVerify={setCaptchaToken} />

          <Button type="submit" loading={loading} loadingLabel="Logging in" className="w-full">
            Log in
          </Button>
        </form>

        <div className="mt-4 flex items-center gap-3 text-xs text-fg-faint">
          <div className="h-px flex-1 bg-surface-raised" />
          or
          <div className="h-px flex-1 bg-surface-raised" />
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="mt-4 w-full"
        >
          {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>

        <p className="mt-6 text-center text-sm text-fg-faint">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-fg-secondary hover:text-fg">
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
    
