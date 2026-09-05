import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

/**
 * Playwright configuration.
 *
 * The suite is split by what it needs:
 *
 *   e2e/public/*      — flows any visitor can reach. These run everywhere,
 *                       including CI, and are the ones that gate a release.
 *   e2e/authenticated/* — flows that need a real Supabase session. They are
 *                       written and committed, but SKIP with a stated reason
 *                       unless UFO_E2E_EMAIL / UFO_E2E_PASSWORD are set. A
 *                       skipped test that says why is honest; a test that
 *                       fakes a session and asserts against the fake is not.
 *
 * The pre-installed Chromium is used where present rather than downloading
 * one, and PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD keeps npm from re-fetching it.
 */
const BASE_URL = process.env.BASE ?? 'http://localhost:3701';

const CHROMIUM = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
].find((p) => fs.existsSync(p));

export default defineConfig({
  testDir: './e2e',
  // Deliberately no retries: a test that only passes on a retry is a test that
  // reports something other than the truth. A flake is a bug to fix.
  retries: 0,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The app is served over plain HTTP locally.
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM, args: ['--no-sandbox'] } } : {}),
      },
    },
    {
      name: 'mobile',
      testMatch: /.*\.mobile\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM, args: ['--no-sandbox'] } } : {}),
      },
    },
  ],
});
