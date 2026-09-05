/**
 * Structured, secret-free logging for the authentication flow.
 *
 * The Master Command requires instrumenting the OAuth callback with logs
 * around: OAuth start, callback received, code exchange, user id, user upsert,
 * subscription lookup, subscription creation, email result and final redirect —
 * and explicitly forbids logging passwords, access tokens, OAuth secrets, API
 * keys or full session tokens.
 *
 * The reason this exists as a module rather than scattered console.log calls:
 * the whole point of the instrumentation is to diagnose a *failed* login, and
 * the failure paths are exactly where it is easiest to log the authorization
 * code or a token by accident. Everything here goes through one funnel that
 * drops unknown fields, so a value can only be logged if it was deliberately
 * named as safe.
 */

/** Fields that may be logged. Anything not on this list is dropped. */
interface AuthLogFields {
  /** Correlates every line of one authentication attempt. */
  requestId?: string;
  step?: string;
  /** A Supabase user UUID is an internal identifier, not a credential. */
  userId?: string;
  /** Whether a value was present — never the value itself. */
  hasCode?: boolean;
  isFirstSignIn?: boolean;
  provider?: string;
  /** Where the user was ultimately sent (already passed through safeRedirectPath). */
  redirectTo?: string;
  /** Whether the requested `next` was rejected as unsafe. */
  redirectWasRewritten?: boolean;
  /** Supabase error *message*, which does not contain the code or a token. */
  errorMessage?: string;
  errorCode?: string;
  outcome?: 'ok' | 'failed';
  emailStatus?: string;
  durationMs?: number;
}

const ALLOWED_FIELDS: (keyof AuthLogFields)[] = [
  'requestId',
  'step',
  'userId',
  'hasCode',
  'isFirstSignIn',
  'provider',
  'redirectTo',
  'redirectWasRewritten',
  'errorMessage',
  'errorCode',
  'outcome',
  'emailStatus',
  'durationMs',
];

/**
 * Belt-and-braces: even an allow-listed field must not carry something that
 * looks like a credential. `errorMessage` comes from Supabase and is the one
 * field whose content we do not fully control.
 *
 * The separator after a prefix is `[-_]`, not `-`. Supabase's own tokens use an
 * underscore — `sbp_…` for a personal access token, `sb_secret_…` and
 * `sb_publishable_…` for the newer API keys — so a hyphen-only pattern let
 * every one of them through. Legacy anon/service keys are JWTs and are caught
 * by the `eyJ` branch.
 */
const SECRET_SHAPED =
  /(eyJ[A-Za-z0-9_-]{10,})|(sb[ap][-_][A-Za-z0-9_-]{10,})|(sb_(secret|publishable)_[A-Za-z0-9_-]{10,})|(sk[-_][A-Za-z0-9_-]{10,})|(bearer\s+\S+)/i;

function scrub(value: string): string {
  return SECRET_SHAPED.test(value) ? '[redacted]' : value;
}

export function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Emits one structured line. Server-side only — these lines are for the
 * platform log, never for the browser.
 */
export function logAuthStep(fields: AuthLogFields): void {
  const safe: Record<string, unknown> = { scope: 'auth' };

  for (const key of ALLOWED_FIELDS) {
    const value = fields[key];
    if (value === undefined) continue;
    safe[key] = typeof value === 'string' ? scrub(value) : value;
  }

  const line = JSON.stringify(safe);
  if (fields.outcome === 'failed') {
    console.error(line);
  } else {
    console.log(line);
  }
}
