import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INSPECTOR_FIELDS,
  INSPECTOR_GROUPS,
  isInspectableProperty,
  isSafeCssValue,
  parseStyleAttribute,
  serializeStyleAttribute,
  setStyleDeclaration,
  pathToString,
  parsePath,
  isDescendantPath,
} from '../lib/inspector.ts';

// ---------------------------------------------------------------------------
// Safety. Edited HTML is stored as the screen's code and later rendered for
// anyone with the share link, so a CSS value is untrusted content.
// ---------------------------------------------------------------------------

test('an ordinary CSS value is accepted', () => {
  for (const value of ['16px', '1.5', 'rgba(0,0,0,.2)', '#3A7BD5', 'clamp(1rem, 2vw, 2rem)', '0 8px 24px rgba(0,0,0,.2)', 'flex-start']) {
    assert.ok(isSafeCssValue(value), `${value} accepted`);
  }
});

test('a value that could escape the attribute is rejected', () => {
  for (const value of ['red"', "red'", 'red<script>', 'red>', 'a;color:red', 'a\\3c ']) {
    assert.equal(isSafeCssValue(value), false, `${JSON.stringify(value)} rejected`);
  }
});

test('external and script references are rejected', () => {
  for (const value of [
    'url(https://evil.example/x.png)',
    'URL( https://evil.example )',
    'u r l(x)',
    'expression(alert(1))',
    'javascript:alert(1)',
    'image-set("a.png" 1x)',
    'element(#x)',
    '@import "evil.css"',
  ]) {
    assert.equal(isSafeCssValue(value), false, `${value} rejected`);
  }
});

test('a comment cannot be used to swallow the rest of the attribute', () => {
  assert.equal(isSafeCssValue('red /* '), false);
  assert.equal(isSafeCssValue('*/ red'), false);
});

test('control characters are rejected', () => {
  assert.equal(isSafeCssValue('red' + String.fromCharCode(10) + 'x'), false);
  assert.equal(isSafeCssValue('red' + String.fromCharCode(0)), false);
});

test('an absurdly long value is rejected', () => {
  assert.equal(isSafeCssValue('a'.repeat(201)), false);
  assert.ok(isSafeCssValue('a'.repeat(200)));
});

test('an empty value is safe — it means "remove this declaration"', () => {
  assert.ok(isSafeCssValue(''));
});

// ---------------------------------------------------------------------------
// Property allow-list.
// ---------------------------------------------------------------------------

test('only catalogued properties are inspectable', () => {
  for (const field of INSPECTOR_FIELDS) assert.ok(isInspectableProperty(field.property), field.property);
  for (const other of ['behavior', 'content', '-moz-binding', 'position', 'COLOR ']) {
    assert.equal(isInspectableProperty(other), false, other);
  }
});

test('every field belongs to a rendered group', () => {
  for (const field of INSPECTOR_FIELDS) {
    assert.ok(INSPECTOR_GROUPS.includes(field.group), `${field.property} in ${field.group}`);
  }
});

test('every select field offers an empty option, so a value can be cleared', () => {
  for (const field of INSPECTOR_FIELDS.filter((f) => f.kind === 'select')) {
    assert.ok(field.options?.includes(''), `${field.property} can be cleared`);
  }
});

test('the field catalogue covers what the spec asks for', () => {
  const properties = new Set(INSPECTOR_FIELDS.map((f) => f.property));
  for (const required of [
    'font-size', 'font-weight', 'line-height',   // typography
    'color', 'background-color',                  // colours
    'padding', 'margin',                          // spacing
    'border-width', 'border-color',               // borders
    'border-radius',                              // radius
    'box-shadow',                                 // shadows
  ]) {
    assert.ok(properties.has(required), required);
  }
});

// ---------------------------------------------------------------------------
// Declarations.
// ---------------------------------------------------------------------------

