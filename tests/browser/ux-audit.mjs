import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The Phase 5.F honesty sweep, automated.
 *
 * The Master Command lists what must not ship: dead buttons, broken links,
 * placeholder copy, fake numbers, stale pricing, stale credit counts, fake
 * features, misleading feature descriptions, console errors, hydration errors,
 * accessibility blockers.
 *
 * Most of those are checkable mechanically, and a check that runs is worth
 * more than a promise that someone looked. The ones that are not — whether a
 * description is *misleading* — are judgement, and are recorded in the phase
 * notes instead of pretended here.
 */

const BASE = process.env.BASE || 'http://localhost:3701';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// ---------------------------------------------------------------------------
// 1. Placeholder copy in the source.
//
// Scanned in the source rather than the DOM: a placeholder on a route that
// needs a session would never be rendered here, and would ship anyway.
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', 'test-results', '.perf'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|mdx?)$/.test(full)) out.push(full);
  }
  return out;
}

const sourceFiles = ['app', 'components', 'lib'].flatMap((d) => walk(d));

const PLACEHOLDERS = [
  /\[Your [A-Za-z ]+\]/,
  /\[your [a-z ]+\]/,
  /\byour-domain\b/i,
  /\bexample\.com\b/,
  // "no lorem ipsum" appears in an AI prompt as a PROHIBITION — matching it
  // there would flag the instruction that prevents the problem.
  /(?<!no )\bLorem ipsum\b/i,
  /\bTODO:? (?:add|fill|replace|write)/i,
  /\bFIXME\b/,
  /\bCHANGEME\b/i,
  /\bXXX\b/,
  /\bcoming soon\b/i,
  /\bPhase \d\)/,
];

const placeholderHits = [];
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  // Only user-visible strings matter — a comment explaining why something is
  // unavailable is documentation, not a placeholder.
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  for (const pattern of PLACEHOLDERS) {
    const match = withoutComments.match(pattern);
    if (match) placeholderHits.push(`${file}: ${match[0]}`);
  }
}

check(
  'no placeholder copy in user-visible strings',
  placeholderHits.length === 0,
  placeholderHits.length ? `\n    ${placeholderHits.join('\n    ')}` : 'scanned ' + sourceFiles.length + ' files'
);

// ---------------------------------------------------------------------------
// 2. Dead controls in the source.
//
// A button with no onClick, no type="submit", no href and no `disabled` is a
// control that does nothing when clicked.
// ---------------------------------------------------------------------------

/**
 * A control is dead when clicking it does nothing.
 *
 * The attributes alone are not enough to tell: `<Link><Button>Go</Button></Link>`
 * is the idiomatic way to make a button navigate, and a `<Button>` inside a
 * `<form>` submits it. So the 200 characters before the tag are inspected too —
 * a first version of this check that looked only at the tag reported 21
 * "dead" controls, every one of which was one of those two patterns.
 */
const deadControls = [];
for (const file of sourceFiles.filter((f) => f.endsWith('.tsx'))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<(?:button|Button)\b/g)) {
    const index = match.index ?? 0;
    // Scan to the '>' that actually closes the tag, tracking brace and
    // backtick depth. A plain /[^>]*>/ stops inside id={`cmd-${c.id}`} and
    // reports a button with a real onClick as dead.
    let depth = 0;
    let inTemplate = false;
    let end = index;
    for (let i = index + match[0].length; i < source.length; i++) {
      const char = source[i];
      if (char === '`') inTemplate = !inTemplate;
      else if (!inTemplate && char === '{') depth++;
      else if (!inTemplate && char === '}') depth--;
      else if (!inTemplate && depth === 0 && char === '>') { end = i; break; }
    }
    const attrs = source.slice(index + match[0].length, end);
    const before = source.slice(Math.max(0, index - 200), index);

    const selfActing =
      /onClick|onSubmit|type=["{]?submit|type=["{]?reset|disabled|formAction|href|asChild/.test(attrs) ||
      /\{\.\.\./.test(attrs);

    // Wrapped in a Link, or inside a form with no intervening close tag.
    const wrapped =
      /<Link\b[^>]*>\s*$/.test(before) ||
      /<a\b[^>]*>\s*$/.test(before) ||
      (/<form\b/.test(before) && !/<\/form>/.test(before));

    if (!selfActing && !wrapped) {
      deadControls.push(`${file}: <button${attrs.slice(0, 60)}>`);
    }
  }
}

check(
  'no button is rendered without a handler, submit type, or disabled state',
  deadControls.length === 0,
  deadControls.length ? `\n    ${deadControls.join('\n    ')}` : ''
);

// ---------------------------------------------------------------------------
// 3. Live checks in the browser.
// ---------------------------------------------------------------------------

const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] });
const context = await browser.newContext();
await context.addInitScript(() => {
  try { localStorage.setItem('ufo-cookie-consent', 'accepted'); } catch {}
});
const page = await context.newPage();

