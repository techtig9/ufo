'use client';

import type { AuthEventType } from './auth-events';

/**
 * Fire-and-forget report of an authentication event from the browser.
 *
 * Authentication happens client-side via supabase-js, so the server only finds
 * out if we tell it. Deliberately never awaited by the caller in a way that can
 * delay the redirect, and never surfaces an error: a missed security email must
 * not turn a successful sign-in into a visible failure. Server-side dedup means
 * calling this more than once for a single sign-in is harmless.
 */
export function reportAuthEvent(type: AuthEventType, email?: string): void {
  void fetch('/api/auth/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { type, email } : { type }),
    keepalive: true,
  }).catch(() => undefined);
}
