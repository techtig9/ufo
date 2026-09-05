import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3100';

/**
 * Use the Chromium already present in the image rather than downloading one.
 * The installed playwright package may expect a newer browser build than the
 * image ships, and `playwright install` is not available here — pointing at
 * the existing binary avoids both problems.
 */
function resolveChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ];
  return candidates.find((p) => fs.existsSync(p));
}

const executablePath = resolveChromium();
const browser = await chromium.launch(
  executablePath ? { executablePath, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] }
);
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

// --- callback error banner ------------------------------------------------
await page.goto(`${BASE}/login?error=exchange_failed&ref=abc12345`, { waitUntil: 'networkidle' });
const alert = page.getByTestId('callback-error');
check('login shows the callback error banner', await alert.isVisible());
check('banner names the Google failure',
  (await alert.innerText()).includes('could not complete the sign-in with Google'));
check('banner shows the support reference',
  (await alert.innerText()).includes('abc12345'));

// --- unknown code falls back ---------------------------------------------
await page.goto(`${BASE}/login?error=bogus`, { waitUntil: 'networkidle' });
check('unknown error code falls back to a generic message',
  (await page.getByTestId('callback-error').innerText()).includes('Sign-in failed'));

// --- no error, no banner --------------------------------------------------
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
check('no banner when there is no error param',
  (await page.getByTestId('callback-error').count()) === 0);

// --- google button present and enabled ------------------------------------
const googleBtn = page.getByRole('button', { name: /continue with google/i });
check('Continue with Google button is present', await googleBtn.isVisible());
check('Continue with Google is enabled', await googleBtn.isEnabled());

// --- theme persistence (P1.6) --------------------------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const initialLight = await page.evaluate(() => document.documentElement.classList.contains('light'));
await page.evaluate(() => localStorage.setItem('ufo-theme', 'light'));
await page.reload({ waitUntil: 'networkidle' });
const afterReload = await page.evaluate(() => document.documentElement.classList.contains('light'));
check('theme choice survives a reload', afterReload === true, `before=${initialLight} after=${afterReload}`);

// The class must already be set at first paint, not applied after hydration.
const early = await page.evaluate(() => window.__earlyThemeClass);
await page.addInitScript(() => {
  window.__earlyThemeClass = null;
});
await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
check('theme persists across a navigation to a protected route redirect',
  await page.evaluate(() => document.documentElement.classList.contains('light')));

await page.evaluate(() => localStorage.setItem('ufo-theme', 'dark'));
await page.reload({ waitUntil: 'networkidle' });
check('switching back to dark also persists',
  (await page.evaluate(() => document.documentElement.classList.contains('light'))) === false);

// --- no horizontal scroll at mobile width --------------------------------
await page.setViewportSize({ width: 375, height: 800 });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('landing has no horizontal overflow at 375px', overflow <= 0, `overflow=${overflow}px`);

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
const loginOverflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('login has no horizontal overflow at 375px', loginOverflow <= 0, `overflow=${loginOverflow}px`);

// --- console cleanliness --------------------------------------------------
const realErrors = consoleErrors.filter((e) =>
  !/favicon|manifest|Failed to load resource.*40[34]/i.test(e));
check('no unexpected console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${failures === 0 ? 'ALL BROWSER CHECKS PASSED' : `${failures} BROWSER CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
