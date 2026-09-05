import { authTest as test, expect } from './fixtures';

/**
 * The signed-in surfaces this environment cannot reach: the dashboard, the
 * command palette, workspaces and the editor. See ./fixtures.ts for why these
 * skip rather than stub.
 */

test('the dashboard loads and shows a real credit balance', async ({ signedIn: page }) => {
  await expect(page).toHaveURL(/\/dashboard/);
  // A number, not a placeholder — the Master Command forbids fake numbers.
  const credits = page.getByText(/\d[\d,]*\s*credits?/i).first();
  await expect(credits).toBeVisible();
});

test('the command palette opens with the keyboard and searches', async ({ signedIn: page }) => {
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('listbox');
  await expect(palette).toBeVisible();

  await page.keyboard.type('bill');
  await expect(page.getByRole('option', { name: /billing/i }).first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
});

test('every sidebar destination loads without an error', async ({ signedIn: page }) => {
  for (const name of [/projects/i, /templates/i, /ai designer/i, /workspaces/i, /billing/i, /settings/i]) {
    await page.getByRole('link', { name }).first().click();
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('text=/error|something went wrong/i')).toHaveCount(0);
  }
});

test('creating a workspace lands on its detail page', async ({ signedIn: page }) => {
  await page.goto('/dashboard/workspaces');
  await page.getByRole('button', { name: /new workspace/i }).click();
  const name = `E2E ${Date.now()}`;
  await page.getByLabel(/workspace name/i).fill(name);
  await page.getByRole('button', { name: /create workspace/i }).click();

  await expect(page).toHaveURL(/\/dashboard\/workspaces\/[0-9a-f-]{36}/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  // The creator is its owner, and the roster shows them.
  await expect(page.getByText(/owner/i).first()).toBeVisible();
});

test('the settings notification toggles persist across a reload', async ({ signedIn: page }) => {
  await page.goto('/dashboard/settings');
  const toggle = page.getByRole('checkbox', { name: /mentioned or assigned/i });
  const before = await toggle.isChecked();
  await toggle.click();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /mentioned or assigned/i })).toBeChecked({
    checked: !before,
  });
});

test('no console errors on any authenticated route', async ({ signedIn: page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  for (const route of ['/dashboard', '/dashboard/projects', '/dashboard/templates', '/dashboard/workspaces', '/dashboard/billing', '/dashboard/settings']) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
  }

  // Hydration errors and React warnings both surface here.
  expect(errors, errors.join('\n')).toEqual([]);
});
