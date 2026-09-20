import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCostUsd, rateFor, isKnownModel } from '../lib/ai/cost.ts';

/**
 * The spend cap's job is to stop a runaway bill, so every uncertainty in it
 * must resolve towards over-counting. A cap that under-counts is a cap that
 * is not there.
 */

test('an unknown model is billed at the most expensive known rate, not zero', () => {
  const unknown = rateFor('some-model-nobody-has-heard-of');
  const known = ['llama-3.3-70b-versatile', 'claude-fable-5'].map(rateFor);

  for (const rate of known) {
    assert.ok(unknown.inputPerMillion >= rate.inputPerMillion);
    assert.ok(unknown.outputPerMillion >= rate.outputPerMillion);
  }
  assert.ok(unknown.inputPerMillion > 0, 'an unknown model must never be free');
});

test('a null model is priced, not skipped', () => {
  assert.ok(estimateCostUsd(null, 1000, 1000) > 0);
  assert.ok(estimateCostUsd(undefined, 1000, 1000) > 0);
});

test('a request with no reported token usage still costs something', () => {
  // Providers occasionally omit usage, and a failure after dispatch has no
  // counts at all. Billing those at zero is how a cap gets quietly defeated.
  assert.ok(estimateCostUsd('llama-3.3-70b-versatile', null, null) > 0);
  assert.ok(estimateCostUsd('llama-3.3-70b-versatile', 500, null) > 0);
});

test('cost scales linearly with tokens', () => {
  const one = estimateCostUsd('claude-fable-5', 1_000_000, 0);
  const two = estimateCostUsd('claude-fable-5', 2_000_000, 0);
  assert.ok(Math.abs(two - one * 2) < 1e-9);
});

test('output tokens are priced separately from input tokens', () => {
  // Frontier models charge several times more for output. Pricing them the
  // same understates every generation, which is output-heavy by nature.
  const input = estimateCostUsd('claude-fable-5', 1_000_000, 0);
  const output = estimateCostUsd('claude-fable-5', 0, 1_000_000);
  assert.ok(output > input, 'output must not be priced as input');
});

test('the expensive fallback really is the expensive one', () => {
  // The cap exists because a Groq outage silently promotes every request to
  // the frontier tier. If that tier were not priced higher, the cap would not
  // notice the promotion.
  const cheap = estimateCostUsd('llama-3.3-70b-versatile', 100_000, 100_000);
  const frontier = estimateCostUsd('claude-fable-5', 100_000, 100_000);
  assert.ok(frontier > cheap * 2, 'the fallback tier must be visibly more expensive');
});

test('a per-model rate can be overridden from the environment', () => {
  const env = process.env as Record<string, string | undefined>;
  const key = 'AI_RATE_LLAMA_3_3_70B_VERSATILE';
  const saved = env[key];
  try {
    env[key] = '100,200';
    const rate = rateFor('llama-3.3-70b-versatile');
    assert.equal(rate.inputPerMillion, 100);
    assert.equal(rate.outputPerMillion, 200);
    assert.equal(isKnownModel('llama-3.3-70b-versatile'), true);
  } finally {
    if (saved === undefined) delete env[key];
    else env[key] = saved;
  }
});

test('a malformed override is ignored rather than zeroing the rate', () => {
  const env = process.env as Record<string, string | undefined>;
  const key = 'AI_RATE_LLAMA_3_3_70B_VERSATILE';
  const saved = env[key];
  try {
    for (const bad of ['', 'free', '-1,2', 'abc,def', '5']) {
      env[key] = bad;
      const rate = rateFor('llama-3.3-70b-versatile');
      assert.ok(rate.inputPerMillion > 0, `"${bad}" must not zero the rate`);
    }
  } finally {
    if (saved === undefined) delete env[key];
    else env[key] = saved;
  }
});
