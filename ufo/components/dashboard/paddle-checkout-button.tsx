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

  function openCheckout() {
    if (!window.Paddle) return;
    if (!initialized) {
      window.Paddle.Initialize({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN! });
      initialized = true;
    }
    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: userEmail },
      customData: { user_id: userId },
    });
  }

  return (
    <>
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" onLoad={() => setLoaded(true)} />
      <Button variant={variant} size="sm" onClick={openCheckout} disabled={!loaded}>
        {label}
      </Button>
    </>
  );
}
