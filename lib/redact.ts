/**
 * Credential scrubbing for anything that reaches a log.
 *
 * Pure module, no imports, so it can be unit-tested and used from anywhere —
 * including the edge runtime.
 *
 * This started life inside lib/auth-log.ts. It was extracted because the same
 * guarantee is needed by every structured log line, not just the auth ones, and
 * because a bug in it should only ever have to be fixed once: the original
 * pattern required a HYPHEN after a prefix (`sb[ap]-`), while Supabase's own
 * tokens use an underscore, so every `sbp_…` personal access token would have
 * been written to the platform log verbatim.
 */

/**
 * Shapes that indicate a credential rather than a message.
 *
 *   eyJ…                    a JWT (Supabase anon/service keys, access tokens)
 *   sbp_ / sba_ / sbp-…     Supabase personal access tokens
 *   sb_secret_ / sb_publishable_   the newer Supabase API keys
 *   sk-… / sk_…             OpenAI-style and Stripe-style secret keys
 *   gsk_…                   Groq
 *   pdl_… / ntfset_…        Paddle
 *   re_…                    Resend
 *   bearer <anything>       an Authorization header pasted into a message
 */
export const SECRET_SHAPED =
  /(eyJ[A-Za-z0-9_-]{10,})|(sb[ap][-_][A-Za-z0-9_-]{10,})|(sb_(secret|publishable)_[A-Za-z0-9_-]{10,})|(sk[-_][A-Za-z0-9_-]{10,})|(gsk_[A-Za-z0-9_-]{10,})|(pdl_[A-Za-z0-9_-]{10,})|(ntfset_[A-Za-z0-9_-]{10,})|(re_[A-Za-z0-9_-]{10,})|(bearer\s+\S+)/i;

/** `[redacted]` when the value looks like a credential, otherwise unchanged. */
export function redact(value: string): string {
  return SECRET_SHAPED.test(value) ? '[redacted]' : value;
}

/**
 * Redact every string in a shallow record.
 *
 * Shallow on purpose: a logger should be given flat, named fields. Anything
 * that needs a nested object is being asked to log more than it should.
 */
export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    safe[key] = typeof value === 'string' ? redact(value) : value;
  }
  return safe;
}
