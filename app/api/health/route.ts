import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PROVIDER_CASCADE } from '@/lib/ai/providers';
import { REQUEST_ID_HEADER, log, requestIdFrom } from '@/lib/observability';

/**
 * Health and readiness.
 *
 * Unauthenticated by design — an uptime monitor cannot hold a session — which
 * is exactly why it reports STATUS ONLY. No error text, no schema detail, no
 * hostnames, no key material, and no count of anything a competitor would find
 * interesting. Operators get the detail from the structured log line this
 * writes, correlated by the same request id it returns.
 *
 * `degraded` rather than `down` when a dependency is unhealthy but the app can
 * still serve: an uptime check that pages at 3am for a warning is a check that
 * gets muted.
 */

export const dynamic = 'force-dynamic';

type ComponentStatus = 'ok' | 'degraded' | 'down' | 'not_configured';

/**
 * How long the database check may take before it is called down.
 *
 * A health endpoint that hangs is worse than one that reports a failure: the
 * uptime monitor times out and records an ambiguous error instead of a clear
 * "database unreachable". Measured against an unreachable host, the underlying
 * client took ~7s to give up — well past most monitors' own timeout.
 */
const DB_CHECK_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<{ status: ComponentStatus; latencyMs: number; detail?: string }> {
  const startedAt = Date.now();
  try {
    const admin = createAdminClient();
    const query = admin.from('users').select('id').limit(1);
    const { error, timedOut } = await Promise.race([
      query.then((r) => ({ error: r.error, timedOut: false })),
      new Promise<{ error: null; timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ error: null, timedOut: true }), DB_CHECK_TIMEOUT_MS)
      ),
    ]);

    const elapsed = Date.now() - startedAt;
    if (timedOut) {
      return { status: 'down', latencyMs: elapsed, detail: `no response within ${DB_CHECK_TIMEOUT_MS}ms` };
    }

    const latencyMs = elapsed;
    if (error) return { status: 'down', latencyMs, detail: error.message };
    // A database that answers but slowly is a real signal — it is what a
    // connection-pool exhaustion looks like before it becomes an outage.
    return { status: latencyMs > 2000 ? 'degraded' : 'ok', latencyMs };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - startedAt,
      detail: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/**
 * Which AI providers are configured. Deliberately NOT a live call — health
 * checks run often, and probing four paid APIs on every poll would cost money
 * and add latency for no operational benefit. Real provider health comes from
 * the `ai_requests` table, which records the outcome of every actual call and
 * is what the admin provider-health page reads.
 */
function checkProviders(): { configured: number; total: number; status: ComponentStatus } {
  const configured = PROVIDER_CASCADE.filter((p) => p.isConfigured()).length;
  return {
    configured,
    total: PROVIDER_CASCADE.length,
    // One configured provider is enough to serve; none means generation is
    // dead, which is an outage of the product's core feature.
    status: configured === 0 ? 'down' : configured < PROVIDER_CASCADE.length ? 'degraded' : 'ok',
  };
}

function checkEmail(): ComponentStatus {
  return process.env.RESEND_API_KEY ? 'ok' : 'not_configured';
}

function checkBilling(): ComponentStatus {
  return process.env.PADDLE_WEBHOOK_SECRET ? 'ok' : 'not_configured';
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  const startedAt = Date.now();

  const database = await checkDatabase();
  const providers = checkProviders();
  const email = checkEmail();
  const billing = checkBilling();

  // The overall verdict is driven by what stops the product working. A missing
  // Resend key degrades; a missing database is down.
  const worst: ComponentStatus =
    database.status === 'down' || providers.status === 'down'
      ? 'down'
      : database.status === 'degraded' || providers.status === 'degraded' || email === 'not_configured' || billing === 'not_configured'
        ? 'degraded'
        : 'ok';

  // The detail — including any database error message — goes to the log, never
  // to the response.
  log(worst === 'ok' ? 'info' : 'warn', 'health', {
    requestId,
    // Not `status`: that field means HTTP status everywhere else in the log,
    // and one field with two meanings makes a log search lie.
    healthStatus: worst,
    dbStatus: database.status,
    dbLatencyMs: database.latencyMs,
    dbError: database.detail,
    providersConfigured: providers.configured,
    emailStatus: email,
    billingStatus: billing,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json(
    {
      status: worst,
      time: new Date().toISOString(),
      requestId,
      components: {
        database: { status: database.status, latencyMs: database.latencyMs },
        ai: { status: providers.status, configured: providers.configured, total: providers.total },
        email: { status: email },
        billing: { status: billing },
      },
    },
    {
      // 'down' is the only state an uptime monitor should page on.
      status: worst === 'down' ? 503 : 200,
      headers: { [REQUEST_ID_HEADER]: requestId, 'Cache-Control': 'no-store' },
    }
  );
}
