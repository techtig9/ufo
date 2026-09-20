'use client';

import Script from 'next/script';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    Paddle?: {
      Initialize: (opts: { token: string }) => void;
      Checkout: { open: (opts: Record<string, unknown>) => void };
    };
  }
}

let initialized = false;

/**
 * Paddle's checkout overlay, with every way it can fail made visible.
 *
 * It used to fail three ways in silence, which on a billing button means a
 * customer who wants to pay us cannot, and never finds out why:
 *
 *   1. `Initialize({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN! })`
 *      — the non-null assertion is a lie the type system cannot catch. With
 *      the variable unset the SDK is initialised with `undefined` and the
 *      overlay never opens.
 *   2. `if (!window.Paddle) return;` — a bare return. paddle.com is on most
 *      ad-blocker lists, so this is common rather than theoretical.
 *   3. `<Script>` had no `onError`, so a blocked CDN left the button disabled
 *      for ever with no explanation.
 *
 * Now the token is checked before render (no token, no button — a disabled
 * control with a reason beats one that lies), and everything after that
 * reports through `error`.
 */
const CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

export function PaddleCheckoutButton({
  priceId,
  userId,
  userEmail,
  label,
  variant = 'primary',
}: {
  priceId: string;
  userId: string;
  userEmail: string;
  label: string;
  variant?: 'primary' | 'secondary';
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checkout cannot work without the client token, and a button that opens
  // nothing is worse than no button: the operator needs to see the cause.
  if (!CLIENT_TOKEN) {
    return (
      <div className="space-y-1.5">
        <Button variant={variant} size="sm" disabled>
          {label}
        </Button>
        <p className="text-xs text-fg-faint">
          Checkout is not configured. Set{' '}
          <code className="text-fg-muted">NEXT_PUBLIC_PADDLE_CLIENT_TOKEN</code> and redeploy.
        </p>
      </div>
    );
  }

  function openCheckout() {
    setError(null);

    if (!window.Paddle) {
      setError('Checkout could not load. Disable your ad blocker for paddle.com and try again.');
      return;
    }

    try {
      if (!initialized) {
        window.Paddle.Initialize({ token: CLIENT_TOKEN as string });
        initialized = true;
      }
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: { email: userEmail },
        customData: { user_id: userId },
      });
    } catch {
      // Initialize() throws on a malformed or revoked token. Reset the flag so
      // a retry re-initialises rather than opening against a broken instance.
      initialized = false;
      setError('Checkout could not start. Please try again, or contact support if it persists.');
    }
  }

  return (
    <div className="space-y-1.5">
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        onLoad={() => setLoaded(true)}
        onError={() =>
          setError('Checkout could not load. Disable your ad blocker for paddle.com and try again.')
        }
      />
      <Button
        variant={variant}
        size="sm"
        onClick={openCheckout}
        disabled={!loaded && !error}
        loading={!loaded && !error}
      >
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
