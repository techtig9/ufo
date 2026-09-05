import { test, expect } from '@playwright/test';

/**
 * Every authenticated API route, called with no session.
 *
 * These are cheap and they catch the failure that matters most: a route that
 * forgets its auth check. RLS would still refuse the query, but a route that
 * returns 200 with an empty body instead of 401 hides the mistake from
 * everything except a test like this.
 */

const UUID = '11111111-1111-4111-8111-111111111111';

const PROTECTED: [string, 'GET' | 'POST' | 'PATCH' | 'DELETE', object?][] = [
  ['/api/workspaces', 'GET'],
  ['/api/workspaces', 'POST', { name: 'x' }],
  [`/api/workspaces/${UUID}`, 'GET'],
  [`/api/workspaces/${UUID}`, 'PATCH', { name: 'x' }],
  [`/api/workspaces/${UUID}`, 'DELETE'],
  [`/api/workspaces/${UUID}/members`, 'GET'],
  [`/api/workspaces/${UUID}/invites`, 'GET'],
  [`/api/workspaces/${UUID}/invites`, 'POST', { email: 'a@b.test', role: 'editor' }],
  [`/api/workspaces/${UUID}/activity`, 'GET'],
  ['/api/invites/accept', 'POST', { token: 'x' }],
  ['/api/shares/publish', 'POST', { projectId: UUID, isPublic: true }],
  [`/api/projects/${UUID}/assets`, 'GET'],
  [`/api/projects/${UUID}/assets`, 'POST', { name: 'a.png', mimeType: 'image/png', size: 10 }],
  [`/api/assets/${UUID}`, 'GET'],
  [`/api/assets/${UUID}`, 'PATCH', { name: 'b.png' }],
  [`/api/assets/${UUID}`, 'DELETE'],
  [`/api/projects/${UUID}/publishing`, 'GET'],
  ['/api/projects/search', 'GET'],
  ['/api/prompts', 'GET'],
  ['/api/notifications', 'GET'],
  ['/api/account/plan', 'GET'],
  ['/api/account/export', 'GET'],
];

for (const [path, method, body] of PROTECTED) {
  test(`${method} ${path} refuses an anonymous caller`, async ({ request }) => {
    const response = await request.fetch(path, {
      method,
      ...(body ? { data: body } : {}),
      failOnStatusCode: false,
    });
    expect(
      [401, 403].includes(response.status()),
      `expected 401/403, got ${response.status()}`
    ).toBe(true);
  });
}

test('the health endpoint is public and says what it checked', async ({ request }) => {
  const response = await request.get('/api/health', { failOnStatusCode: false });
  // 200 with a live database, 503 without one — both are honest answers.
  expect([200, 503]).toContain(response.status());
  const body = await response.json();
  expect(body).toHaveProperty('status');
});

test('the health endpoint does not leak database internals', async ({ request }) => {
  // It is unauthenticated, and Postgres errors can disclose schema details.
  const response = await request.get('/api/health', { failOnStatusCode: false });
  const text = await response.text();
  expect(text).not.toMatch(/relation|column|permission denied|postgres|supabase\.co/i);
});

test('the Paddle webhook rejects an unsigned request', async ({ request }) => {
  // A forged webhook grants a paid plan and refills credits for free.
  const response = await request.post('/api/webhooks/paddle', {
    data: { event_type: 'subscription.created', data: { id: 'sub_forged' } },
    failOnStatusCode: false,
  });
  expect(response.status()).toBeGreaterThanOrEqual(400);
});

test('the cron endpoint rejects a request without its secret', async ({ request }) => {
  const response = await request.get('/api/cron/reset-credits', { failOnStatusCode: false });
  expect(response.status()).toBeGreaterThanOrEqual(400);
});
