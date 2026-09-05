import { chromium } from 'playwright';
import fs from 'node:fs';

/**
 * The inspector's DOM half (lib/inspector-dom.ts) needs a real DOMParser, which
 * Node does not have — so unlike the pure half in lib/inspector.ts it cannot be
 * unit-tested. It is exercised here in a real browser instead.
 *
 * The module source is transpiled by stripping its TypeScript annotations and
 * evaluated in the page, so this tests the shipped logic rather than a
 * reimplementation of it.
 */
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

// Inline the two modules. `pathToString` is the only cross-module dependency,
// so it is provided rather than importing lib/inspector.ts wholesale.
const domSource = fs
  .readFileSync('lib/inspector-dom.ts', 'utf8')
  .replace(/^import[^;]+;$/gm, '')
  .replace(/export interface TreeNode \{[\s\S]*?\n\}/, '')
  .replace(/: TreeNode\[\]/g, '')
  .replace(/export /g, '')
  .replace(/\(root: Element, maxNodes = 500\)/, '(root, maxNodes = 500)')
  .replace(/\(element: Element, path: number\[\]\)/g, '(element, path)')
  .replace(/\(root: Element, path: number\[\]\): Element \| null/, '(root, path)')
  .replace(/\(root: Element\): string/, '(root)')
  .replace(/\(html: string\): Element/, '(html)')
  .replace(/\(element: Element\): string/, '(element)')
  .replace(/let node: Element \| null = root;/, 'let node = root;')
  .replace(/const nodes[^=]*=/, 'const nodes =')
  .replace(/const clone = root\.cloneNode\(true\) as Element;/, 'const clone = root.cloneNode(true);');

const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({
  content: `
    function pathToString(path) { return path.join('.'); }
    ${domSource}
    window.__inspector = { buildTree, elementAtPath, annotateForPreview, parseScreen };
  `,
});

const SAMPLE = `
<main class="p-6 bg-white">
  <h1 class="text-2xl">Welcome</h1>
  <section class="flex gap-2">
    <button class="btn">Sign in</button>
    <button class="btn">Sign up</button>
  </section>
  <svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>
</main>`;

const result = await page.evaluate((html) => {
  const { buildTree, elementAtPath, annotateForPreview, parseScreen } = window.__inspector;
  const root = parseScreen(html);
  const tree = buildTree(root);
  const annotated = annotateForPreview(root);

  return {
    paths: tree.map((n) => n.path),
    labels: tree.map((n) => n.label),
    depths: tree.map((n) => n.depth),
    // The second button, via its path: main(0) > section(1) > button(1).
    secondButton: elementAtPath(root, [0, 1, 1])?.textContent?.trim() ?? null,
    // The svg is main's third element child, so it addresses as 0.2.
    svgTag: elementAtPath(root, [0, 2])?.tagName?.toLowerCase() ?? null,
    outOfRange: elementAtPath(root, [0, 99]),
    negative: elementAtPath(root, [-1]),
    rootIsNotSelectable: elementAtPath(root, []),
    annotated,
    // The ORIGINAL must be untouched by annotation.
    originalHasAttribute: root.innerHTML.includes('data-ufo-path'),
    svgChildrenListed: tree.some((n) => n.tag === 'circle'),
  };
}, SAMPLE);

check('the tree lists every element in document order',
  result.paths.slice(0, 5).join(' ') === '0 0.0 0.1 0.1.0 0.1.1',
  result.paths.slice(0, 5).join(' '));

check('depth matches the path length', result.depths[0] === 1 && result.depths[3] === 3);

check('a leaf with short text is labelled by its text',
  result.labels.includes('h1 · Welcome'), result.labels[1]);

check('an element without text or id falls back to its first class',
  result.labels.some((l) => l === 'section.flex'), result.labels[2]);

check('an SVG is a single opaque layer, not its internals',
  result.svgChildrenListed === false);

check('a path resolves to the right element', result.secondButton === 'Sign up', String(result.secondButton));

check('an opaque element is still addressable, it just has no listed children',
  result.svgTag === 'svg', String(result.svgTag));

check('an out-of-range path resolves to null, not a crash', result.outOfRange === null);
check('a negative index resolves to null', result.negative === null);
check('the empty path does not select the container', result.rootIsNotSelectable === null);

check('annotation marks every element with its path',
  result.annotated.includes('data-ufo-path="0"') &&
  result.annotated.includes('data-ufo-path="0.1.1"'),
);

check('annotation does NOT mutate the source markup',
  result.originalHasAttribute === false,
  'data-ufo-path must never reach the stored screen code');

// ---------------------------------------------------------------------------
// The round trip that matters: an inspector edit must change only the style
// attribute of the element it targets.
// ---------------------------------------------------------------------------
const roundTrip = await page.evaluate((html) => {
  const { elementAtPath, parseScreen } = window.__inspector;
  const root = parseScreen(html);
  const target = elementAtPath(root, [0, 1]);
  target.setAttribute('style', 'color: red');
  const out = root.innerHTML;
  return {
    out,
    hasStyle: out.includes('style="color: red"'),
    keptClasses: out.includes('class="flex gap-2"'),
    buttonsIntact: (out.match(/<button/g) || []).length === 2,
    noPathAttrs: !out.includes('data-ufo-path'),
  };
}, SAMPLE);

check('an edit writes the style attribute', roundTrip.hasStyle);
check('an edit preserves the element’s classes', roundTrip.keptClasses);
check('an edit preserves sibling content', roundTrip.buttonsIntact);
check('the serialised output carries no inspector attributes', roundTrip.noPathAttrs);

// A deeply nested tree must not blow the node cap silently.
const capped = await page.evaluate(() => {
  const { buildTree, parseScreen } = window.__inspector;
  const deep = Array.from({ length: 800 }, (_, i) => `<div>${i}</div>`).join('');
  return buildTree(parseScreen(deep)).length;
});
check('the layer list is capped rather than unbounded', capped === 500, `${capped} nodes`);

await browser.close();
console.log(`\n${failures === 0 ? 'inspector: all checks passed' : `inspector: ${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
