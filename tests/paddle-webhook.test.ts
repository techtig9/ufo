import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * Paddle webhook signature verification.
 *
 * This is the only thing standing between "Paddle says this customer paid" and
 * "anyone on the internet says this customer paid" — a forged webhook grants a
 * paid plan and refills credits for free. It is worth testing properly.
 *
 * The secret is set here rather than in the environment because
 * verifyPaddleSignature reads process.env at call time; each test controls it
 * explicitly so none of them depend on the ambient environment.
 */
const SECRET = 'pdl_ntfset_test_secret_value';

function signed(body: string, secret = SECRET, ts = '1700000000'): string {
  const h1 = crypto.createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

/**
 * `secret: null` means "not configured". Deliberately not `undefined`: passing
 * undefined for an optional parameter selects its DEFAULT value, so the
 * unconfigured case would silently have run with the secret set — which is how
 * this helper failed its own fail-closed test the first time.
 */
async function verify(body: string, header: string | null, secret: string | null = SECRET) {
  const previous = process.env.PADDLE_WEBHOOK_SECRET;
  if (secret === null) delete process.env.PADDLE_WEBHOOK_SECRET;
  else process.env.PADDLE_WEBHOOK_SECRET = secret;
  try {
    // Imported inside so the module sees the env set above, and re-imported
    // fresh is unnecessary — the function reads process.env per call.
    const { verifyPaddleSignature } = await import('../lib/paddle.ts');
    return verifyPaddleSignature(body, header);
  } finally {
    if (previous === undefined) delete process.env.PADDLE_WEBHOOK_SECRET;
    else process.env.PADDLE_WEBHOOK_SECRET = previous;
  }
}

const BODY = JSON.stringify({ event_type: 'subscription.created', data: { id: 'sub_123' } });

test('a correctly signed body is accepted', async () => {
  assert.equal(await verify(BODY, signed(BODY)), true);
});

test('a forged signature is rejected', async () => {
  assert.equal(await verify(BODY, 'ts=1700000000;h1=' + 'a'.repeat(64)), false);
});

test('a signature made with the wrong secret is rejected', async () => {
  assert.equal(await verify(BODY, signed(BODY, 'wrong-secret')), false);
});

test('a tampered body invalidates a real signature', async () => {
  // The attack this stops: replay a genuine webhook with the plan swapped.
  const header = signed(BODY);
  const tampered = JSON.stringify({ event_type: 'subscription.created', data: { id: 'sub_999' } });
  assert.equal(await verify(tampered, header), false);
});

test('a changed timestamp invalidates the signature', async () => {
  const header = signed(BODY);
  assert.equal(await verify(BODY, header.replace('ts=1700000000', 'ts=1700009999')), false);
});

test('the timestamp is part of the signed payload, not decoration', async () => {
  // Signing `body` alone rather than `ts:body` must not validate.
  const h1 = crypto.createHmac('sha256', SECRET).update(BODY).digest('hex');
  assert.equal(await verify(BODY, `ts=1700000000;h1=${h1}`), false);
});

test('a missing header is rejected', async () => {
  assert.equal(await verify(BODY, null), false);
  assert.equal(await verify(BODY, ''), false);
});

test('a malformed header is rejected rather than throwing', async () => {
  for (const header of ['garbage', 'ts=1700000000', 'h1=abc', 'ts=;h1=', ';;;', 'ts=1;h1=1;extra']) {
    assert.equal(await verify(BODY, header), false, JSON.stringify(header));
  }
});

test('a signature of the wrong LENGTH is rejected, not thrown on', async () => {
  // timingSafeEqual throws on a length mismatch — the catch is what makes this
  // a rejection rather than a 500.
  for (const h1 of ['a', 'a'.repeat(63), 'a'.repeat(65), '']) {
    assert.equal(await verify(BODY, `ts=1700000000;h1=${h1}`), false, `len ${h1.length}`);
  }
});

test('verification FAILS CLOSED when the secret is not configured', async () => {
  // A missing secret must never mean "accept everything".
  assert.equal(await verify(BODY, signed(BODY)), true, 'sanity: valid with the secret set');
  assert.equal(await verify(BODY, signed(BODY), null), false, 'and refused without it');
});

test('an empty body is still verified rather than waved through', async () => {
  assert.equal(await verify('', signed('')), true);
  assert.equal(await verify('', signed(BODY)), false);
});

test('signature checking is byte-exact, so re-serialised JSON does not validate', async () => {
  // The reason the route must verify against the RAW body: JSON.parse then
  // JSON.stringify can reorder or reformat, and the HMAC then fails.
  const header = signed(BODY);
  const reserialised = JSON.stringify(JSON.parse(BODY.replace('"event_type"', '"eventType"')));
  assert.equal(await verify(reserialised, header), false);
});

test('whitespace differences in the body invalidate the signature', async () => {
  const pretty = JSON.stringify(JSON.parse(BODY), null, 2);
  assert.equal(await verify(pretty, signed(BODY)), false);
});
