import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProviderError,
  classifyHttpStatus,
  classifyThrown,
} from '../lib/ai/errors.ts';
import {
  extractJson,
  repairJson,
  parseAiJson,
  generatedProjectSchema,
  AiResponseError,
} from '../lib/ai/json.ts';

// ---------------------------------------------------------------------------
// Fallback classification. The Master Command is explicit: fall back on 429,
// quota, timeout and temporary 5xx; do NOT fall back on an invalid key, an
// invalid request, a schema error, or an authorization failure that cannot
// succeed elsewhere.
// ---------------------------------------------------------------------------

test('429 is a rate limit and falls back', () => {
  assert.equal(classifyHttpStatus(429), 'rate_limited');
  assert.equal(new ProviderError('rate_limited', 'groq', 'x').shouldFallback, true);
});

test('5xx is temporary and falls back', () => {
  for (const s of [500, 502, 503, 504]) assert.equal(classifyHttpStatus(s), 'temporary');
  assert.equal(new ProviderError('temporary', 'groq', 'x').shouldFallback, true);
});

test('a timeout falls back to the next provider', () => {
  assert.equal(new ProviderError('timeout', 'groq', 'x').shouldFallback, true);
});

test('401/403 is an auth failure — falls back, because the NEXT key may be valid', () => {
  assert.equal(classifyHttpStatus(401), 'auth');
  assert.equal(classifyHttpStatus(403), 'auth');
  // A bad Groq key says nothing about the Cerebras key, so failing over is
  // right; retrying the same provider would be pointless.
  assert.equal(new ProviderError('auth', 'groq', 'x').shouldFallback, true);
});

test('400/422 is an invalid request and must NOT burn the rest of the cascade', () => {
  assert.equal(classifyHttpStatus(400), 'invalid_request');
  assert.equal(classifyHttpStatus(422), 'invalid_request');
  assert.equal(
    new ProviderError('invalid_request', 'groq', 'x').shouldFallback,
    false,
    'every provider would reject an invalid request identically'
  );
});

test('caller cancellation stops the cascade', () => {
  assert.equal(new ProviderError('cancelled', 'groq', 'x').shouldFallback, false);
});

test('an unusable success body falls back', () => {
  assert.equal(new ProviderError('bad_response', 'groq', 'x').shouldFallback, true);
});

test('an AbortError is classified as a timeout', () => {
  const e = new Error('aborted');
  e.name = 'AbortError';
  assert.equal(classifyThrown(e), 'timeout');
});

test('a transport error is temporary, so it fails over', () => {
  assert.equal(classifyThrown(new Error('ECONNRESET')), 'temporary');
  assert.equal(classifyThrown('socket hang up'), 'temporary');
});

test('ProviderError carries provider and status for the log', () => {
  const e = new ProviderError('rate_limited', 'cerebras', 'slow down', 429);
  assert.equal(e.provider, 'cerebras');
  assert.equal(e.httpStatus, 429);
  assert.equal(e.name, 'ProviderError');
});

// ---------------------------------------------------------------------------
// JSON extraction, repair and schema validation.
// ---------------------------------------------------------------------------

test('extractJson unwraps markdown fences', () => {
  assert.equal(extractJson('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJson('```\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJson('{"a":1}'), '{"a":1}');
});

test('extractJson survives a model that prepends prose', () => {
  assert.equal(extractJson('Sure! Here is the JSON:\n{"a":1}'), '{"a":1}');
});

test('repairJson removes trailing commas', () => {
  assert.equal(repairJson('{"a":1,}'), '{"a":1}');
  assert.equal(repairJson('[1,2,]'), '[1,2]');
});

const validProject = {
  tokens: {
    colors: { primary: '#000', secondary: '#111', accent: '#222', background: '#fff', text: '#000' },
    fonts: { display: 'Inter', body: 'Inter' },
    spacing: { scale: [4, 8] },
  },
  screens: [{ name: 'Home', orderIndex: 0, code: '<main>hi</main>', hotspots: [] }],
};

test('a well-formed project validates', () => {
  const parsed = parseAiJson(JSON.stringify(validProject), generatedProjectSchema);
  assert.equal(parsed.screens.length, 1);
  assert.equal(parsed.screens[0].name, 'Home');
});

test('a fenced project still validates', () => {
  const parsed = parseAiJson('```json\n' + JSON.stringify(validProject) + '\n```', generatedProjectSchema);
  assert.equal(parsed.screens.length, 1);
});

test('a trailing comma is repaired rather than failing the generation', () => {
  const withComma = JSON.stringify(validProject).replace('}]}', '}],}');
  const parsed = parseAiJson(withComma, generatedProjectSchema);
  assert.equal(parsed.screens.length, 1);
});

test('JSON of the WRONG SHAPE is rejected at the boundary', () => {
  // This is the case the old code let through: valid JSON, wrong shape, so
  // `screens` was undefined and the failure surfaced much later as a database
  // or render error instead of "the generator returned something unusable".
  assert.throws(
    () => parseAiJson('{"tokens":{},"screens":[]}', generatedProjectSchema),
    (e: unknown) => e instanceof AiResponseError && e.stage === 'schema'
  );
});

test('a project with zero screens is rejected', () => {
  const empty = { ...validProject, screens: [] };
  assert.throws(() => parseAiJson(JSON.stringify(empty), generatedProjectSchema), AiResponseError);
});

test('a screen with empty code is rejected', () => {
  const blank = { ...validProject, screens: [{ name: 'Home', orderIndex: 0, code: '', hotspots: [] }] };
  assert.throws(() => parseAiJson(JSON.stringify(blank), generatedProjectSchema), AiResponseError);
});

test('unparseable output raises a parse error, not a crash', () => {
  assert.throws(
    () => parseAiJson('not json at all', generatedProjectSchema),
    (e: unknown) => e instanceof AiResponseError && e.stage === 'parse'
  );
});

test('hotspots and orderIndex default rather than failing a good generation', () => {
  const minimal = {
    tokens: validProject.tokens,
    screens: [{ name: 'Home', code: '<main>x</main>' }],
  };
  const parsed = parseAiJson(JSON.stringify(minimal), generatedProjectSchema);
  assert.equal(parsed.screens[0].orderIndex, 0);
  assert.deepEqual(parsed.screens[0].hotspots, []);
});
