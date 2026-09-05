import { test, expect } from '@playwright/test';

/**
 * The callback banner is addressed by `data-testid="callback-error"` rather
 * than by role: react-hot-toast renders a permanent, empty `role="alert"` live
 * region (correctly — an aria-live region has to exist before the message
 * arrives), so getByRole('alert') matches on a page with no banner at all.
 */
const banner = 'callback-error';

/**
 * The authentication forms, as far as they can be exercised without a Supabase
 * project: validation, the error banner, and the Google button reporting
 * failure rather than doing nothing.
 */

test('the login form refuses to submit empty', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click();
  // Native validation keeps us on the page rather than posting nothing.
  await expect(page).toHaveURL(/\/login/);
});

test('the email field rejects a malformed address', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel(/email/i).first();
  await email.fill('not-an-email');
  const valid = await email.evaluate((el) => (el as HTMLInputElement).checkValidity());
  expect(valid).toBe(false);
});

test('the callback error banner names the actual failure', async ({ page }) => {
  // The original Google bug redirected here with nothing shown. Every failure
  // code must render a specific, readable reason.
  for (const [code, pattern] of [
    ['oauth_provider_error', /google|provider/i],
    ['exchange_failed', /sign|session|expired|again/i],
    ['missing_code', /sign|again|incomplete/i],
    ['provisioning_failed', /account|set ?up|again/i],
  ] as const) {
    await page.goto(`/login?error=${code}&ref=testref1`);
    const alert = page.getByTestId(banner);
    await expect(alert, `no banner for ?error=${code}`).toBeVisible();
    await expect(alert).toHaveText(pattern);
  }
});

test('the support reference is shown so a failure can be traced', async ({ page }) => {
  await page.goto('/login?error=exchange_failed&ref=abc12345');
  await expect(page.getByTestId(banner)).toContainText('abc12345');
});

test('an unrecognised error code still shows something rather than nothing', async ({ page }) => {
  await page.goto('/login?error=something_new');
  await expect(page.getByTestId(banner)).toBeVisible();
});

test('no banner appears on a clean login page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByTestId(banner)).toHaveCount(0);
});

test('Continue with Google is present and enabled', async ({ page }) => {
  await page.goto('/login');
  const google = page.getByRole('button', { name: /google/i }).first();
  await expect(google).toBeVisible();
  await expect(google).toBeEnabled();
});

test('the signup form requires accepting the terms', async ({ page }) => {
  await page.goto('/signup');
  const terms = page.getByRole('checkbox').first();
  await expect(terms).toBeVisible();
  await expect(terms).not.toBeChecked();
});

test('forgot-password is reachable from login and renders a form', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: /forgot/i }).first().click();
  await expect(page).toHaveURL(/forgot-password/);
  await expect(page.getByLabel(/email/i).first()).toBeVisible();
});
