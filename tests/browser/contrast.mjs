import { chromium } from 'playwright';
import fs from 'node:fs';

/**
 * Real WCAG contrast measurement in both themes.
 *
 * The previous a11y check only asserted that a theme class was applied, which
 * says nothing about whether the result is readable — and light mode was in
 * fact broken: the dashboard chrome stayed near-black on a paper background,
 * and every `bg-white/5` surface was white-on-white. This walks the actual
 * rendered text and computes contrast against the effective background, so a
 * regression fails the build rather than merely looking wrong.
 */
const BASE = process.env.BASE || 'http://localhost:3700';
const ROUTES = ['/', '/login', '/signup', '/forgot-password', '/help', '/contact', '/legal/terms', '/changelog'];
const THEMES = ['dark', 'light'];

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] });

let failures = 0;
const worstByRoute = [];

for (const theme of THEMES) {
  const ctx = await browser.newContext();
  await ctx.addInitScript((t) => { try { localStorage.setItem('ufo-theme', t); } catch {} }, theme);
  const page = await ctx.newPage();

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });

    const results = await page.evaluate(() => {
      const parse = (c) => {
        const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
      };
      const lum = ({ r, g, b }) => {
        const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const over = (fg, bg) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      });
      // Walk up for the first non-transparent background, compositing as we go.
      const effectiveBg = (el) => {
        let node = el, stack = [];
        while (node && node !== document.documentElement) {
          const c = parse(getComputedStyle(node).backgroundColor);
          if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
          node = node.parentElement;
        }
        const root = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
        let acc = root;
        for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
        return acc;
      };

      const out = [];
      for (const el of document.querySelectorAll('p,span,a,h1,h2,h3,h4,label,li,button,td,th')) {
        const text = (el.textContent || '').trim();
        if (!text || el.children.length > 0) continue;
        // Decorative subtrees (product shots, mock UI) are pictures of an
        // interface, not interface text.
        if (el.closest('[aria-hidden="true"]')) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || +style.opacity === 0) continue;
        // Gradient-clipped headings paint through background-clip:text, so
        // their computed `color` is transparent and a naive ratio reads 1:1.
        // Not measurable this way — excluded rather than reported falsely.
        if (style.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || style.color === 'rgba(0, 0, 0, 0)') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) continue;

        const fg = parse(style.color);
        if (!fg) continue;
        const bg = effectiveBg(el);
        const composited = over(fg, bg);
        const l1 = lum(composited), l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

        const size = parseFloat(style.fontSize);
        const bold = +style.fontWeight >= 700;
        // WCAG AA: 3.0 for large text (>=24px, or >=18.66px bold), else 4.5.
        const required = size >= 24 || (size >= 18.66 && bold) ? 3.0 : 4.5;

        if (ratio < required) {
          out.push({ text: text.slice(0, 40), ratio: +ratio.toFixed(2), required, size: Math.round(size) });
        }
      }
      return out;
    });

    if (results.length) {
      failures += results.length;
      console.log(`FAIL ${theme.padEnd(5)} ${route}`);
      for (const r of results.slice(0, 5)) {
        console.log(`        ${r.ratio} < ${r.required}  ${r.size}px  "${r.text}"`);
      }
      if (results.length > 5) console.log(`        …and ${results.length - 5} more`);
    } else {
      worstByRoute.push(`${theme}${route}`);
    }
  }
  await ctx.close();
}

await browser.close();
console.log(`\nChecked ${THEMES.length * ROUTES.length} theme x route combinations for WCAG AA text contrast.`);
console.log(failures === 0 ? 'ALL TEXT MEETS WCAG AA IN BOTH THEMES' : `${failures} CONTRAST FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
