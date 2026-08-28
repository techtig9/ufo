'use client';

import Script from 'next/script';
import { useEffect, useId, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
    };
  }
}

/**
 * Renders a Cloudflare Turnstile widget and calls onVerify(token) once
 * solved. Pass that token to Supabase's signUp/signInWithPassword as
 * `options.captchaToken` — but only after enabling Turnstile under
 * Authentication > Bot and Abuse Protection in the Supabase dashboard,
 * with the matching site/secret key pair. Silently renders nothing if
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, so local dev isn't blocked.
 */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  const id = useId().replace(/:/g, '');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!scriptLoaded || !siteKey || !window.turnstile) return;
    window.turnstile.render(`#turnstile-${id}`, {
      sitekey: siteKey,
      theme: 'dark',
      callback: onVerify,
    });
  }, [scriptLoaded, siteKey, id, onVerify]);

  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" onLoad={() => setScriptLoaded(true)} />
      <div id={`turnstile-${id}`} />
    </>
  );
}
