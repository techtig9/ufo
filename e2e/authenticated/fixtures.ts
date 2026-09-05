import { test as base, expect, type Page } from '@playwright/test';

/**
 * Authenticated E2E.
 *
 * These specs are written and committed but SKIP unless UFO_E2E_EMAIL and
 * UFO_E2E_PASSWORD name a real account on a reachable Supabase project.
 *
 * That is deliberate. The alternative — stubbing a session and asserting
 * against the stub — would produce a suite that passes while proving nothing
 * about whether sign-in works, which is worse than no suite at all because it
 * looks like coverage. A skipped test that states its reason is honest.
 *
 * To run them:
 *   UFO_E2E_EMAIL='you@example.com' UFO_E2E_PASSWORD='...' npm run test:e2e
 */

export const E2E_EMAIL = process.env.UFO_E2E_EMAIL;
export const E2E_PASSWORD = process.env.UFO_E2E_PASSWORD;
export const HAVE_CREDENTIALS = Boolean(E2E_EMAIL && E2E_PASSWORD);

export const SKIP_REASON =
  'Set UFO_E2E_EMAIL and UFO_E2E_PASSWORD to run the authenticated suite against a real Supabase project.';

/** Sign in through the real form — not by injecting a cookie. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).first().fill(E2E_EMAIL!);
  await page.getByLabel(/password/i).first().fill(E2E_PASSWORD!);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

/** A test that runs only when credentials exist, and says so when they do not. */
export const authTest = base.extend<{ signedIn: Page }>({
  signedIn: async ({ page }, use) => {
    await signIn(page);
    await use(page);
  },
});

authTest.beforeEach(() => {
  authTest.skip(!HAVE_CREDENTIALS, SKIP_REASON);
});

export { expect };
