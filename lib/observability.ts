import { redactFields } from './redact';

/**
 * Structured logging, request correlation and error reporting.
 *
 * Three things the Master Command asks for in Phase 5.C, built so they work
 * with or without a vendor:
 *
 *   * every line is JSON with a `scope` and a `requestId`, so a platform log
 *     search can pull one request's whole story out of an interleaved stream;
 *   * every string is scrubbed through lib/redact before it is written;
 *   * `reportError` hands the error to Sentry when Sentry is present, and
 *     always writes the structured line. It does NOT import a vendor SDK —
 *     see the note on that function.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * The header a request id travels on. Set by the proxy/middleware, echoed on
 * the response, and read by route handlers — so a user reporting "it failed,
 * here's the reference" can be matched to the exact lines.
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Short, unique, and visibly not a user id. */
export function newRequestId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/**
 * The incoming request id, or a fresh one.
 *
 * A caller-supplied id is accepted only if it looks like one: it ends up in
 * logs, and an unbounded value from the internet is a log-injection vector.
 */
export function requestIdFrom(headers: Headers | { get(name: string): string | null }): string {
  const supplied = headers.get(REQUEST_ID_HEADER);
  if (supplied && /^[A-Za-z0-9_-]{6,64}$/.test(supplied)) return supplied;
  return newRequestId();
}

export interface LogFields {
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  outcome?: 'ok' | 'failed';
  [key: string]: unknown;
}

/**
 * Emit one structured line.
 *
 * Server-side only. Deliberately console-based: on every platform UFO can be
 * deployed to, stdout/stderr IS the log pipeline, and a logger that buffers or
 * ships its own lines is a source of lost output during a crash — which is
 * exactly when the lines matter.
 */
export function log(level: LogLevel, scope: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    scope,
    ts: new Date().toISOString(),
    ...redactFields(fields),
  });

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Report an exception.
 *
 * The Master Command asks for "Sentry or equivalent". No SDK is added as a
 * dependency, for a reason worth stating: Sentry has to be initialised with a
 * DSN and a runtime config that cannot be tested here, and a half-wired SDK
 * that silently drops events is worse than an honest console line, because it
 * looks like error tracking is working.
 *
 * Instead this looks for a Sentry-compatible global at call time. Install
 * @sentry/nextjs and initialise it in instrumentation.ts and every
 * reportError() call starts flowing to it, with no change here. Until then the
 * structured line is the record — and it is a real one.
 */
export function reportError(
  error: unknown,
  scope: string,
  fields: LogFields = {}
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  log('error', scope, {
    ...fields,
    outcome: 'failed',
    errorMessage: message,
    // The stack is the one field that can carry file paths and, in a template
    // literal, interpolated values — so it is scrubbed like everything else and
    // capped, because a log line nobody can read is a log line nobody reads.
    errorStack: stack?.split('\n').slice(0, 8).join(' | ').slice(0, 2000),
  });

  const sentry = (globalThis as { Sentry?: { captureException?: (e: unknown, c?: unknown) => void } })
    .Sentry;
  if (typeof sentry?.captureException === 'function') {
    try {
      sentry.captureException(error, { tags: { scope }, extra: redactFields(fields) });
    } catch {
      // Error reporting must never be the thing that breaks a request.
    }
  }
}

/**
 * Time an operation and log its outcome either way.
 *
 * Returns whatever the operation returns and re-throws what it throws — so
 * wrapping a call changes its observability, never its behaviour.
 */
export async function timed<T>(
  scope: string,
  fields: LogFields,
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    log('info', scope, { ...fields, outcome: 'ok', durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    reportError(error, scope, { ...fields, durationMs: Date.now() - startedAt });
    throw error;
  }
}

/**
 * Wrap an API route handler so every request is correlated, timed and logged,
 * and so a thrown error becomes a 500 with a reference rather than an
 * unhandled rejection.
 *
 * Why a wrapper rather than widening the middleware matcher: middleware
 * currently matches only /dashboard and /admin, and extending it to /api would
 * run a Supabase session lookup on every API call — including the webhook and
 * health endpoints, which have no session and cannot afford the latency.
 *
 * The request id is taken from the incoming header when a proxy already set
 * one, so a trace started upstream is not broken here, and is echoed on the
 * response so a user can quote it in a support request.
 */
export function withObservability<A extends unknown[]>(
  scope: string,
  handler: (request: Request, ...args: A) => Promise<Response>
): (request: Request, ...args: A) => Promise<Response> {
  return async (request: Request, ...args: A): Promise<Response> => {
    const requestId = requestIdFrom(request.headers);
    const startedAt = Date.now();
    const route = new URL(request.url).pathname;
    const method = request.method;

    try {
      const response = await handler(request, ...args);
      log(response.status >= 500 ? 'error' : 'info', scope, {
        requestId,
        route,
        method,
        status: response.status,
        durationMs: Date.now() - startedAt,
        outcome: response.status < 400 ? 'ok' : 'failed',
      });

      // Headers on a Response are immutable once constructed, so the id is
      // attached to a clone rather than mutated in place.
      const headers = new Headers(response.headers);
      headers.set(REQUEST_ID_HEADER, requestId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      reportError(error, scope, { requestId, route, method });
      // The reference is returned; the error itself is not. An unhandled
      // exception's message can carry connection strings and schema details.
      return new Response(
        JSON.stringify({
          error: 'Something went wrong on our side. Please try again.',
          requestId,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', [REQUEST_ID_HEADER]: requestId },
        }
      );
    }
  };
}
