import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { route, AllProvidersFailedError } from '../lib/ai/router.ts';
import { ProviderError } from '../lib/ai/errors.ts';

/**
 * Exercises the real cascade by stubbing fetch, so this tests the routing
 * decisions rather than a re-implementation of them.
 */

const realFetch = globalThis.fetch;
const realEnv = { ...process.env };

/** Records which provider each call went to, in order. */
let calls: string[] = [];

function providerOf(url: string): string {
  if (url.includes('groq.com')) return 'groq';
  if (url.includes('cerebras.ai')) return 'cerebras';
  if (url.includes('openrouter.ai')) return 'openrouter';
  if (url.includes('anthropic.com')) return 'anthropic';
  return 'unknown';
}

function okBody(provider: string) {
  return provider === 'anthropic'
    ? { content: [{ type: 'text', text: `hello from ${provider}` }], usage: { input_tokens: 1, output_tokens: 2 } }
    : {
        choices: [{ message: { content: `hello from ${provider}` } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      };
}

/** behaviour: provider name -> HTTP status, or 'ok'. */
function stubFetch(behaviour: Record<string, number | 'ok'>) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const provider = providerOf(url);
    calls.push(provider);

    // Real fetch rejects with an AbortError when handed an aborted signal.
    // The double has to do the same, or cancellation appears to work in tests
    // while doing nothing in production.
    if (init?.signal?.aborted) {
      const err = new Error('The operation was aborted.');
      err.name = 'AbortError';
      throw err;
    }

    const outcome = behaviour[provider] ?? 'ok';

    if (outcome === 'ok') {
      return new Response(JSON.stringify(okBody(provider)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(`{"error":"${provider} says ${outcome}"}`, { status: outcome });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  // All four configured, so ordering is the only thing under test.
  process.env.GROQ_API_KEY = 'k';
  process.env.CEREBRAS_API_KEY = 'k';
  process.env.OPENROUTER_API_KEY = 'k';
  process.env.ANTHROPIC_API_KEY = 'k';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...realEnv };
});

const msgs = [{ role: 'user' as const, content: 'hi' }];
const opts = { requestId: 't1', task: 'test' };

test('the happy path uses Groq first and stops there', async () => {
  stubFetch({});
  const r = await route(msgs, opts);
  assert.equal(r.provider, 'groq');
  assert.deepEqual(calls, ['groq']);
  assert.equal(r.attempts, 1);
});

test('a Groq 429 falls back to Cerebras', async () => {
  stubFetch({ groq: 429 });
  const r = await route(msgs, opts);
  assert.equal(r.provider, 'cerebras');
  assert.deepEqual(calls, ['groq', 'cerebras']);
});

test('the full required cascade is Groq -> Cerebras -> OpenRouter -> Claude', async () => {
  stubFetch({ groq: 429, cerebras: 429, openrouter: 503 });
  const r = await route(msgs, opts);
  assert.equal(r.provider, 'anthropic');
  assert.deepEqual(calls, ['groq', 'cerebras', 'openrouter', 'anthropic']);
  assert.equal(r.attempts, 4);
});

test('a 5xx falls through', async () => {
  stubFetch({ groq: 500, cerebras: 502 });
  const r = await route(msgs, opts);
  assert.equal(r.provider, 'openrouter');
});

test('an invalid API key on the first provider fails over instead of failing hard', async () => {
  stubFetch({ groq: 401 });
  const r = await route(msgs, opts);
  assert.equal(r.provider, 'cerebras');
});

test('an INVALID REQUEST stops immediately and does not burn the cascade', async () => {
  stubFetch({ groq: 400 });
  await assert.rejects(
    () => route(msgs, opts),
    (e: unknown) => e instanceof ProviderError && e.kind === 'invalid_request'
  );
  // The whole point: no provider after Groq was tried.
  assert.deepEqual(calls, ['groq'], 'must not retry a request every provider would reject');
});

test('unconfigured providers are skipped, not counted as failures', async () => {
  delete process.env.GROQ_API_KEY;
  delete process.env.CEREBRAS_API_KEY;
  stubFetch({});
  const r = await route(msgs, opts);
  assert.equal(r.provider, 'openrouter');
  assert.deepEqual(calls, ['openrouter']);
  assert.equal(r.attempts, 1, 'an unset key is a deployment choice, not an outage');
});

test('when every provider fails, the error names each failure', async () => {
  stubFetch({ groq: 429, cerebras: 500, openrouter: 429, anthropic: 503 });
  await assert.rejects(
    () => route(msgs, opts),
    (e: unknown) => {
      assert.ok(e instanceof AllProvidersFailedError);
      assert.equal(e.failures.length, 4);
      assert.deepEqual(e.failures.map((f) => f.provider), ['groq', 'cerebras', 'openrouter', 'anthropic']);
      return true;
    }
  );
});

test('with no provider configured at all, it fails clearly', async () => {
  delete process.env.GROQ_API_KEY;
  delete process.env.CEREBRAS_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  stubFetch({});
  await assert.rejects(() => route(msgs, opts), AllProvidersFailedError);
  assert.deepEqual(calls, []);
});

test('preferHighQuality puts Claude first but still degrades to the others', async () => {
  stubFetch({ anthropic: 503 });
  const r = await route(msgs, { ...opts, preferHighQuality: true });
  assert.equal(r.provider, 'groq');
  assert.deepEqual(calls, ['anthropic', 'groq'], 'Claude preferred, not mandatory');
});

test('preferHighQuality uses Claude when it works', async () => {
  stubFetch({});
  const r = await route(msgs, { ...opts, preferHighQuality: true });
  assert.equal(r.provider, 'anthropic');
  assert.deepEqual(calls, ['anthropic']);
});

test('token usage is reported back for cost tracking', async () => {
  stubFetch({});
  const r = await route(msgs, opts);
  assert.equal(r.promptTokens, 1);
  assert.equal(r.completionTokens, 2);
  assert.ok(r.model, 'the model actually used is reported');
});

test('an already-aborted signal stops before any provider is called', async () => {
  stubFetch({});
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => route(msgs, { ...opts, signal: controller.signal }),
    (e: unknown) => e instanceof ProviderError && e.kind === 'cancelled'
  );
  assert.equal(calls.length, 1, 'attempted once, then stopped — no cascade');
});
