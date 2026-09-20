'use client';

import { usePathname } from 'next/navigation';
import { FeedbackWidget } from './feedback-widget';

/**
 * The feedback widget is for signed-in product surfaces only.
 *
 * `/api/feedback` requires a session, so showing the trigger on the marketing
 * site would be a button that 401s — the marketing site has /contact for that.
 * Public prototype pages are excluded too: those are someone else's client
 * looking at someone else's work, and a UFO feedback button there is both
 * confusing and off-brand for the person who shared it.
 */
const SHOWN_PREFIXES = ['/dashboard', '/admin'];

export function FeedbackGate() {
  const pathname = usePathname();
  if (!SHOWN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <FeedbackWidget />;
}
