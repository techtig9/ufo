import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

/**
 * The credit-grant schema, mirrored from app/api/admin/credits/route.ts.
 *
 * Granting credits is the one action in this product that creates value from
 * nothing, so the bounds are the security control: a slipped keystroke must
 * not be able to mint a million credits, and every grant must carry a reason.
 */
const MAX_GRANT = 100_000;

const grantSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= MAX_GRANT, {
    message: `amount must be non-zero and at most ${MAX_GRANT}`,
  }),
  reason: z.string().trim().min(3).max(500),
});

const uuid = '11111111-2222-3333-4444-555555555555';

test('a well-formed grant is accepted', () => {
  const r = grantSchema.safeParse({ userId: uuid, amount: 5000, reason: 'Goodwill after an outage' });
  assert.equal(r.success, true);
});

test('a correction (negative amount) is allowed', () => {
  // Reversing an over-grant is the same kind of action and must leave the same
  // trail, rather than being fixed by hand in SQL with no record.
  assert.equal(
    grantSchema.safeParse({ userId: uuid, amount: -5000, reason: 'Reversing a duplicate grant' }).success,
    true
  );
});

test('a zero grant is rejected', () => {
  // It changes nothing and would leave a meaningless audit row.
  assert.equal(grantSchema.safeParse({ userId: uuid, amount: 0, reason: 'nothing' }).success, false);
});

test('a grant beyond the ceiling is rejected in both directions', () => {
  for (const amount of [MAX_GRANT + 1, -(MAX_GRANT + 1), 10_000_000]) {
    assert.equal(
      grantSchema.safeParse({ userId: uuid, amount, reason: 'oops' }).success,
      false,
      `${amount} should be rejected`
    );
  }
  assert.equal(grantSchema.safeParse({ userId: uuid, amount: MAX_GRANT, reason: 'max' }).success, true);
});

test('a fractional amount is rejected', () => {
  assert.equal(grantSchema.safeParse({ userId: uuid, amount: 10.5, reason: 'half' }).success, false);
});

test('a reason is required and must say something', () => {
  for (const reason of [undefined, '', '  ', 'x', 'ab']) {
    assert.equal(
      grantSchema.safeParse({ userId: uuid, amount: 100, reason }).success,
      false,
      `reason ${JSON.stringify(reason)} should be rejected`
    );
  }
});

test('a non-uuid target is rejected before it reaches the database', () => {
  for (const userId of ['', 'me', '123', 'not-a-uuid']) {
    assert.equal(grantSchema.safeParse({ userId, amount: 100, reason: 'test grant' }).success, false);
  }
});

/**
 * The balance is clamped at zero: a correction larger than the balance should
 * empty it, not leave a negative that every downstream check must special-case.
 */
function applyGrant(balance: number, amount: number): number {
  return Math.max(0, balance + amount);
}

test('a correction larger than the balance empties it rather than going negative', () => {
  assert.equal(applyGrant(1000, -5000), 0);
  assert.equal(applyGrant(0, -1), 0);
  assert.equal(applyGrant(1000, -1000), 0);
});

test('an ordinary grant adds', () => {
  assert.equal(applyGrant(1000, 500), 1500);
  assert.equal(applyGrant(0, 5000), 5000);
});
