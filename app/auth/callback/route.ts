import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import { recordReferral } from '@/lib/referral';
import { recordAuthEvent, ipPrefixOf, userAgentSummaryOf } from '@/lib/auth-events';
import { safeRedirectPath, DEFAULT_POST_AUTH_PATH } from '@/lib/safe-redirect';
import { logAuthStep, newRequestId } from '@/lib/auth-log';

/**
 * OAuth / email-confirmation callback.
 *
 * The reported "Continue with Google shows a white page" was produced here.
 * The previous version ran its redirect unconditionally — outside both the
 * `if (code)` and the `if (!error && data.user)` blocks — so when the code
 * exchange failed (misconfigured Google client, wrong Supabase redirect URL,
 * provider disabled) the route swallowed the error and redirected to
 * /dashboard anyway. Middleware then found no session and bounced to /login.
 * The user saw a flash and landed back where they started, with no error shown
 * and nothing logged, which is indistinguishable from "nothing happened".
 *
 * Now: every failure path redirects to /login with a specific, user-readable
 * reason, and every step is logged through lib/auth-log (allow-listed fields
 * only — never the code, a token, or a session).
 */

/** Maps an internal failure to a short code the login page renders as a message. */
type FailureCode =
  | 'oauth_provider_error'
  | 'missing_code'
  | 'exchange_failed'
  | 'provisioning_failed';

function failureRedirect(origin: string, next: string, code: FailureCode, requestId: string) {
  const url = new URL('/login', origin);
  url.searchParams.set('error', code);
  // Carried through so the user lands where they were headed after retrying.
  if (next !== DEFAULT_POST_AUTH_PATH) url.searchParams.set('next', next);
  // Surfaced in the UI so a support request can be correlated with the logs.
  url.searchParams.set('ref', requestId);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestId = newRequestId();
  const startedAt = Date.now();
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');
  const next = safeRedirectPath(rawNext);
  const referralCode = searchParams.get('ref');

  const context = {
    ipPrefix: ipPrefixOf(request.headers.get('x-forwarded-for')),
    userAgentSummary: userAgentSummaryOf(request.headers.get('user-agent')),
  };

  logAuthStep({
    requestId,
    step: 'callback_received',
    hasCode: !!code,
    redirectTo: next,
    redirectWasRewritten: !!rawNext && rawNext !== next,
  });

  // The provider itself refused (consent denied, misconfigured client). Supabase
  // forwards these as query params rather than a code.
  const providerError = searchParams.get('error') || searchParams.get('error_description');
  if (providerError) {
    logAuthStep({
      requestId,
      step: 'provider_error',
      outcome: 'failed',
      errorMessage: providerError,
    });
    return failureRedirect(origin, next, 'oauth_provider_error', requestId);
  }

  if (!code) {
    // Previously this fell straight through to the redirect below, producing
    // the silent bounce. A callback with no code is always a failure.
    logAuthStep({ requestId, step: 'missing_code', outcome: 'failed' });
    return failureRedirect(origin, next, 'missing_code', requestId);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.user) {
    logAuthStep({
      requestId,
      step: 'code_exchange',
      outcome: 'failed',
      errorMessage: error?.message,
      errorCode: error?.code,
    });
    return failureRedirect(origin, next, 'exchange_failed', requestId);
  }

  const user = data.user;
  logAuthStep({ requestId, step: 'code_exchange', outcome: 'ok', userId: user.id });

  // Which provider actually authenticated this session — drives the event type
  // and therefore the wording of the security email.
  const provider = user.app_metadata?.provider ?? 'email';

  try {
    const admin = createAdminClient();
    const name =
      user.user_metadata?.name ?? user.user_metadata?.full_name ?? null;

    const { error: upsertError } = await admin
      .from('users')
      .upsert(
        { id: user.id, email: user.email!, name },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (upsertError) throw new Error(`user upsert: ${upsertError.message}`);
    logAuthStep({ requestId, step: 'user_upsert', outcome: 'ok', userId: user.id });

    const { data: existingSub, error: subLookupError } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subLookupError) throw new Error(`subscription lookup: ${subLookupError.message}`);

    const isFirstSignIn = !existingSub;
    logAuthStep({
      requestId,
      step: 'subscription_lookup',
      outcome: 'ok',
      userId: user.id,
      isFirstSignIn,
    });

    if (isFirstSignIn) {
      const { error: subInsertError } = await admin.from('subscriptions').insert({
        user_id: user.id,
        plan: 'free',
        status: 'active',
        credits_remaining: PLAN_MONTHLY_CREDITS.free,
      });
      if (subInsertError) throw new Error(`subscription create: ${subInsertError.message}`);
      logAuthStep({ requestId, step: 'subscription_created', outcome: 'ok', userId: user.id });

      // Only on a genuine first sign-in — a returning user clicking an old
      // referral link must not retroactively attach a referral.
      if (referralCode) {
        await recordReferral(user.id, referralCode);
        logAuthStep({ requestId, step: 'referral_recorded', outcome: 'ok', userId: user.id });
      }
    }

    // Notification. Never allowed to fail the sign-in that already succeeded.
    try {
      const result = await recordAuthEvent({
        userId: user.id,
        email: user.email!,
        name,
        // A first sign-in gets the onboarding welcome; a returning user gets
        // the security alert for the provider they actually used.
        type: isFirstSignIn
          ? 'SIGNUP'
          : provider === 'google'
            ? 'GOOGLE_SIGN_IN'
            : 'EMAIL_VERIFIED',
        context,
        sendWelcomeInstead: isFirstSignIn,
      });
      logAuthStep({
        requestId,
        step: 'auth_event',
        outcome: 'ok',
        userId: user.id,
        provider,
        emailStatus: result.recorded ? result.emailStatus : 'duplicate_suppressed',
      });
    } catch (notifyError) {
      logAuthStep({
        requestId,
        step: 'auth_event',
        outcome: 'failed',
        userId: user.id,
        errorMessage: notifyError instanceof Error ? notifyError.message : 'unknown',
      });
    }
  } catch (provisioningError) {
    // The session exists but the account is half-built. Sending the user to
    // the dashboard here would produce confusing downstream failures (no
    // subscription row means every generation route 400s), so fail loudly.
    logAuthStep({
      requestId,
      step: 'provisioning',
      outcome: 'failed',
      userId: user.id,
      errorMessage:
        provisioningError instanceof Error ? provisioningError.message : 'unknown',
    });
    return failureRedirect(origin, next, 'provisioning_failed', requestId);
  }

  logAuthStep({
    requestId,
    step: 'redirect',
    outcome: 'ok',
    userId: user.id,
    provider,
    redirectTo: next,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.redirect(new URL(next, origin));
}
