import { createAdminClient } from './supabase/admin';
import { sendSecurityNotificationEmail, sendWelcomeEmail, type EmailStatus } from './email';
import { type AuthEventType, type RequestContext } from './auth-event-types';

// The vocabulary and the pure request-context helpers live in
// ./auth-event-types (no imports, so they are unit-testable and safe to pull
// into a client component). Re-exported here so existing call sites that
// import from '@/lib/auth-events' keep working.
export {
  AUTH_EVENT_TYPES,
  isAuthEventType,
  ipPrefixOf,
  userAgentSummaryOf,
} from './auth-event-types';
export type { AuthEventType, RequestContext } from './auth-event-types';

/**
 * Authentication event recording + security notification email.
 *
 * The Master Command (Phase 1.C) requires a security email on every successful
 * authentication, an explicit user preference defaulting to enabled, and
 * explicitly: "Do NOT send duplicate emails when one authentication flow
 * triggers multiple callbacks."
 *
 * That last constraint is the hard part. One sign-in legitimately produces
 * several signals: signInWithPassword resolves, then the MFA challenge
 * resolves, then a session refresh fires, then a React remount can re-run the
 * reporter. Suppressing that at each call site would be fragile, so instead
 * every event is written to auth_events first and the email is sent only when
 * *this* call is the one that created the row.
 *
 * Dedup is enforced by a UNIQUE dedup_key rather than a read-then-write check,
 * so two concurrent reports collide in the database instead of racing past a
 * SELECT and both sending.
 */

/**
 * Dedup window per event type, in seconds.
 *
 * A login cascade (password -> MFA -> refresh -> remount) completes in well
 * under a minute, so 5 minutes comfortably collapses one authentication into
 * one email while still reporting a genuine second login later in the session.
 * SIGNUP and PASSWORD_CHANGED get a long window because they should only ever
 * happen once per flow.
 */
const DEDUP_WINDOW_SECONDS: Record<AuthEventType, number> = {
  SIGNUP: 86_400,
  EMAIL_VERIFIED: 86_400,
  PASSWORD_LOGIN: 300,
  GOOGLE_SIGN_IN: 300,
  MFA_LOGIN_SUCCESS: 300,
  PASSWORD_RESET_REQUESTED: 900,
  PASSWORD_CHANGED: 900,
};

interface Copy {
  headline: string;
  detail: string;
}

const COPY: Record<AuthEventType, Copy> = {
  SIGNUP: {
    headline: 'Your ufo account was created',
    detail: 'An account was just created with this email address.',
  },
  EMAIL_VERIFIED: {
    headline: 'Your ufo email address was verified',
    detail: 'This email address was just confirmed on your ufo account.',
  },
  PASSWORD_LOGIN: {
    headline: 'New sign-in to your ufo account',
    detail: 'Someone signed in to your ufo account with your email and password.',
  },
  GOOGLE_SIGN_IN: {
    headline: 'New sign-in to your ufo account',
    detail: 'Someone signed in to your ufo account using Continue with Google.',
  },
  MFA_LOGIN_SUCCESS: {
    headline: 'New sign-in to your ufo account',
    detail: 'Someone completed two-factor authentication and signed in to your ufo account.',
  },
  PASSWORD_RESET_REQUESTED: {
    headline: 'Password reset requested for your ufo account',
    detail:
      'A password reset link was requested for your ufo account. If you did not request it, you can ignore this — the link cannot be used unless someone can read your email.',
  },
  PASSWORD_CHANGED: {
    headline: 'Your ufo password was changed',
    detail: 'The password on your ufo account was just changed.',
  },
};

export type RecordResult =
  | { recorded: false; reason: 'duplicate' }
  | { recorded: true; emailStatus: EmailStatus | 'skipped_preference' };

/**
 * Records an authentication event and, if this call created the row and the
 * user has security notifications enabled, sends the notification.
 *
 * Never throws: a notification problem must not be able to fail an
 * authentication that already succeeded.
 */
export async function recordAuthEvent(params: {
  userId: string;
  email: string;
  name?: string | null;
  type: AuthEventType;
  context?: RequestContext;
  /** Send the onboarding welcome email instead of a security alert. */
  sendWelcomeInstead?: boolean;
}): Promise<RecordResult> {
  const { userId, email, name, type, context } = params;
  const admin = createAdminClient();

  const windowSeconds = DEDUP_WINDOW_SECONDS[type];
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const dedupKey = `${userId}:${type}:${bucket}`;

  const { error: insertError } = await admin.from('auth_events').insert({
    user_id: userId,
    event_type: type,
    ip_prefix: context?.ipPrefix ?? null,
    user_agent_summary: context?.userAgentSummary ?? null,
    dedup_key: dedupKey,
    email_status: 'pending',
  });

  if (insertError) {
    // 23505 = unique_violation: another report of this same authentication
    // already claimed the bucket, so it has already sent (or decided not to).
    if (insertError.code === '23505') return { recorded: false, reason: 'duplicate' };
    console.error('[auth-events] could not record event', insertError.message);
    return { recorded: false, reason: 'duplicate' };
  }

  // A time bucket has edges: two reports of one authentication can land either
  // side of a boundary and both insert. A cheap look-back for an already-sent
  // event of the same type closes that gap.
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count: alreadySent } = await admin
    .from('auth_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', type)
    .neq('dedup_key', dedupKey)
    .gte('created_at', since)
    .eq('email_status', 'sent');

  if ((alreadySent ?? 0) > 0) {
    await markStatus(dedupKey, 'skipped_preference');
    return { recorded: false, reason: 'duplicate' };
  }

  const { data: profile } = await admin
    .from('users')
    .select('notify_security_emails')
    .eq('id', userId)
    .maybeSingle();

  // Default to enabled when the column or row is missing, matching the
  // migration's `not null default true`.
  const notificationsEnabled = profile?.notify_security_emails !== false;

  if (!notificationsEnabled && !params.sendWelcomeInstead) {
    await markStatus(dedupKey, 'skipped_preference');
    return { recorded: true, emailStatus: 'skipped_preference' };
  }

  const status = params.sendWelcomeInstead
    ? await sendWelcomeEmail(email, name ?? '', userId)
    : await sendSecurityNotificationEmail(email, {
        headline: COPY[type].headline,
        detail: COPY[type].detail,
        whenIso: new Date().toISOString(),
        context: [context?.userAgentSummary, context?.ipPrefix].filter(Boolean).join(' · ') || undefined,
        eventType: type.toLowerCase(),
        userId,
      });

  await markStatus(dedupKey, status);
  return { recorded: true, emailStatus: status };
}

async function markStatus(dedupKey: string, status: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('auth_events')
    .update({ email_status: status })
    .eq('dedup_key', dedupKey);
  if (error) console.error('[auth-events] could not update email_status', error.message);
}
