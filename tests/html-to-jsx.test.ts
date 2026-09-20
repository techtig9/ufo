import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  htmlToJsx,
  styleToJsx,
  componentName,
  screenToComponent,
} from '../lib/export/html-to-jsx.ts';

test('class and for become their JSX spellings', () => {
  assert.equal(htmlToJsx('<div class="p-4"></div>'), '<div className="p-4"></div>');
  assert.equal(htmlToJsx('<label for="a"></label>'), '<label htmlFor="a"></label>');
});

test('TEXT is never rewritten, only attributes', () => {
  // The whole reason this is a scanner and not a regex. A screen whose copy
  // mentions class="..." must survive verbatim.
  const html = '<p>Use class="btn" in your HTML</p>';
  assert.equal(htmlToJsx(html), '<p>Use class="btn" in your HTML</p>');
  assert.ok(!htmlToJsx(html).includes('className="btn"'));
});

test('void elements are self-closed', () => {
  assert.equal(htmlToJsx('<br>'), '<br />');
  assert.equal(htmlToJsx('<img src="a.png" alt="x">'), '<img src="a.png" alt="x" />');
  assert.equal(htmlToJsx('<input type="text">'), '<input type="text" />');
  assert.equal(htmlToJsx('<hr/>'), '<hr />');
});

test('an inline style becomes an object', () => {
  assert.equal(styleToJsx('color: red'), `{{ color: "red" }}`);
  assert.equal(styleToJsx('font-size: 12px; margin-top: 4px'), `{{ fontSize: "12px", marginTop: "4px" }}`);
  assert.equal(htmlToJsx('<div style="color: red"></div>'), '<div style={{ color: "red" }}></div>');
});

test('a CSS custom property keeps its exact name, quoted', () => {
  // --brand-color camel-cased to brandColor would simply not apply.
  assert.equal(styleToJsx('--brand: #D4FF4F'), `{{ '--brand': "#D4FF4F" }}`);
});

test('an empty or malformed style does not produce broken JSX', () => {
  assert.equal(styleToJsx(''), '{{}}');
  assert.equal(styleToJsx(';;'), '{{}}');
  assert.equal(styleToJsx('color'), '{{}}');
});

test('boolean attributes survive without a value', () => {
  assert.equal(htmlToJsx('<input disabled>'), '<input disabled />');
  assert.equal(htmlToJsx('<button disabled>Go</button>'), '<button disabled>Go</button>');
});

test('data-* and aria-* keep their hyphens', () => {
  // These are the two families JSX passes through verbatim; camel-casing them
  // breaks the selector and the accessibility tree respectively.
  assert.equal(htmlToJsx('<div data-id="1" aria-label="x"></div>'), '<div data-id="1" aria-label="x"></div>');
});

test('SVG presentation attributes are camel-cased', () => {
  const out = htmlToJsx('<svg viewBox="0 0 8 8"><path stroke-width="2" fill-rule="evenodd"/></svg>');
  assert.match(out, /viewBox="0 0 8 8"/);
  assert.match(out, /strokeWidth="2"/);
  assert.match(out, /fillRule="evenodd"/);
});

test('an inline event handler is dropped, not emitted as a string prop', () => {
  const out = htmlToJsx('<button onclick="alert(1)" class="b">Go</button>');
  assert.ok(!out.includes('alert(1)'), 'inline JS must not survive into JSX');
  assert.match(out, /className="b"/);
});

test('an HTML comment becomes a JSX comment', () => {
  assert.equal(htmlToJsx('<!-- hi -->'), '{/* hi */}');
});

test('a comment containing */ cannot close the JSX comment early', () => {
  const out = htmlToJsx('<!-- a */ b -->');
  assert.equal(out.match(/\*\//g)?.length, 1, 'exactly one terminator, at the end');
});

test('braces in text are escaped', () => {
  // Unescaped, JSX reads { as the start of an expression and fails to parse.
  assert.equal(htmlToJsx('<p>a {b} c</p>'), `<p>a {'{'}b{'}'} c</p>`);
});

test("a '>' inside a quoted attribute does not end the tag early", () => {
  const out = htmlToJsx('<div title="a > b" class="x">t</div>');
  assert.match(out, /title="a > b"/);
  assert.match(out, /className="x"/);
  assert.match(out, />t<\/div>/);
});

test('an attribute value containing a double quote switches delimiters', () => {
  const out = htmlToJsx(`<div title='say "hi"'></div>`);
  assert.ok(out.includes(`title='say "hi"'`), `got: ${out}`);
});

test('the doctype is dropped', () => {
  assert.equal(htmlToJsx('<!DOCTYPE html><div></div>'), '<div></div>');
});

test('component names are valid React identifiers', () => {
  assert.equal(componentName('Home page'), 'HomePage');
  assert.equal(componentName('sign-up / step 2'), 'SignUpStep2');
  // A leading digit would make JSX treat it as an intrinsic element.
  assert.equal(componentName('404 page'), 'Screen404Page');
  assert.equal(componentName('!!!'), 'Screen');
  assert.equal(componentName(''), 'Screen');
});

test('a generated component is plausible TSX', () => {
  const out = screenToComponent('Home page', '<main class="p-4"><h1>Hi</h1></main>');
  assert.match(out, /export default function HomePage\(\)/);
  assert.match(out, /className="p-4"/);
  assert.match(out, /<>/);
  assert.match(out, /<\/>/);
  // Balanced braces are the cheapest structural check that catches a
  // half-emitted style object.
  assert.equal((out.match(/{/g) ?? []).length, (out.match(/}/g) ?? []).length);
});

test('nesting and whitespace are preserved', () => {
  const html = '<div class="a">\n  <span class="b">x</span>\n</div>';
  const out = htmlToJsx(html);
  assert.match(out, /<div className="a">\n {2}<span className="b">x<\/span>\n<\/div>/);
});

test('an unterminated tag does not throw or lose content', () => {
  assert.doesNotThrow(() => htmlToJsx('<div class="a"'));
  assert.doesNotThrow(() => htmlToJsx('<!-- never closed'));
  assert.ok(htmlToJsx('text <div').includes('text '));
});
