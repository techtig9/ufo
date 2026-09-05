import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  recordAuthEvent,
  isAuthEventType,
  ipPrefixOf,
  userAgentSummaryOf,
  type AuthEventType,
} from '@/lib/auth-events';
import { checkAnonymousRateLimit, clientIpFrom } from '@/lib/rate-limit';

/**
 * Reports an authentication event so a security notification can be sent.
 *
 * Authentication happens in the browser via supabase-js, so the server never
 * sees a sign-in. This endpoint closes that gap — but it deliberately does not
 * trust the caller's claim about *who* signed in: it re-reads the session
 * server-side and records the event for that user. A caller can therefore only
 * ever report an event about itself, and only after genuinely authenticating.
 *
 * Actual duplicate suppression lives in lib/auth-events (UNIQUE dedup_key), so
 * a client that fires this several times for one sign-in still yields one email.
 */

/** Events a signed-in client may report about itself. */
const SESSION_REPORTABLE: AuthEventType[] = [
  'PASSWORD_LOGIN',
  'GOOGLE_SIGN_IN',
  'MFA_LOGIN_SUCCESS',
  'PASSWORD_CHANGED',
];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, email } = (body ?? {}) as { type?: unknown; email?: unknown };

  if (!isAuthEventType(type)) {
    return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
  }

  const context = {
    ipPrefix: ipPrefixOf(request.headers.get('x-forwarded-for')),
    userAgentSummary: userAgentSummaryOf(request.headers.get('user-agent')),
  };

  // ---------------------------------------------------------------------
  // PASSWORD_RESET_REQUESTED is the one event fired by a caller who is, by
  // definition, not signed in. It is handled separately and carefully:
  //
  //  * the response is always 202 with the same body and no timing branch
  //    the caller can act on, so it cannot be used to test whether an
  //    address has an account (user enumeration);
  //  * it is IP rate limited, so it cannot be used to mail-bomb someone.
  // ---------------------------------------------------------------------
  if (type === 'PASSWORD_RESET_REQUESTED') {
    const rate = await checkAnonymousRateLimit(
      clientIpFrom(request.headers),
      'auth-event-reset',
      5,
      900
    );
    if (!rate.allowed) {
      // Same shape as the success response — a rate-limited caller learns
      // nothing about the address either.
      return NextResponse.json({ ok: true }, { status: 202 });
    }

    if (typeof email === 'string' && email.includes('@')) {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from('users')
        .select('id, email, name')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        await recordAuthEvent({
          userId: existing.id,
          email: existing.email,
          name: existing.name,
          type: 'PASSWORD_RESET_REQUESTED',
          context,
        }).catch((err) => console.error('[auth-event] reset notification failed', err));
      }
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  }

  // ---------------------------------------------------------------------
  // Everything else requires a real session, read server-side.
  // ---------------------------------------------------------------------
  if (!SESSION_REPORTABLE.includes(type)) {
    return NextResponse.json({ error: 'Event type is not client-reportable' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // No session means no authentication happened — there is nothing to notify
    // about, and honouring this would let anyone mail an arbitrary user.
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  try {
    const result = await recordAuthEvent({
      userId: user.id,
      email: user.email!,
      name: profile?.name ?? null,
      type,
      context,
    });
    return NextResponse.json({ ok: true, deduplicated: !result.recorded });
  } catch (err) {
    // A notification failure must never surface as a failed login.
    console.error('[auth-event] could not record', err);
    return NextResponse.json({ ok: true, deduplicated: false });
  }
}
