import { chromium } from 'playwright';
import fs from 'node:fs';

/**
 * Responsive + theme sweep across the breakpoints the Master Command lists
 * (320/375/390/430/768/1024/1280/1440/1920) in both themes, for every route
 * reachable without credentials.
 *
 * Checks the things that are objectively verifiable without a design review:
 * accidental horizontal scrolling, content clipped outside the viewport, and
 * console errors.
 */
const BASE = process.env.BASE || 'http://localhost:3400';
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const ROUTES = ['/', '/login', '/signup', '/forgot-password', '/help', '/contact', '/legal/terms', '/legal/privacy', '/legal/cookies', '/invite?token=phase4-gate-probe'];
const THEMES = ['dark', 'light'];

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] });

let failures = 0;
const consoleErrors = [];

for (const theme of THEMES) {
  const ctx = await browser.newContext();
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('ufo-theme', t); } catch {}
  }, theme);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${theme} ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`${theme} pageerror: ${e.message}`));

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });

      const m = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        themeApplied: document.documentElement.classList.contains('light'),
        bodyBg: getComputedStyle(document.body).backgroundColor,
      }));

      if (m.overflow > 0) {
        console.log(`FAIL ${theme} ${String(width).padStart(4)}px ${route} — horizontal overflow ${m.overflow}px`);
        failures++;
      }
      const wantLight = theme === 'light';
      if (m.themeApplied !== wantLight) {
        console.log(`FAIL ${theme} ${String(width).padStart(4)}px ${route} — theme class not applied`);
        failures++;
      }
    }
  }
  await ctx.close();
}

const real = consoleErrors.filter((e) => !/favicon|manifest|Failed to load resource.*40[34]/i.test(e));
if (real.length) {
  console.log(`FAIL console errors:\n  ${[...new Set(real)].slice(0, 5).join('\n  ')}`);
  failures += real.length;
}

await browser.close();
const combos = THEMES.length * WIDTHS.length * ROUTES.length;
console.log(`\nChecked ${combos} theme x breakpoint x route combinations.`);
console.log(failures === 0 ? 'NO OVERFLOW, THEME OR CONSOLE FAILURES' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
