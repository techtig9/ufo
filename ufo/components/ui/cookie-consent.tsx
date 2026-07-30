'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from './button';

const STORAGE_KEY = 'ufo-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function choose(value: 'accepted' | 'rejected') {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
    // Wire this up to your analytics tool's consent API (e.g. gtag('consent', 'update', ...))
    // once analytics is connected — see the Launch Checklist in README.md.
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl animate-fade-up rounded-panel border border-line bg-ink-soft/95 p-4 shadow-lift backdrop-blur-sm sm:inset-x-auto sm:right-4">
      <p className="text-sm text-white/70">
        We use cookies for login sessions and basic analytics. See our{' '}
        <Link href="/legal/cookies" className="text-studio-citron hover:underline">
          Cookie Policy
        </Link>
        .
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => choose('accepted')}>Accept</Button>
        <Button size="sm" variant="secondary" onClick={() => choose('rejected')}>
          Reject non-essential
        </Button>
      </div>
    </div>
  );
}
