import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Performance measurement, and a budget that fails on regression.
 *
 * Two halves, because they answer different questions:
 *
 *   1. Bundle sizes from the build output on disk. Deterministic, and the
 *      number that actually predicts a slow first load.
 *   2. Core Web Vitals measured in Chromium via PerformanceObserver — LCP and
 *      CLS as the browser reports them, not a proxy for them.
 *
 * Lighthouse itself is not used: it is a large extra dependency, and on a
 * single unthrottled container its scores mostly measure the container. The
 * underlying metrics it reports are collected here directly.
 */

const BASE = process.env.BASE || 'http://localhost:3701';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

// ---------------------------------------------------------------------------
// 1. What ships.
// ---------------------------------------------------------------------------

const chunkDir = '.next/static/chunks';
if (!fs.existsSync(chunkDir)) {
  console.error('No build found — run `npm run build` first.');
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const chunks = walk(chunkDir).filter((f) => f.endsWith('.js'));
const totalJs = chunks.reduce((sum, f) => sum + fs.statSync(f).size, 0);
const largest = chunks
  .map((f) => ({ file: path.relative(chunkDir, f), size: fs.statSync(f).size }))
  .sort((a, b) => b.size - a.size);

console.log('\n=== Client JavaScript on disk (uncompressed) ===');
console.log(`  ${chunks.length} chunks, ${kb(totalJs)} total`);
for (const { file, size } of largest.slice(0, 5)) console.log(`    ${kb(size).padStart(10)}  ${file}`);

/**
 * Monaco must stay code-split.
 *
 * It is the single largest dependency in the project. It is loaded through
 * next/dynamic with ssr:false so it arrives only when someone opens the Code
 * tab — if it ever lands in a chunk the landing page loads, every visitor pays
 * for an editor they may never open.
 */
const monacoChunks = largest.filter(({ file }) => /monaco|editor\.(main|worker)/i.test(file));
console.log('\n=== Monaco ===');
if (monacoChunks.length === 0) {
  console.log('  not present as a separate chunk (bundled by the CDN loader at runtime)');
} else {
  for (const { file, size } of monacoChunks.slice(0, 3)) console.log(`    ${kb(size).padStart(10)}  ${file}`);
}

// ---------------------------------------------------------------------------
// 2. What a browser actually experiences.
// ---------------------------------------------------------------------------

const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  args: ['--no-sandbox'],
});

const ROUTES = ['/', '/login', '/signup', '/help'];
const results = [];

for (const route of ROUTES) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });

  /**
   * Sizes come from the Resource Timing API, not from Content-Length headers.
   *
   * The first version of this file summed Content-Length and reported 1.9 KB
   * of JavaScript for a page loading over a megabyte of it — Next serves
   * chunked, compressed responses with no Content-Length at all, so the budget
   * check was passing because it was measuring nothing. `encodedBodySize` is
   * the bytes that actually crossed the wire; `decodedBodySize` is what the
   * browser then had to parse, and both are worth knowing.
   */
  const transfer = await page.evaluate(() => {
    const buckets = { js: 0, css: 0, image: 0, font: 0, other: 0 };
    const decoded = { js: 0, css: 0, image: 0, font: 0, other: 0 };
    for (const entry of performance.getEntriesByType('resource')) {
      const name = entry.name;
      const bucket = entry.initiatorType === 'script' || /\.js(\?|$)/.test(name)
        ? 'js'
        : entry.initiatorType === 'link' || /\.css(\?|$)/.test(name)
          ? 'css'
          : /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(name)
            ? 'image'
            : /\.(woff2?|ttf|otf)(\?|$)/.test(name)
              ? 'font'
              : 'other';
      buckets[bucket] += entry.encodedBodySize || 0;
      decoded[bucket] += entry.decodedBodySize || 0;
    }
    return { ...buckets, decodedJs: decoded.js };
  });

  const metrics = await page.evaluate(async () => {
    // LCP and CLS come from the browser's own observers rather than a
    // stand-in: a hand-rolled approximation of LCP is not LCP.
    const lcp = await new Promise((resolve) => {
      let value = 0;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) value = entry.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch { /* unsupported */ }
      setTimeout(() => resolve(value), 600);
    });

    const cls = await new Promise((resolve) => {
      let value = 0;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) value += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch { /* unsupported */ }
      setTimeout(() => resolve(value), 600);
    });

    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;

    return {
      ttfb: Math.round(nav?.responseStart ?? 0),
      fcp: Math.round(fcp),
      lcp: Math.round(lcp),
      cls: Number(cls.toFixed(4)),
      domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      scripts: performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'script').length,
    };
  });

  results.push({ route, ...metrics, transfer });
  await context.close();
}

