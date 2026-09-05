import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { logAuthStep, newRequestId } from '../lib/auth-log.ts';

/**
 * The auth callback.
 *
 * Its network behaviour needs a live Supabase, but two things about it can and
 * should be tested here: that it never logs a credential, and that every
 * failure code it emits is one the login page can actually render.
 */

/** Capture what logAuthStep writes, without letting it reach the real console. */
function captureLog(fields: Parameters<typeof logAuthStep>[0]): Record<string, unknown> {
  const original = { log: console.log, error: console.error };
  let captured = '';
  console.log = (line: string) => { captured = line; };
  console.error = (line: string) => { captured = line; };
  try {
    logAuthStep(fields);
  } finally {
    console.log = original.log;
    console.error = original.error;
  }
  return JSON.parse(captured);
}

// ---------------------------------------------------------------------------
// Never log a credential. The Master Command states this as a hard rule, and
// the OAuth callback is the one place where codes and tokens are in scope.
// ---------------------------------------------------------------------------

test('only allow-listed fields are emitted', () => {
  const line = captureLog({
    requestId: 'abc12345',
    step: 'exchange',
    // Not on the allow-list, and exactly what must never appear:
    code: 'the-oauth-code',
    accessToken: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
    password: 'hunter2',
    email: 'someone@example.com',
  } as never);

  assert.equal(line.requestId, 'abc12345');
  assert.equal(line.step, 'exchange');
  for (const forbidden of ['code', 'accessToken', 'password', 'email']) {
    assert.equal(forbidden in line, false, `${forbidden} must not be logged`);
  }
});

test('the OAuth code is recorded only as a boolean', () => {
  // hasCode exists precisely so a log can say "a code was present" without
  // being able to say what it was.
  const line = captureLog({ requestId: 'r', step: 'start', hasCode: true });
  assert.equal(line.hasCode, true);
  assert.equal(JSON.stringify(line).includes('the-oauth-code'), false);
});

test('a JWT smuggled through an allow-listed field is redacted', () => {
  // errorMessage comes from Supabase — the one field whose content we do not
  // control.
  const line = captureLog({
    requestId: 'r',
    errorMessage: 'failed for token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  });
  assert.equal(line.errorMessage, '[redacted]');
});

test('other credential shapes are redacted too', () => {
  for (const secret of [
    // Supabase tokens separate with an UNDERSCORE, which a hyphen-only pattern
    // let straight through — that is what this list caught.
    'sbp_0123456789abcdefghij',
    'sba_0123456789abcdefghij',
    'sb_secret_0123456789abcdefghij',
    'sb_publishable_0123456789abcdefghij',
    'sba-0123456789abcdefghij',
    'sk-0123456789abcdefghij',
    'sk_live_0123456789abcdefghij',
    'Bearer abcdefghijklmnop',
    'bearer   abcdefghijklmnop',
  ]) {
    const line = captureLog({ errorMessage: `boom: ${secret}` });
    assert.equal(line.errorMessage, '[redacted]', secret);
  }
});

test('an ordinary error message survives intact', () => {
  // Over-redaction would make the logs useless for the problem they exist for.
  const message = 'Invalid login credentials';
  assert.equal(captureLog({ errorMessage: message }).errorMessage, message);
});

test('every line is tagged so it can be filtered from the platform log', () => {
  assert.equal(captureLog({ step: 'start' }).scope, 'auth');
});

test('undefined fields are omitted rather than emitted as null', () => {
  const line = captureLog({ requestId: 'r', step: undefined, userId: undefined });
  assert.equal('step' in line, false);
  assert.equal('userId' in line, false);
});

test('a failure goes to console.error, a success to console.log', () => {
  const original = { log: console.log, error: console.error };
  const seen: string[] = [];
  console.log = () => seen.push('log');
  console.error = () => seen.push('error');
  try {
    logAuthStep({ outcome: 'ok' });
    logAuthStep({ outcome: 'failed' });
  } finally {
    console.log = original.log;
    console.error = original.error;
  }
  assert.deepEqual(seen, ['log', 'error']);
});

test('a request id is short, unique and not a UUID that looks like a user id', () => {
  const ids = new Set(Array.from({ length: 500 }, () => newRequestId()));
  assert.equal(ids.size, 500, 'ids must not collide across one process');
  const one = newRequestId();
  assert.equal(one.length, 8);
  assert.match(one, /^[0-9a-f]{8}$/);
});

// ---------------------------------------------------------------------------
// The failure-code contract between the route and the login page.
//
// The route emits ?error=<code>; the login page maps it to a message. A code
// present in one and not the other is how the original white-page bug looked
// to a user: a redirect with nothing to read.
// ---------------------------------------------------------------------------

function codesIn(file: string, pattern: RegExp): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(pattern)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i).sort();
}

test('every failure code the callback emits is rendered by the login page', () => {
  const emitted = codesIn(
    'app/auth/callback/route.ts',
    /^\s*\|\s*'([a-z_]+)'/gm
  );
  const rendered = codesIn('app/(auth)/login/page.tsx', /^\s{2}([a-z_]+):/gm);

  assert.ok(emitted.length >= 4, `expected the FailureCode union, found ${JSON.stringify(emitted)}`);
  for (const code of emitted) {
    assert.ok(rendered.includes(code), `the login page has no message for ?error=${code}`);
  }
});

test('the login page renders no code the callback cannot emit', () => {
  // A stale entry is harmless but signals the two have drifted.
  const emitted = codesIn('app/auth/callback/route.ts', /^\s*\|\s*'([a-z_]+)'/gm);
  const rendered = codesIn('app/(auth)/login/page.tsx', /^\s{2}([a-z_]+):/gm);
  for (const code of rendered) {
    assert.ok(emitted.includes(code), `the login page renders ?error=${code}, which nothing emits`);
  }
});

test('the callback redirects on every failure path rather than falling through', () => {
  // The original white page was an unconditional redirect outside both guard
  // blocks: a failed exchange still sent the user to /dashboard, middleware
  // bounced them back, and nothing was shown. Every early return must be a
  // failureRedirect.
  const source = readFileSync('app/auth/callback/route.ts', 'utf8');
  const returns = [...source.matchAll(/^\s*return\s+(\w+)/gm)].map((m) => m[1]);
  const nonRedirect = returns.filter((r) => r !== 'failureRedirect' && r !== 'NextResponse');
  assert.deepEqual(nonRedirect, [], `every return must produce a redirect, found: ${nonRedirect}`);
});
