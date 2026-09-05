import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, redactFields } from '../lib/redact.ts';
import {
  REQUEST_ID_HEADER,
  newRequestId,
  requestIdFrom,
  log,
  reportError,
  timed,
  withObservability,
} from '../lib/observability.ts';

/** Capture what the logger writes without letting it reach the real console. */
function capture(run: () => void | Promise<void>): Promise<string[]> {
  const original = { log: console.log, warn: console.warn, error: console.error };
  const lines: string[] = [];
  console.log = console.warn = console.error = (line: string) => { lines.push(line); };
  const restore = () => {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  };
  const result = run();
  if (result instanceof Promise) return result.then(() => { restore(); return lines; }, (e) => { restore(); throw e; });
  restore();
  return Promise.resolve(lines);
}

// ---------------------------------------------------------------------------
// Redaction. Shared by every log line, so a gap here leaks everywhere.
// ---------------------------------------------------------------------------

test('every credential shape UFO handles is redacted', () => {
  for (const secret of [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',          // Supabase JWT
    'sbp_0123456789abcdefghij',                       // Supabase PAT
    'sb_secret_0123456789abcdefghij',                 // newer Supabase key
    'sb_publishable_0123456789abcdefghij',
    'sk-0123456789abcdefghij',                        // OpenAI-style
    'sk_live_0123456789abcdefghij',                   // Stripe-style
    'gsk_0123456789abcdefghij',                       // Groq
    'pdl_ntf_0123456789abcdefghij',                   // Paddle
    'ntfset_0123456789abcdefghij',
    're_0123456789abcdefghij',                        // Resend
    'Bearer abcdefghijklmnopqrs',
  ]) {
    assert.equal(redact(`connection failed: ${secret}`), '[redacted]', secret);
  }
});

test('an ordinary message is not redacted', () => {
  // Over-redaction makes the logs useless for the problem they exist for.
  for (const message of [
    'Invalid login credentials',
    'relation "projects" does not exist',
    'timeout after 30000ms',
    'sk',
    'bearer',
  ]) {
    assert.equal(redact(message), message, message);
  }
});

test('redactFields drops undefined and scrubs strings only', () => {
  const out = redactFields({ a: 'ok', b: undefined, c: 42, d: 'sbp_0123456789abcdefghij', e: true });
  assert.deepEqual(out, { a: 'ok', c: 42, d: '[redacted]', e: true });
});

// ---------------------------------------------------------------------------
// Request correlation.
// ---------------------------------------------------------------------------

test('request ids are unique and compact', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => newRequestId()));
  assert.equal(ids.size, 1000);
  assert.match(newRequestId(), /^[0-9a-f]{12}$/);
});

test('an upstream request id is honoured, so a trace is not broken here', () => {
  const headers = new Headers({ [REQUEST_ID_HEADER]: 'upstream-trace-123' });
  assert.equal(requestIdFrom(headers), 'upstream-trace-123');
});

test('a hostile request id is replaced, not logged', () => {
  // It ends up in a log line, so an unbounded value from the internet is a
  // log-injection vector.
  //
  // Read through a bare `get` rather than a Headers object: the Headers
  // constructor itself refuses a value containing a newline, so the nastiest
  // case cannot even be built that way. That is a second line of defence worth
  // knowing about, but it is not the one under test here — this asserts the
  // validation holds for any header source, including a framework that hands
  // over an already-parsed value.
  for (const bad of [
    'x',                                  // too short
    'a'.repeat(65),                       // too long
    'has spaces',
    'newline\ninjected',
    'carriage\rreturn',
    '{"level":"error","scope":"forged"}',
    '../../etc/passwd',
    '',
  ]) {
    const generated = requestIdFrom({ get: () => bad });
    assert.notEqual(generated, bad, JSON.stringify(bad));
    assert.match(generated, /^[0-9a-f]{12}$/);
  }
});

test('the Headers constructor also refuses a newline, as a second line of defence', () => {
  assert.throws(() => new Headers({ [REQUEST_ID_HEADER]: 'bad\nvalue' }));
});

test('a missing header produces a fresh id', () => {
  assert.match(requestIdFrom(new Headers()), /^[0-9a-f]{12}$/);
});

// ---------------------------------------------------------------------------
// The log line itself.
// ---------------------------------------------------------------------------

