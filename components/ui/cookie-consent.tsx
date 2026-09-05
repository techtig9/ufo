'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from './button';
import { useClientValue } from '@/lib/use-client-value';

const STORAGE_KEY = 'ufo-cookie-consent';

function hasStoredChoice(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // Private mode / storage blocked — treat as "no choice recorded yet".
    return false;
  }
}

export function CookieConsent() {
  // Server-side we assume a choice exists, so the banner never flashes during
  // SSR — matching the previous behaviour of starting hidden.
  const alreadyChosen = useClientValue(hasStoredChoice, true);
  const [chosenThisSession, setChosenThisSession] = useState(false);
  const visible = !alreadyChosen && !chosenThisSession;

  function choose(value: 'accepted' | 'rejected') {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage blocked — the banner still dismisses for this session.
    }
    setChosenThisSession(true);
    // Nothing else to signal: the only cookies UFO sets are the Supabase auth
    // session, the theme preference, and a share-link grant after a password is
    // entered — all strictly necessary or user-chosen. If a third-party
    // analytics tool is ever added, its consent API is called from here.
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl animate-fade-up rounded-panel border border-edge bg-elevated p-4 shadow-lift backdrop-blur-sm sm:inset-x-auto sm:right-4">
      <p className="text-sm text-fg-secondary">
        {/* Says only what is true today. UFO runs no third-party analytics and
            sets no analytics cookie: prototype view counts are recorded
            server-side and store nothing that identifies a viewer. */}
        We use cookies to keep you signed in and to remember your preferences. We do not use
        advertising or third-party analytics cookies. See our{' '}
        <Link href="/legal/cookies" className="text-brand-text hover:underline">
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
