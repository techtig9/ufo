import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Password protection for share links.
 *
 * Deliberately NOT a user-password scheme. A share password is a short secret
 * typed by whoever holds the link, and the threat model is "a stranger with the
 * URL guesses it", not "an attacker with the database recovers it and reuses it
 * elsewhere" — nobody reuses a prototype link password on their bank.
 *
 * It is still salted and stretched rather than stored in the clear, because a
 * database leak should not reveal what the owner chose, and people do reuse
 * passwords even where they shouldn't.
 *
 * PBKDF2-SHA256 via Node's crypto rather than bcrypt: no native dependency, and
 * the iteration count is tuned so verification stays fast enough that a share
 * page does not feel slow while still being far too slow to brute-force at
 * scale.
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

function pbkdf2(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

/** Encoded as `pbkdf2$<iterations>$<saltB64>$<hashB64>` so it can be upgraded later. */
export function hashSharePassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2(password, salt);
  return `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifySharePassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[2], 'base64');
    expected = Buffer.from(parts[3], 'base64');
  } catch {
    return false;
  }

  const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * A short-lived, signed grant proving a visitor answered the password, so they
 * are not asked again on every screen. Bound to one share id.
 */
const GRANT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function grantSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'ufo-fallback-share-secret';
}

export function issueShareGrant(shareId: string): string {
  const expires = Date.now() + GRANT_TTL_MS;
  const payload = `${shareId}.${expires}`;
  const sig = createHash('sha256').update(`${grantSecret()}:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyShareGrant(grant: string | undefined, shareId: string): boolean {
  if (!grant) return false;
  const parts = grant.split('.');
  if (parts.length !== 3) return false;

  const [id, expiresRaw, sig] = parts;
  if (id !== shareId) return false;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;

  const expected = createHash('sha256')
    .update(`${grantSecret()}:${id}.${expiresRaw}`)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const SHARE_GRANT_COOKIE_PREFIX = 'ufo-share-';
