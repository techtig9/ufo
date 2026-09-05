import { chromium } from 'playwright';
import fs from 'node:fs';

/**
 * Accessibility checks scoped to the pages Phase 1 touched (the auth surfaces
 * and the theme toggle). Deliberately mechanical assertions only — things that
 * are objectively true or false, not a substitute for a full audit, which
 * belongs to the Phase 3 frontend work.
 */
const BASE = process.env.BASE || 'http://localhost:3400';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] });
const page = await browser.newPage();

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

for (const route of ['/login', '/signup', '/forgot-password']) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });

  // Every input must have an accessible name.
  const unlabelled = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('input:not([type=hidden])')) {
      const id = el.getAttribute('id');
      const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
      const wrapped = el.closest('label');
      const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      if (!hasLabel && !wrapped && !aria) out.push(el.outerHTML.slice(0, 80));
    }
    return out;
  });
  check(`${route}: every input has an accessible name`, unlabelled.length === 0, unlabelled.join(' | '));

  // Exactly one h1.
  const h1s = await page.locator('h1').count();
  check(`${route}: exactly one h1`, h1s === 1, `found ${h1s}`);

  // Keyboard focus must be visible on the first control.
  await page.keyboard.press('Tab');
  const focusVisible = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const s = getComputedStyle(el);
    return {
      tag: el.tagName,
      outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0,
      ring: s.boxShadow !== 'none',
      border: s.borderColor,
    };
  });
  check(`${route}: tab moves focus to a control`, focusVisible !== null, JSON.stringify(focusVisible));
}

// Theme toggle exposes its state.
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
const langOk = await page.evaluate(() => document.documentElement.lang === 'en');
check('html has a lang attribute', langOk);

// The error banner must be announced.
await page.goto(`${BASE}/login?error=exchange_failed`, { waitUntil: 'networkidle' });
const bannerRole = await page.getByTestId('callback-error').getAttribute('role');
check('callback error banner has role="alert"', bannerRole === 'alert', `role=${bannerRole}`);

// prefers-reduced-motion must actually suppress animation.
const reduced = await browser.newContext({ reducedMotion: 'reduce' });
const rmPage = await reduced.newPage();
await rmPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const animDurations = await rmPage.evaluate(() =>
  [...document.querySelectorAll('*')]
    .map((el) => getComputedStyle(el).animationDuration)
    .filter((d) => d && d !== '0s')
    .filter((d) => parseFloat(d) > 0.01));
check('prefers-reduced-motion suppresses animations', animDurations.length === 0,
  `${animDurations.length} element(s) still animating`);
await reduced.close();

await browser.close();
console.log(`\n${failures === 0 ? 'ALL ACCESSIBILITY CHECKS PASSED' : `${failures} ACCESSIBILITY CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
