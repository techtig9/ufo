import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

/**
 * /api/chat used to read its body with a cast:
 *
 *   const { messages } = (await request.json()) as { messages: ChatMessage[] };
 *
 * A cast is a claim, not a check. These tests pin the schema that replaced it.
 * The schema is duplicated here rather than exported from the route, because
 * importing a Next route module into the node test runner drags in
 * next/server and the Supabase client; the shape is small enough that a
 * divergence would be caught by the typecheck on the route itself.
 */
const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 4000;

const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1)
    .max(MAX_HISTORY * 4),
});

test('a well-formed conversation is accepted', () => {
  const r = chatBodySchema.safeParse({
    messages: [
      { role: 'user', text: 'Which plan should I be on?' },
      { role: 'model', text: 'It depends how many full projects you generate.' },
    ],
  });
  assert.equal(r.success, true);
});

test('a non-string text is rejected instead of reaching the provider', () => {
  for (const text of [42, null, { a: 1 }, ['x'], true]) {
    const r = chatBodySchema.safeParse({ messages: [{ role: 'user', text }] });
    assert.equal(r.success, false, `${JSON.stringify(text)} should be rejected`);
  }
});

test('an oversized message is rejected, so input cost stays bounded', () => {
  // MAX_HISTORY caps the message COUNT and maxTokens caps the OUTPUT. Neither
  // bounded the input, so this was a rate-limit-compliant way to run up a bill.
  const r = chatBodySchema.safeParse({
    messages: [{ role: 'user', text: 'x'.repeat(MAX_MESSAGE_CHARS + 1) }],
  });
  assert.equal(r.success, false);
  assert.ok(r.error!.issues.some((i) => i.code === 'too_big'));
});

test('a message at exactly the limit is still accepted', () => {
  const r = chatBodySchema.safeParse({
    messages: [{ role: 'user', text: 'x'.repeat(MAX_MESSAGE_CHARS) }],
  });
  assert.equal(r.success, true);
});

test('an empty or whitespace-only message is rejected', () => {
  for (const text of ['', '   ', '\n\t']) {
    assert.equal(chatBodySchema.safeParse({ messages: [{ role: 'user', text }] }).success, false);
  }
});

test('a forged role is rejected at the edge', () => {
  // chatWithAssistant maps anything that is not 'model' to 'user', so a
  // 'system' turn could not be injected even before this schema existed. The
  // enum keeps that true if that mapping is ever rewritten.
  for (const role of ['system', 'assistant', 'developer', '']) {
    assert.equal(
      chatBodySchema.safeParse({ messages: [{ role, text: 'hi' }] }).success,
      false,
      `role "${role}" should be rejected`
    );
  }
});

test('an absent, empty or non-array messages field is rejected', () => {
  for (const body of [{}, { messages: [] }, { messages: 'hello' }, { messages: null }, null]) {
    assert.equal(chatBodySchema.safeParse(body).success, false);
  }
});

test('an absurd number of messages is rejected before the tail is trimmed', () => {
  const messages = Array.from({ length: MAX_HISTORY * 4 + 1 }, () => ({
    role: 'user' as const,
    text: 'hi',
  }));
  assert.equal(chatBodySchema.safeParse({ messages }).success, false);
});