console.log('\n=== Core Web Vitals (local, unthrottled — relative numbers, not field data) ===');
console.log('  route         TTFB     FCP     LCP     CLS   JS transferred');
for (const r of results) {
  console.log(
    `  ${r.route.padEnd(12)} ${String(r.ttfb).padStart(5)}ms ${String(r.fcp).padStart(6)}ms ` +
    `${String(r.lcp).padStart(6)}ms ${String(r.cls).padStart(7)}   ${kb(r.transfer.js)}`
  );
}

// ---------------------------------------------------------------------------
// 3. The budget.
//
// Deliberately generous: this exists to catch a regression — a heavy import
// landing on the landing page — not to chase a score. A budget tight enough to
// fail on noise is a budget that gets deleted.
// ---------------------------------------------------------------------------
console.log('\n=== Budget ===');

const BUDGET_TOTAL_JS = 4 * 1024 * 1024;
check(
  'total client JS on disk is within budget',
  totalJs <= BUDGET_TOTAL_JS,
  `${kb(totalJs)} of ${kb(BUDGET_TOTAL_JS)}`
);

const landing = results.find((r) => r.route === '/');
check(
  'the landing page sends under 400 KB of JS over the wire',
  landing.transfer.js > 0 && landing.transfer.js <= 400 * 1024,
  landing.transfer.js === 0
    ? 'measured 0 bytes — the measurement itself is broken, not the page'
    : `${kb(landing.transfer.js)} compressed, ${kb(landing.transfer.decodedJs)} parsed`
);

check(
  'every measured route sends under 500 KB of JS over the wire',
  results.every((r) => r.transfer.js > 0 && r.transfer.js <= 500 * 1024),
  results.map((r) => `${r.route} ${kb(r.transfer.js)}`).join(', ')
);

check(
  'CLS is good (<= 0.1) on every measured route',
  results.every((r) => r.cls <= 0.1),
  results.map((r) => `${r.route} ${r.cls}`).join(', ')
);

check(
  'LCP is under 2.5s on every measured route',
  results.every((r) => r.lcp === 0 || r.lcp <= 2500),
  results.map((r) => `${r.route} ${r.lcp}ms`).join(', ')
);

// The one that matters most, and the reason this file exists.
const publicPageScripts = await (async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const urls = [];
  page.on('response', (r) => { if (r.request().resourceType() === 'script') urls.push(r.url()); });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await context.close();
  return urls;
})();

check(
  'Monaco is NOT loaded on a public page',
  !publicPageScripts.some((u) => /monaco|editor\.main/i.test(u)),
  `${publicPageScripts.length} scripts on /login`
);

const sourceMapsShipped = walk('.next/static').filter((f) => f.endsWith('.map')).length;
check(
  'no source maps are served to the browser',
  sourceMapsShipped === 0,
  sourceMapsShipped ? `${sourceMapsShipped} .map files in .next/static` : 'none'
);

await browser.close();

// Machine-readable, so a CI job can trend these rather than re-deriving them.
fs.mkdirSync('.perf', { recursive: true });
fs.writeFileSync(
  '.perf/latest.json',
  JSON.stringify({ measuredAt: new Date().toISOString(), totalJs, routes: results }, null, 2)
);

console.log(`\n${failures === 0 ? 'PERFORMANCE BUDGET MET' : `${failures} BUDGET FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
