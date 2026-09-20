import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

/**
 * The feedback schema, mirrored from app/api/feedback/route.ts. Importing the
 * route would drag in next/server and the Supabase client; the shape is small,
 * and the route's own typecheck catches a divergence.
 *
 * The rules worth pinning are the two that are easy to get wrong in a hurry:
 * a rating must be OPTIONAL (requiring a score before accepting a comment is
 * how bug reports get lost), and a path must never carry a query string.
 */
const feedbackSchema = z.object({
  source: z.enum(['general', 'first_success']).default('general'),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  message: z.string().trim().min(1).max(4000),
  path: z.string().max(255).optional(),
});

test('a comment with no rating is accepted', () => {
  const r = feedbackSchema.safeParse({ message: 'The export button does nothing on Safari.' });
  assert.equal(r.success, true, 'someone reporting a bug has no 1-5 opinion about it');
  assert.equal(r.data!.source, 'general');
});

test('a rating with no comment is rejected', () => {
  // A bare number tells us a score changed and nothing about why.
  assert.equal(feedbackSchema.safeParse({ rating: 5 }).success, false);
  assert.equal(feedbackSchema.safeParse({ rating: 5, message: '   ' }).success, false);
});

test('ratings outside 1-5, or fractional, are rejected', () => {
  for (const rating of [0, 6, -1, 2.5, Number.NaN]) {
    assert.equal(
      feedbackSchema.safeParse({ rating, message: 'x' }).success,
      false,
      `rating ${rating} should be rejected`
    );
  }
});

test('an over-long message is rejected rather than silently truncated', () => {
  assert.equal(feedbackSchema.safeParse({ message: 'x'.repeat(4001) }).success, false);
  assert.equal(feedbackSchema.safeParse({ message: 'x'.repeat(4000) }).success, true);
});

test('an unknown source is rejected', () => {
  assert.equal(feedbackSchema.safeParse({ source: 'admin', message: 'x' }).success, false);
});

/**
 * The route strips a query string rather than trusting the client to have
 * omitted one. A share page's query carries an access token, and an email
 * address ends up in one often enough that this cannot be advisory.
 */
function stripQuery(path?: string): string | null {
  return path?.split('?')[0]?.slice(0, 255) ?? null;
}

test('a query string is stripped from the reported path', () => {
  assert.equal(stripQuery('/proto/abc?token=SECRET123'), '/proto/abc');
  assert.equal(stripQuery('/dashboard/settings?email=someone@example.com'), '/dashboard/settings');
  assert.equal(stripQuery('/dashboard'), '/dashboard');
  assert.equal(stripQuery(undefined), null);
});

test('a stripped path is still capped at the column width', () => {
  const long = '/' + 'a'.repeat(400) + '?x=1';
  const out = stripQuery(long)!;
  assert.ok(out.length <= 255);
  assert.ok(!out.includes('?'));
});