test('every line is JSON with a level, scope and timestamp', async () => {
  const [line] = await capture(() => log('info', 'test', { requestId: 'r1' }));
  const parsed = JSON.parse(line);
  assert.equal(parsed.level, 'info');
  assert.equal(parsed.scope, 'test');
  assert.equal(parsed.requestId, 'r1');
  assert.match(parsed.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test('a credential passed to the logger never reaches the line', async () => {
  const [line] = await capture(() =>
    log('error', 'test', { errorMessage: 'boom sbp_0123456789abcdefghij' })
  );
  assert.equal(line.includes('sbp_'), false);
  assert.equal(JSON.parse(line).errorMessage, '[redacted]');
});

test('reportError records the message and a bounded stack', async () => {
  const [line] = await capture(() => reportError(new Error('kaboom'), 'test', { requestId: 'r' }));
  const parsed = JSON.parse(line);
  assert.equal(parsed.errorMessage, 'kaboom');
  assert.equal(parsed.outcome, 'failed');
  assert.ok(parsed.errorStack.length <= 2000, 'the stack is capped');
});

test('reportError handles a non-Error throw', async () => {
  const [line] = await capture(() => reportError('just a string', 'test'));
  assert.equal(JSON.parse(line).errorMessage, 'just a string');
});

test('reportError forwards to a Sentry-compatible global when one exists', async () => {
  const captured: unknown[] = [];
  (globalThis as Record<string, unknown>).Sentry = {
    captureException: (e: unknown) => captured.push(e),
  };
  try {
    const error = new Error('forwarded');
    await capture(() => reportError(error, 'test'));
    assert.deepEqual(captured, [error]);
  } finally {
    delete (globalThis as Record<string, unknown>).Sentry;
  }
});

test('a throwing Sentry never breaks the request', async () => {
  (globalThis as Record<string, unknown>).Sentry = {
    captureException: () => { throw new Error('sentry is down'); },
  };
  try {
    await capture(() => reportError(new Error('x'), 'test'));
  } finally {
    delete (globalThis as Record<string, unknown>).Sentry;
  }
});

// ---------------------------------------------------------------------------
// timed() and the route wrapper must change observability, never behaviour.
// ---------------------------------------------------------------------------

test('timed returns the value and logs the duration', async () => {
  let value: unknown;
  const lines = await capture(async () => {
    value = await timed('test', { route: '/x' }, async () => 'result');
  });
  assert.equal(value, 'result');
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.outcome, 'ok');
  assert.ok(typeof parsed.durationMs === 'number');
});

test('timed re-throws what the operation throws', async () => {
  await assert.rejects(
    () => capture(() => timed('test', {}, async () => { throw new Error('inner'); })),
    /inner/
  );
});

test('the route wrapper echoes the request id on the response', async () => {
  const handler = withObservability('test', async () => new Response('ok', { status: 200 }));
  const lines: string[] = [];
  const original = console.log;
  console.log = (l: string) => lines.push(l);
  let response: Response;
  try {
    response = await handler(new Request('http://x.test/api/thing'));
  } finally {
    console.log = original;
  }
  assert.equal(response.status, 200);
  assert.match(response.headers.get(REQUEST_ID_HEADER)!, /^[0-9a-f]{12}$/);
  assert.equal(await response.text(), 'ok', 'the body must pass through unchanged');
});

test('the wrapper preserves the handler status and body', async () => {
  const handler = withObservability('test', async () =>
    new Response(JSON.stringify({ error: 'nope' }), { status: 403 })
  );
  const original = console.log;
  console.log = () => {};
  let response: Response;
  try {
    response = await handler(new Request('http://x.test/api/thing'));
  } finally {
    console.log = original;
  }
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'nope' });
});

test('a thrown handler becomes a 500 with a reference, not a leaked message', async () => {
  const handler = withObservability('test', async () => {
    throw new Error('connection string postgres://user:pw@host/db failed');
  });
  const original = console.error;
  console.error = () => {};
  let response: Response;
  try {
    response = await handler(new Request('http://x.test/api/thing'));
  } finally {
    console.error = original;
  }
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.match(body.error, /something went wrong/i);
  assert.ok(body.requestId, 'a reference is returned so the logs can be found');
  assert.equal(JSON.stringify(body).includes('postgres://'), false, 'the message must not leak');
});

test('the wrapper preserves Set-Cookie', async () => {
  // The wrapper rebuilds the Response to attach the request id. /api/shares/unlock
  // issues its grant as an httpOnly cookie, so dropping Set-Cookie here would
  // silently break password-protected prototypes: the visitor would answer
  // correctly and still be asked again.
  const handler = withObservability('test', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'ufo-share-abc=grant; HttpOnly; Path=/; Max-Age=21600');
    return new Response('ok', { status: 200, headers });
  });

  const original = console.log;
  console.log = () => {};
  let response: Response;
  try {
    response = await handler(new Request('http://x.test/api/shares/unlock', { method: 'POST' }));
  } finally {
    console.log = original;
  }

  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''];
  assert.equal(cookies.length, 1);
  assert.match(cookies[0], /ufo-share-abc=grant/);
  assert.match(cookies[0], /HttpOnly/);
});

test('the wrapper preserves MULTIPLE Set-Cookie headers', async () => {
  // Supabase's auth helpers set more than one cookie on a session refresh.
  // Collapsing them into a comma-joined single header would corrupt every one.
  const handler = withObservability('test', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'a=1; Path=/');
    headers.append('Set-Cookie', 'b=2; Path=/');
    return new Response('ok', { status: 200, headers });
  });

  const original = console.log;
  console.log = () => {};
  let response: Response;
  try {
    response = await handler(new Request('http://x.test/api/thing'));
  } finally {
    console.log = original;
  }

  const cookies = response.headers.getSetCookie?.() ?? [];
  assert.equal(cookies.length, 2, `expected two cookies, got ${JSON.stringify(cookies)}`);
  assert.deepEqual(cookies.sort(), ['a=1; Path=/', 'b=2; Path=/']);
});

test('the wrapper preserves other response headers', async () => {
  const handler = withObservability('test', async () =>
    new Response('ok', {
      status: 429,
      headers: { 'Retry-After': '600', 'Cache-Control': 'no-store' },
    })
  );
  const original = console.log;
  console.log = () => {};
  let response: Response;
  try {
    response = await handler(new Request('http://x.test/api/thing'));
  } finally {
    console.log = original;
  }
  assert.equal(response.headers.get('Retry-After'), '600');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
});
