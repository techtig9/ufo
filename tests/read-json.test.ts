import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { readJson } from '../lib/api/read-json.ts';

function post(body: string): Request {
  return new Request('https://example.test/api/thing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

const schema = z.object({
  name: z.string().trim().min(1).max(20),
  count: z.number().int().optional(),
});

test('a valid body comes back typed and parsed', async () => {
  const r = await readJson(post(JSON.stringify({ name: ' hi ', count: 2 })), schema);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.data, { name: 'hi', count: 2 });
});

test('a malformed body is a 400, not a thrown 500', async () => {
  // Nine routes called `await request.json()` bare, so sending `{` produced an
  // error page and a log entry, and told the client the fault was ours.
  const r = await readJson(post('{'), schema);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.response.status, 400);

  const body = r.ok === false ? await r.response.json() : null;
  assert.match(body.error, /not valid JSON/i);
});

test('an empty body is a 400 rather than a crash', async () => {
  const r = await readJson(post(''), schema);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.response.status, 400);
});

test('the message names the offending field', async () => {
  const r = await readJson(post(JSON.stringify({ count: 1 })), schema);
  assert.equal(r.ok, false);
  const body = r.ok === false ? await r.response.json() : null;
  assert.match(body.error, /"name"/);
});

test('the message never echoes the rejected value', async () => {
  // A rejected body can hold a password, a token or someone else's email, and
  // an error message is the easiest thing in a system to end up in a log or a
  // screenshot.
  const secret = 'hunter2-SUPER-SECRET-TOKEN';
  const r = await readJson(post(JSON.stringify({ name: secret.repeat(5) })), schema);
  assert.equal(r.ok, false);

  const body = r.ok === false ? await r.response.json() : null;
  assert.ok(!body.error.includes(secret), 'the rejected value must not appear in the message');
  assert.match(body.error, /too long/i);
});

test('a wrong type is reported as a type problem, not a crash', async () => {
  const r = await readJson(post(JSON.stringify({ name: 'ok', count: 'three' })), schema);
  assert.equal(r.ok, false);
  const body = r.ok === false ? await r.response.json() : null;
  assert.match(body.error, /"count"/);
});

test('a JSON array or scalar where an object is expected is rejected', async () => {
  for (const raw of ['[]', '"hello"', '42', 'null', 'true']) {
    const r = await readJson(post(raw), schema);
    assert.equal(r.ok, false, `${raw} should be rejected`);
    assert.equal(r.ok === false && r.response.status, 400);
  }
});
