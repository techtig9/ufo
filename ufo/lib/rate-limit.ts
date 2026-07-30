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