const ROUTES = [
  '/', '/login', '/signup', '/forgot-password', '/help', '/contact',
  '/changelog', '/legal/terms', '/legal/privacy', '/legal/cookies', '/legal/refunds',
  '/invite?token=ux-audit-probe',
];

const consoleErrors = [];
const hydrationErrors = [];
page.on('pageerror', (error) => {
  const message = error.message;
  // React 418/423/425 are the hydration mismatch family.
  if (/Minified React error #(418|423|425)|Hydration failed|did not match/.test(message)) {
    hydrationErrors.push(`${page.url()}: ${message.slice(0, 120)}`);
  } else {
    consoleErrors.push(`${page.url()}: ${message.slice(0, 120)}`);
  }
});
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (/Hydration|hydration|did not match/.test(text)) hydrationErrors.push(`${page.url()}: ${text.slice(0, 120)}`);
  else consoleErrors.push(`${page.url()}: ${text.slice(0, 120)}`);
});

const allLinks = new Set();
const emptyHeadings = [];
const imagesWithoutAlt = [];

for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });

  const found = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && h.startsWith('/'));

    const headings = [...document.querySelectorAll('h1,h2,h3')]
      .filter((h) => !h.textContent?.trim()).length;

    const images = [...document.querySelectorAll('img')]
      .filter((img) => !img.hasAttribute('alt')).length;

    return { links, headings, images };
  });

  for (const href of found.links) allLinks.add(href);
  if (found.headings) emptyHeadings.push(`${route}: ${found.headings}`);
  if (found.images) imagesWithoutAlt.push(`${route}: ${found.images}`);
}

check('no console errors on any public route', consoleErrors.length === 0,
  consoleErrors.length ? `\n    ${consoleErrors.join('\n    ')}` : `${ROUTES.length} routes`);

check('no hydration errors on any public route', hydrationErrors.length === 0,
  hydrationErrors.length ? `\n    ${hydrationErrors.join('\n    ')}` : '');

check('no empty headings', emptyHeadings.length === 0, emptyHeadings.join(', '));
check('every image has an alt attribute', imagesWithoutAlt.length === 0, imagesWithoutAlt.join(', '));

// Every internal link on every public page, fetched.
const brokenLinks = [];
for (const href of allLinks) {
  const response = await page.request.get(`${BASE}${href}`, { failOnStatusCode: false });
  // 3xx is legitimate for a protected route; 4xx/5xx is not.
  if (response.status() >= 400) brokenLinks.push(`${href} -> ${response.status()}`);
}

check(
  'every internal link resolves',
  brokenLinks.length === 0,
  brokenLinks.length ? `\n    ${brokenLinks.join('\n    ')}` : `${allLinks.size} unique links checked`
);

// ---------------------------------------------------------------------------
// 4. Pricing shown to a visitor must equal what the code enforces.
// ---------------------------------------------------------------------------

const { PLAN_PRICE_USD, PLAN_MONTHLY_CREDITS } = await import('../../lib/credits.ts');

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
// "$ 15" in the DOM: the dollar sign sits outside the <CountUp> span, so
// innerText puts a space between them. Normalised before comparing, since the
// question is whether the right NUMBER is shown, not how it is marked up.
const pageText = (await page.locator('body').innerText())
  .replace(/\s+/g, ' ')
  .replace(/\$\s+/g, '$');

const pricingMismatches = [];
for (const [plan, price] of Object.entries(PLAN_PRICE_USD)) {
  if (plan === 'free') continue;
  // Only assert when the landing page actually names the plan.
  const namesPlan = new RegExp(`\\b${plan}\\b`, 'i').test(pageText);
  if (namesPlan && !pageText.includes(`$${price}`)) {
    pricingMismatches.push(`${plan} is shown but $${price} is not`);
  }
}

check(
  'pricing on the landing page matches PLAN_PRICE_USD',
  pricingMismatches.length === 0,
  pricingMismatches.length ? pricingMismatches.join(', ') : 'checked against the enforced constants'
);

const creditMismatches = [];
for (const [plan, credits] of Object.entries(PLAN_MONTHLY_CREDITS)) {
  const namesPlan = new RegExp(`\\b${plan}\\b`, 'i').test(pageText);
  if (namesPlan && !pageText.includes(credits.toLocaleString()) && !pageText.includes(String(credits))) {
    creditMismatches.push(`${plan}: ${credits.toLocaleString()} not shown`);
  }
}

check(
  'credit counts on the landing page match PLAN_MONTHLY_CREDITS',
  creditMismatches.length === 0,
  creditMismatches.length ? creditMismatches.join(', ') : 'checked against the enforced constants'
);

await browser.close();
console.log(`\n${failures === 0 ? 'UX AUDIT CLEAN' : `${failures} UX AUDIT FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
