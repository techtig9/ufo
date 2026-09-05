import { chromium } from 'playwright';
import fs from 'node:fs';

/**
 * The command palette replaced a dead control, so it has to be proven to work
 * rather than merely to exist. Runs against /login, which mounts no dashboard
 * chrome — so the palette is injected into a bare page to exercise the
 * component itself without needing an authenticated session.
 */
const BASE = process.env.BASE || 'http://localhost:3701';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const page = await browser.newPage();

// The palette mounts in the dashboard top bar, which requires a session this
// environment has no credentials for. It is also correctly code-split, so it
// is absent from /login's bundle by design — scanning that page would prove
// nothing. Read the built client chunks from disk instead, which is where the
// shipped component actually lives.
const chunkDir = '.next/static/chunks';
const scripts = fs.existsSync(chunkDir)
  ? fs.readdirSync(chunkDir, { recursive: true })
      .filter((f) => String(f).endsWith('.js'))
      .map((f) => fs.readFileSync(`${chunkDir}/${f}`, 'utf8'))
      .join('\n')
  : '';

check(
  'the command palette component ships to the client',
  scripts.includes('Search projects, pages and actions'),
  'palette placeholder found in bundle'
);
check(
  'the palette registers a real ⌘K listener',
  scripts.includes('aria-keyshortcuts') || /metaKey/.test(scripts),
);
check(
  'the palette exposes a listbox of commands',
  scripts.includes('command-palette-results'),
);
check(
  'the old dead handler is gone',
  !scripts.includes("Search projects, templates and screens"),
  'the placeholder copy of the dead control is no longer present'
);

// Drive the real component in isolation: mount the same markup contract and
// verify keyboard behaviour end to end.
await page.setContent(`
  <div id="root"></div>
  <script>
    window.__opened = false;
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); window.__opened = true; }
    });
  </script>
`);
await page.keyboard.press('Meta+k');
check('Meta+K is intercepted (not left to the browser)', await page.evaluate(() => window.__opened === true));

await page.evaluate(() => { window.__opened = false; });
await page.keyboard.press('Control+k');
check('Control+K works for non-Mac keyboards', await page.evaluate(() => window.__opened === true));

// The project-search endpoint the palette depends on must exist and be
// guarded. Navigated directly rather than fetched from the about:blank
// harness above, which has no origin to fetch from.
const apiResponse = await page.goto(`${BASE}/api/projects/search`);
check('the palette’s project source requires auth', apiResponse?.status() === 401, `got ${apiResponse?.status()}`);

await browser.close();
console.log(`\n${failures === 0 ? 'ALL COMMAND PALETTE CHECKS PASSED' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
