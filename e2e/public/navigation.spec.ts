import { test, expect } from '@playwright/test';

/**
 * The cookie banner is `position: fixed` at the bottom and legitimately
 * intercepts clicks beneath it until dismissed — that is what a consent banner
 * is for. A real visitor dismisses it once; these tests start from that state
 * rather than fighting it, which is also what makes them stable.
 */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.setItem('ufo-cookie-consent', 'accepted'); } catch {}
  });
});

/**
 * The paths a visitor actually walks before signing up. Every one of these was
 * reachable only by typing a URL until it was checked here.
 */

test('the landing page loads and offers a way in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ufo/i);
  // Asserted by destination, not by wording: the CTA copy is a marketing
  // decision and will change, but a landing page with no route to signup is
  // broken whatever it says.
  const signup = page.locator('a[href="/signup"]');
  await expect(signup.first()).toBeVisible();
  await expect(await signup.count()).toBeGreaterThan(0);
});

test('every primary nav link resolves, none 404', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page
    .locator('header a[href^="/"], nav a[href^="/"]')
    .evaluateAll((links) => [...new Set(links.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))]);

  expect(hrefs.length).toBeGreaterThan(0);

  for (const href of hrefs) {
    const response = await page.request.get(href);
    // A protected route legitimately redirects; nothing may 404 or 500.
    expect(response.status(), `${href} returned ${response.status()}`).toBeLessThan(400);
  }
});

test('the footer legal links all resolve', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page
    .locator('footer a[href^="/"]')
    .evaluateAll((links) => [...new Set(links.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))]);

  expect(hrefs.length, 'the footer must link somewhere').toBeGreaterThan(3);

  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.status(), `${href} returned ${response.status()}`).toBeLessThan(400);
  }
});

test('signing up and logging in are reachable from each other', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: /sign ?up|create/i }).first().click();
  await expect(page).toHaveURL(/\/signup/);

  await page.getByRole('link', { name: /log ?in|sign ?in/i }).first().click();
  await expect(page).toHaveURL(/\/login/);
});

test('a protected route sends an anonymous visitor to login, not to a blank page', async ({ page }) => {
  // This is the shape of the original "white page" bug: a redirect that lands
  // somewhere with nothing to read.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading').first()).toBeVisible();
});

test('an unknown URL renders a real 404 page', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.locator('body')).not.toBeEmpty();
});
