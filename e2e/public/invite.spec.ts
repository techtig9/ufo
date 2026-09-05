import { test, expect } from '@playwright/test';

/**
 * The invitation acceptance page — reachable by anyone holding the link, so
 * its signed-out behaviour is public surface.
 */

test('a link with no token says so rather than failing silently', async ({ page }) => {
  await page.goto('/invite');
  await expect(page.getByRole('heading').first()).toContainText(/incomplete|invitation/i);
});

test('a signed-out visitor is asked to sign in, and the token survives the trip', async ({ page }) => {
  await page.goto('/invite?token=e2e-probe-token');
  await expect(page.getByRole('heading').first()).toContainText(/sign in/i);

  const signIn = page.getByRole('link', { name: /^sign in$/i }).first();
  const href = await signIn.getAttribute('href');
  expect(href, 'the invite link must be carried through login').toContain('next=');
  expect(decodeURIComponent(href!)).toContain('/invite?token=e2e-probe-token');
});

test('signup carries the invitation through too', async ({ page }) => {
  await page.goto('/invite?token=e2e-probe-token');
  const href = await page.getByRole('link', { name: /create account/i }).first().getAttribute('href');
  expect(decodeURIComponent(href!)).toContain('/invite?token=e2e-probe-token');
});

test('the invitation page is not indexable', async ({ page }) => {
  // The URL carries a bearer credential; it must never reach a search index.
  await page.goto('/invite?token=e2e-probe-token');
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toMatch(/noindex/);
});

test('the workspace name is not revealed before acceptance', async ({ page }) => {
  // The page is reachable by anyone with the link; the invitation's details are
  // only confirmed once the signed-in address matches.
  await page.goto('/invite?token=e2e-probe-token');
  await expect(page.locator('body')).not.toContainText(/workspace ".+"/i);
});
