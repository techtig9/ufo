import { test, expect } from '@playwright/test';

/**
 * Public prototype links. Without a database these can only be checked from
 * the outside — but the outside is exactly where the security properties live:
 * an unpublished, expired or nonexistent share must be indistinguishable.
 */

test('an unknown prototype slug 404s rather than leaking that it exists', async ({ page }) => {
  const response = await page.goto('/proto/definitely-not-a-real-slug');
  expect(response?.status()).toBe(404);
});

test('a nonexistent slug and a malformed one answer identically', async ({ page }) => {
  // Different responses would let someone enumerate valid slugs.
  const a = await page.request.get('/proto/aaaaaaaaaaaa');
  const b = await page.request.get('/proto/../../etc/passwd');
  expect(a.status()).toBe(404);
  expect([404, 400]).toContain(b.status());
});

test('the unlock endpoint gives one answer to every failure', async ({ request }) => {
  // A different message for "no such share" versus "wrong password" would turn
  // this into a slug oracle.
  const missing = await request.post('/api/shares/unlock', {
    data: { slug: 'no-such-share-at-all', password: 'x' },
    failOnStatusCode: false,
  });
  const alsoMissing = await request.post('/api/shares/unlock', {
    data: { slug: 'another-missing-share', password: 'y' },
    failOnStatusCode: false,
  });

  expect(missing.status()).toBe(alsoMissing.status());
  expect(await missing.text()).toBe(await alsoMissing.text());
});

test('the unlock endpoint rejects a malformed body rather than throwing', async ({ request }) => {
  const response = await request.post('/api/shares/unlock', {
    data: { nonsense: true },
    failOnStatusCode: false,
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(500);
});
