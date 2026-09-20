import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFontPairing,
  tokensCss,
  tokensJson,
  tailwindPreset,
  designSystemReadme,
} from '../lib/export/design-system.ts';
import type { Project } from '../lib/types.ts';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Acme',
    color_theme: { primary: '#D4FF4F', background: '#0b0c10', text: '#f7f9fc' },
    font_pairing: 'Space Grotesk / Inter',
    ...overrides,
  } as Project;
}

test('a two-family pairing splits into display and body', () => {
  assert.deepEqual(parseFontPairing('Space Grotesk / Inter'), {
    display: 'Space Grotesk',
    body: 'Inter',
  });
  assert.deepEqual(parseFontPairing('Playfair + Lato'), { display: 'Playfair', body: 'Lato' });
  assert.deepEqual(parseFontPairing('Georgia and Verdana'), {
    display: 'Georgia',
    body: 'Verdana',
  });
});

test('a single family is used for both roles', () => {
  assert.deepEqual(parseFontPairing('Inter'), { display: 'Inter', body: 'Inter' });
});

test('an absent pairing yields nulls, not invented fonts', () => {
  for (const input of [null, '', '   ']) {
    assert.deepEqual(parseFontPairing(input), { display: null, body: null });
  }
});

test('token keys become valid CSS custom properties', () => {
  const css = tokensCss(project({ color_theme: { 'Brand Primary': '#fff' } as never }));
  assert.match(css, /--brand-primary: #fff;/);
});

test('a font name with a space is quoted in the stack', () => {
  // Unquoted, `font-family: Space Grotesk` is invalid and the rule is dropped.
  const css = tokensCss(project());
  assert.match(css, /--font-display: "Space Grotesk", system-ui/);
  assert.match(css, /--font-body: Inter, system-ui/);
});

test('a fallback stack is always present', () => {
  // The screens must render before a webfont loads, or if it never does.
  const css = tokensCss(project({ font_pairing: null }));
  assert.match(css, /--font-display: system-ui/);
  assert.match(css, /--font-body: system-ui/);
});

test('the Tailwind preset points at variables, never at hex values', () => {
  // Inlined hex means a theme change has to be made twice, and one of the two
  // is always forgotten.
  const preset = tailwindPreset(project());
  assert.match(preset, /'var\(--primary\)'/);
  assert.ok(!preset.includes('#D4FF4F'), 'the preset must not inline a colour');
});

test('tokens.json is valid JSON with every colour typed', () => {
  const parsed = JSON.parse(tokensJson(project()));
  assert.equal(parsed.name, 'Acme');
  assert.equal(parsed.color.primary.value, '#D4FF4F');
  assert.equal(parsed.color.primary.type, 'color');
  assert.equal(parsed.font.display.value, 'Space Grotesk');
});

test('a project with no theme produces empty files, not invented ones', () => {
  // A plausible default palette matching none of the screens is worse than
  // nothing, because it looks like it was designed.
  const p = project({ color_theme: null, font_pairing: null });

  assert.ok(!tokensCss(p).includes('#'), 'no colour may be invented');
  assert.match(tokensCss(p), /no saved colour theme/i);
  assert.deepEqual(JSON.parse(tokensJson(p)).color, {});
  assert.match(designSystemReadme(p), /no saved colour theme/i);
  assert.match(tailwindPreset(p), /no saved colour theme/i);
});

test('every generated file names the project it came from', () => {
  const p = project({ name: 'Nightshade' });
  for (const out of [tokensCss(p), tokensJson(p), tailwindPreset(p), designSystemReadme(p)]) {
    assert.ok(out.includes('Nightshade'), 'a file with no provenance is hard to place later');
  }
});

test('the readme documents every file it ships', () => {
  const readme = designSystemReadme(project());
  for (const file of ['tokens.css', 'tailwind-preset.js', 'tokens.json']) {
    assert.ok(readme.includes(file), `${file} must be documented`);
  }
});
