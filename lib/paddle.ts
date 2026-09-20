import crypto from 'crypto';

/**
 * Verifies a Paddle Billing webhook signature (the `Paddle-Signature`
 * header: `ts=...;h1=...`) against the raw request body using
 * PADDLE_WEBHOOK_SECRET. Always verify against the raw body string, never
 * a re-serialized JSON.parse'd version — re-serialization can change byte
 * output and break the HMAC check.
 */
export function verifyPaddleSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !process.env.PADDLE_WEBHOOK_SECRET) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(';').map((p) => p.split('=') as [string, string])
  );
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  const signedPayload = `${ts}:${rawBody}`;
  const expected = crypto
    .createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(h1));
  } catch {
    return false; // length mismatch etc.
  }
}

/**
 * Every Paddle price that maps to a plan, monthly and yearly alike.
 *
 * The yearly ids matter here more than anywhere else: a customer who buys an
 * annual subscription sends a webhook carrying the ANNUAL price id, and if this
 * map does not know it, `plan` comes back undefined and they are charged
 * without being upgraded. Unset variables collapse to '' and are stripped
 * below, so an id is never accidentally mapped to the empty string.
 */
export const PADDLE_PRICE_TO_PLAN: Record<string, 'starter' | 'pro' | 'business'> =
  Object.fromEntries(
    (
      [
        [process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER, 'starter'],
        [process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO, 'pro'],
        [process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS, 'business'],
        [process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEARLY, 'starter'],
        [process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY, 'pro'],
        [process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_YEARLY, 'business'],
      ] as const
    ).filter((entry): entry is readonly [string, 'starter' | 'pro' | 'business'] =>
      Boolean(entry[0])
    )
  );
