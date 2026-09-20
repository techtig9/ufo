import type { z } from 'zod';

/**
 * Read and validate a JSON request body.
 *
 * Two problems this solves, both of which were spread across the route
 * handlers in slightly different shapes:
 *
 *  1. `await request.json()` THROWS on a malformed body. Nine routes called it
 *     bare, so sending `{` returned a 500 — an error page, an entry in the
 *     error log, and a client told "something went wrong on our end" when the
 *     mistake was theirs. It is a 400.
 *
 *  2. Validation was hand-rolled per route. The hand-rolled checks that exist
 *     are correct, but each new route is a fresh chance to forget one.
 *
 * The failure branch carries a plain `Response`, not a `NextResponse`. A route
 * handler may return either, and avoiding the `next/server` import keeps this
 * module loadable by the unit test runner — a validation helper that cannot be
 * tested in isolation is one nobody writes edge cases for.
 *
 * Returns a discriminated union rather than throwing, so a handler deals with
 * the failure in the same `if` it would use for any other guard clause:
 *
 *     const body = await readJson(request, schema);
 *     if (!body.ok) return body.response;
 *     // body.data is typed
 */
export type ReadJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

export async function readJson<S extends z.ZodTypeAny>(
  request: Request,
  schema: S
): Promise<ReadJsonResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: badRequest('Request body was not valid JSON.') };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: badRequest(describe(parsed.error)) };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Turn a zod error into one sentence a person can act on.
 *
 * Deliberately names the field and what is wrong with it, and deliberately
 * does NOT echo the received value: a rejected body can contain a password, a
 * token or someone else's email, and an error message is the easiest thing in
 * a system to end up in a log, a bug report or a screenshot.
 */
function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'That request was not valid.';

  const field = issue.path.filter((p) => typeof p === 'string' || typeof p === 'number').join('.');
  const where = field ? `"${field}"` : 'The request body';

  switch (issue.code) {
    case 'invalid_type':
      return `${where} is missing or has the wrong type.`;
    case 'too_big':
      return `${where} is too long.`;
    case 'too_small':
      return `${where} is required.`;
    default:
      return `${where} is not valid.`;
  }
}