test('a style attribute round-trips', () => {
  const parsed = parseStyleAttribute('color: red; font-size: 16px');
  assert.deepEqual(parsed, { color: 'red', 'font-size': '16px' });
  assert.equal(serializeStyleAttribute(parsed), 'color: red; font-size: 16px');
});

test('parsing tolerates the mess real attributes contain', () => {
  assert.deepEqual(parseStyleAttribute('  COLOR :  red ;;  '), { color: 'red' });
  assert.deepEqual(parseStyleAttribute(''), {});
  assert.deepEqual(parseStyleAttribute('nonsense'), {});
  assert.deepEqual(parseStyleAttribute('color:'), {}, 'an empty value is not a declaration');
});

test('a later declaration wins, as in CSS', () => {
  assert.deepEqual(parseStyleAttribute('color: red; color: blue'), { color: 'blue' });
});

test('serialization is stable, so an edit produces a minimal diff', () => {
  const a = serializeStyleAttribute({ 'font-size': '16px', color: 'red' });
  const b = serializeStyleAttribute({ color: 'red', 'font-size': '16px' });
  assert.equal(a, b);
});

test('setting a declaration adds it without disturbing the others', () => {
  assert.equal(setStyleDeclaration('color: red', 'font-size', '16px'), 'color: red; font-size: 16px');
});

test('setting an existing declaration replaces it', () => {
  assert.equal(setStyleDeclaration('color: red', 'color', 'blue'), 'color: blue');
});

test('clearing a field REMOVES the declaration rather than emptying it', () => {
  // Otherwise clearing would pin the property to nothing instead of reverting
  // to whatever the element's classes say.
  assert.equal(setStyleDeclaration('color: red; margin: 0', 'color', ''), 'margin: 0');
  assert.equal(setStyleDeclaration('color: red', 'color', ''), '');
});

test('an uninspectable property is refused, not written', () => {
  assert.equal(setStyleDeclaration('color: red', 'position', 'fixed'), null);
  assert.equal(setStyleDeclaration('color: red', '-moz-binding', 'url(x)'), null);
});

test('an unsafe value is refused, not written', () => {
  assert.equal(setStyleDeclaration('', 'color', 'red; position: fixed'), null);
  assert.equal(setStyleDeclaration('', 'background-color', 'url(https://evil.example)'), null);
  assert.equal(setStyleDeclaration('', 'color', 'red"'), null);
});

test('a refused write leaves the original attribute untouched', () => {
  const original = 'color: red';
  assert.equal(setStyleDeclaration(original, 'color', 'blue"'), null);
  assert.equal(parseStyleAttribute(original).color, 'red');
});

test('property names are matched case-insensitively', () => {
  assert.equal(setStyleDeclaration('', 'COLOR', 'red'), 'color: red');
});

// ---------------------------------------------------------------------------
// Element paths. These arrive from a sandboxed iframe, so they are untrusted.
// ---------------------------------------------------------------------------

test('a path round-trips', () => {
  assert.equal(pathToString([0, 2, 1]), '0.2.1');
  assert.deepEqual(parsePath('0.2.1'), [0, 2, 1]);
  assert.deepEqual(parsePath(''), []);
});

test('a malformed path is rejected rather than coerced', () => {
  for (const bad of ['a', '0.a', '-1', '0..1', '1.', '.1', '0.5e3', '1e999', ' 1']) {
    assert.equal(parsePath(bad), null, `${JSON.stringify(bad)} rejected`);
  }
});

test('a path with an unsafe integer is rejected', () => {
  assert.equal(parsePath('99999999999999999999'), null);
});

test('descendant paths are recognised', () => {
  assert.ok(isDescendantPath('0.1.2', '0.1'));
  assert.ok(isDescendantPath('0.1', '0.1'));
  assert.ok(isDescendantPath('0.1', ''), 'everything descends from the root');
  assert.equal(isDescendantPath('0.10', '0.1'), false, 'a prefix match is not a descendant');
  assert.equal(isDescendantPath('0.2', '0.1'), false);
});
