import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_ACTIONS,
  AI_ACTION_IDS,
  isAiActionId,
  analysisSchema,
  designSystemSchema,
} from '../lib/ai/actions.ts';
import { CREDIT_COSTS } from '../lib/credits.ts';
import { parseAiJson } from '../lib/ai/json.ts';

test('every Master Command 2.C action exists', () => {
  // full project generation, component generation and component editing are
  // covered by /api/generate and /api/projects/[id]/ai-edit; these are the rest.
  for (const required of [
    'regenerate_screen',
    'generate_screen',
    'change_theme',
    'improve_ux',
    'improve_copy',
    'make_responsive',
    'improve_accessibility',
    'audit_accessibility',
    'check_consistency',
    'extract_design_system',
  ]) {
    assert.ok(isAiActionId(required), `${required} is a known action`);
    assert.ok(AI_ACTIONS[required as keyof typeof AI_ACTIONS], `${required} has a definition`);
  }
});

test('every action has a priced credit action', () => {
  for (const id of AI_ACTION_IDS) {
    const def = AI_ACTIONS[id];
    assert.ok(
      typeof CREDIT_COSTS[def.credit] === 'number',
      `${id} maps to a priced credit action (${def.credit})`
    );
    assert.ok(CREDIT_COSTS[def.credit] > 0, `${id} costs something`);
  }
});

test('analyses are cheaper than rewrites, because they emit far less', () => {
  const rewrite = CREDIT_COSTS[AI_ACTIONS.improve_ux.credit];
  for (const id of ['audit_accessibility', 'check_consistency', 'extract_design_system'] as const) {
    assert.ok(CREDIT_COSTS[AI_ACTIONS[id].credit] < rewrite, `${id} is cheaper than a rewrite`);
  }
});

test('analysis actions never mutate — they are declared read-only', () => {
  for (const id of ['audit_accessibility', 'check_consistency', 'extract_design_system'] as const) {
    assert.equal(AI_ACTIONS[id].kind, 'analysis');
  }
});

test('actions that need free text declare it, so the route can reject early', () => {
  assert.equal(AI_ACTIONS.generate_screen.needsInstruction, true);
  assert.equal(AI_ACTIONS.change_theme.needsInstruction, true);
  // A rewrite works with no direction at all.
  assert.equal(AI_ACTIONS.improve_ux.needsInstruction, false);
});

test('screen-scoped actions declare that they need a screen', () => {
  for (const id of ['regenerate_screen', 'improve_ux', 'improve_copy', 'make_responsive',
                    'improve_accessibility', 'audit_accessibility'] as const) {
    assert.equal(AI_ACTIONS[id].needsScreen, true, `${id} needs a screen`);
  }
  for (const id of ['check_consistency', 'extract_design_system', 'change_theme', 'generate_screen'] as const) {
    assert.equal(AI_ACTIONS[id].needsScreen, false, `${id} is project-wide`);
  }
});

test('rewrite prompts forbid script tags and preserve hotspots', () => {
  for (const id of AI_ACTION_IDS) {
    const def = AI_ACTIONS[id];
    if (def.kind !== 'screen_rewrite') continue;
    assert.match(def.system, /no <script> tags/i, `${id} forbids scripts`);
    assert.match(def.system, /data-hotspot/, `${id} preserves prototype navigation`);
  }
});

test('every prompt actually embeds the screen it is about', () => {
  const ctx = {
    projectName: 'Acme',
    designStyle: 'minimal',
    colorTheme: { primary: '#000' },
    fontPairing: 'Inter',
    screenName: 'Checkout',
    screenCode: '<main>UNIQUE_SCREEN_MARKER</main>',
    allScreens: [{ name: 'Checkout', code: '<main>UNIQUE_SCREEN_MARKER</main>' }],
    instruction: 'make it calmer',
    tokens: { primary: '#000' },
  };
  for (const id of AI_ACTION_IDS) {
    const def = AI_ACTIONS[id];
    // change_theme operates on tokens, not markup. generate_screen creates a
    // NEW screen and deliberately sends only the existing screen NAMES for
    // context — shipping every screen's full HTML there would burn tokens for
    // no benefit.
    if (def.id === 'change_theme' || def.id === 'generate_screen') continue;
    const prompt = def.buildPrompt(ctx);
    assert.match(prompt, /UNIQUE_SCREEN_MARKER/, `${id} includes the screen code`);
  }
});

test('generate_screen sends existing screen names, not their markup', () => {
  const prompt = AI_ACTIONS.generate_screen.buildPrompt({
    projectName: 'Acme', designStyle: null, colorTheme: null, fontPairing: null,
    allScreens: [{ name: 'Checkout', code: '<main>UNIQUE_SCREEN_MARKER</main>' }],
    instruction: 'an order confirmation screen',
  });
  assert.match(prompt, /Checkout/, 'names give the model context');
  assert.doesNotMatch(prompt, /UNIQUE_SCREEN_MARKER/, 'but not every screen body');
  assert.match(prompt, /order confirmation/);
});

test('change_theme embeds the current tokens', () => {
  const prompt = AI_ACTIONS.change_theme.buildPrompt({
    projectName: 'Acme', designStyle: null, colorTheme: null, fontPairing: null,
    tokens: { primary: '#ABCDEF' }, instruction: 'warmer',
  });
  assert.match(prompt, /#ABCDEF/);
  assert.match(prompt, /warmer/);
});

test('analysis output validates', () => {
  const raw = JSON.stringify({
    summary: 'Two contrast problems.',
    findings: [
      { severity: 'high', title: 'Low contrast', detail: 'Grey on grey', location: 'header', suggestion: 'Darken' },
    ],
  });
  const parsed = parseAiJson(raw, analysisSchema);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].severity, 'high');
});

test('an analysis with no findings is valid — a clean screen is a real result', () => {
  const parsed = parseAiJson(JSON.stringify({ summary: 'No issues found.' }), analysisSchema);
  assert.deepEqual(parsed.findings, []);
});

test('an invented severity is rejected', () => {
  const raw = JSON.stringify({ summary: 'x', findings: [{ severity: 'catastrophic', title: 'a', detail: 'b' }] });
  assert.throws(() => parseAiJson(raw, analysisSchema));
});

test('design system extraction validates and tolerates sparse sections', () => {
  const parsed = parseAiJson(JSON.stringify({ summary: 'Minimal system.' }), designSystemSchema);
  assert.deepEqual(parsed.colors, []);
  assert.deepEqual(parsed.components, []);
});

test('isAiActionId rejects anything not in the catalogue', () => {
  for (const bogus of ['delete_project', '', null, undefined, 7, {}, 'IMPROVE_UX']) {
    assert.equal(isAiActionId(bogus), false, `${String(bogus)} rejected`);
  }
});
