import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * siteUrl() reads process.env at call time, so each case sets the three
 * variables it cares about and clears the others. Node's test runner shares one
 * process, so leaving one set would leak into the next case.
 */
const KEYS = ['NEXT_PUBLIC_SITE_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'] as const;

async function withEnv(
  env: Partial<Record<(typeof KEYS)[number], string>>,
  run: (siteUrl: () => string) => void | Promise<void>,
) {
  const saved = KEYS.map((k) => [k, process.env[k]] as const);
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  try {
    const { siteUrl } = await import('../lib/site-url.ts');
    await run(siteUrl);
  } finally {
    for (const k of KEYS) delete process.env[k];
    for (const [k, v] of saved) if (v !== undefined) process.env[k] = v;
  }
}

test('an explicit NEXT_PUBLIC_SITE_URL wins over anything Vercel provides', async () => {
  await withEnv(
    {
      NEXT_PUBLIC_SITE_URL: 'https://ufo.design',
      VERCEL_PROJECT_PRODUCTION_URL: 'ufo-preview.vercel.app',
      VERCEL_URL: 'ufo-preview-abc123.vercel.app',
    },
    (siteUrl) => assert.equal(siteUrl(), 'https://ufo.design'),
  );
});

test('falls back to the stable production host, not the per-deployment one', async () => {
  // An invitation email outlives the deployment that sent it, so a link built
  // from VERCEL_URL would 404 by the time someone clicks it.
  await withEnv(
    {
      VERCEL_PROJECT_PRODUCTION_URL: 'ufo-preview.vercel.app',
      VERCEL_URL: 'ufo-preview-abc123.vercel.app',
    },
    (siteUrl) => assert.equal(siteUrl(), 'https://ufo-preview.vercel.app'),
  );
});

test('uses the per-deployment host when that is all there is', async () => {
  await withEnv({ VERCEL_URL: 'ufo-preview-abc123.vercel.app' }, (siteUrl) =>
    assert.equal(siteUrl(), 'https://ufo-preview-abc123.vercel.app'),
  );
});

test("adds the scheme Vercel's bare host omits, and drops a trailing slash", async () => {
  await withEnv({ NEXT_PUBLIC_SITE_URL: 'https://ufo.design/' }, (siteUrl) =>
    assert.equal(siteUrl(), 'https://ufo.design'),
  );
  await withEnv({ NEXT_PUBLIC_SITE_URL: 'http://localhost:4000' }, (siteUrl) =>
    assert.equal(siteUrl(), 'http://localhost:4000'),
  );
});

test('an empty or whitespace value is treated as unset, not as an origin', async () => {
  await withEnv({ NEXT_PUBLIC_SITE_URL: '   ', VERCEL_URL: 'ufo.vercel.app' }, (siteUrl) =>
    assert.equal(siteUrl(), 'https://ufo.vercel.app'),
  );
});

test('falls back to localhost off Vercel, so local development is unchanged', async () => {
  await withEnv({}, (siteUrl) => assert.equal(siteUrl(), 'http://localhost:3000'));
});

test('the result is always a parseable absolute URL', async () => {
  // app/layout.tsx passes it straight to `new URL()` for metadataBase, which
  // throws on a relative value and would fail the build.
  for (const env of [
    { NEXT_PUBLIC_SITE_URL: 'ufo.design' },
    { VERCEL_URL: 'ufo-preview-abc123.vercel.app' },
    {},
  ]) {
    await withEnv(env, (siteUrl) => {
      assert.doesNotThrow(() => new URL(siteUrl()));
    });
  }
});
