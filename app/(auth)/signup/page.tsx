'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { GridField } from '@/components/ui/grid-field';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';
import { safeRedirectPath } from '@/lib/safe-redirect';

function SignupForm() {
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const extraParams = `${plan ? `&plan=${plan}` : ''}${ref ? `&ref=${ref}` : ''}`;

  // `next` is caller-supplied — safeRedirectPath keeps it to a same-origin path
  // so a signup link cannot be used to bounce someone to another site after
  // authenticating. Login already did this; signup ignored the parameter
  // entirely, which broke flows that send a new user here to finish something
  // (accepting a workspace invitation, for one).
  const next = safeRedirectPath(searchParams.get('next'), '');

  // Paid-plan selections are an intent, not a grant. After authentication,
  // send the user to Billing where the real Paddle checkout can be completed.
  // An explicit destination wins over the plan default: someone who followed an
  // invitation link should land on the invitation, not on billing.
  const postAuthPath = next || (plan && plan !== 'free' ? '/dashboard/billing' : '/dashboard');

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
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${postAuthPath}${extraParams}`)}`,
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
    setGoogleLoading(true);
    // The error was previously discarded, so a misconfigured Google provider
    // made this button look inert instead of reporting the problem.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${postAuthPath}${extraParams}`)}` },
    });

    if (error) {
      setGoogleLoading(false);
      toast.error(error.message || 'Could not start Google sign-up. Please try again.');
    }
    // On success the browser leaves for Google — loading state stays on.
  }

  if (sent) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-6">
        <GridField strength="strong" />
        <Panel className="relative max-w-sm text-center" hover={false}>
          <h1 className="font-display text-xl font-semibold">Check your email</h1>
          <p className="mt-3 text-sm text-fg-muted">
            We sent a verification link to <span className="text-fg">{email}</span>. Click it
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
          <p className="mt-1 text-xs text-accent-text">
            Signing up for the {plan.charAt(0).toUpperCase() + plan.slice(1)} plan
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-fg-muted" htmlFor="name">Name</label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>
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
          <div>
            <label className="text-sm text-fg-muted" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-edge bg-surface-subtle px-3 py-2 text-sm outline-none focus:border-studio-citron"
            />
          </div>
          <Button
            type="submit"
            loading={loading}
            loadingLabel="Creating your account"
            disabled={!agreed}
            className="w-full"
          >
            Create account
          </Button>
          <label className="flex items-start gap-2 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-studio-citron"
            />
            <span>
              I agree to the{' '}
              <Link href="/legal/terms" className="text-brand-text hover:underline">Terms</Link>{' '}
              and{' '}
              <Link href="/legal/privacy" className="text-brand-text hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          <TurnstileWidget onVerify={setCaptchaToken} />
        </form>
        <div className="my-4 flex items-center gap-3 text-xs text-fg-faint">
          <span className="h-px flex-1 bg-surface-raised" /> or <span className="h-px flex-1 bg-surface-raised" />
        </div>
        <Button
          variant="secondary"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full"
        >
          {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>
        <p className="mt-6 text-center text-sm text-fg-muted">
          Already have an account? <Link href="/login" className="text-accent-text hover:underline">Log in</Link>
        </p>
      </Panel>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
