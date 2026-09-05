import { createHash } from 'crypto';
import { createAdminClient } from './supabase/admin';

/**
 * DB-backed rate limiting. An in-memory counter doesn't work here — each
 * serverless invocation can land on a different instance, so it would
 * silently under-count. This trades a little latency (one count query, one
 * insert) for correctness. Also doubles as the audit-log write for
 * /admin/activity — see request_log in supabase/schema.sql Section 3.
 */
export async function checkRateLimit(
  userId: string,
  route: string,
  limit: number,
  windowSeconds: number,
  meta?: Record<string, unknown>
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await admin
    .from('request_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('route', route)
    .gte('created_at', since);

  if ((count ?? 0) >= limit) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  await admin.from('request_log').insert({ user_id: userId, route, meta });
  return { allowed: true };
}

/**
 * Rate limit for endpoints that legitimately accept unauthenticated callers
 * (contact form, prototype comments, password-reset notification).
 *
 * checkRateLimit above keys on a user id, which those endpoints do not have.
 * This keys on a salted hash of the client IP instead: a raw IP is personal
 * data and there is no reason to retain one to count requests. The salt is the
 * service-role key, which is already a server-only secret, so the hashes are
 * not reversible via a precomputed table of the IPv4 space.
 *
 * Reuses the same request_log table, with user_id left null.
 */
export async function checkAnonymousRateLimit(
  clientIp: string | null,
  route: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'ufo-fallback-salt';
  const ipHash = createHash('sha256')
    .update(`${salt}:${clientIp ?? 'unknown'}`)
    .digest('hex')
    .slice(0, 32);

  const { count } = await admin
    .from('request_log')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null)
    .eq('route', route)
    .contains('meta', { ip_hash: ipHash })
    .gte('created_at', since);

  if ((count ?? 0) >= limit) {
    return { allowed: false, retryAfterSeconds: windowSeconds };
  }

  await admin.from('request_log').insert({ user_id: null, route, meta: { ip_hash: ipHash } });
  return { allowed: true };
}

/** First hop in X-Forwarded-For, which is the client as far as the proxy is concerned. */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || null;
  return headers.get('x-real-ip');
}
