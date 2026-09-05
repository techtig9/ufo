import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeRedirectPath, DEFAULT_POST_AUTH_PATH } from '../lib/safe-redirect.ts';

test('allows ordinary same-origin paths', () => {
  assert.equal(safeRedirectPath('/dashboard'), '/dashboard');
  assert.equal(safeRedirectPath('/dashboard/billing'), '/dashboard/billing');
  assert.equal(safeRedirectPath('/dashboard?tab=usage'), '/dashboard?tab=usage');
  assert.equal(safeRedirectPath('/dashboard#section'), '/dashboard#section');
});

test('falls back when next is absent', () => {
  assert.equal(safeRedirectPath(null), DEFAULT_POST_AUTH_PATH);
  assert.equal(safeRedirectPath(undefined), DEFAULT_POST_AUTH_PATH);
  assert.equal(safeRedirectPath(''), DEFAULT_POST_AUTH_PATH);
});

test('rejects absolute URLs to another origin', () => {
  for (const evil of [
    'https://evil.example',
    'http://evil.example/path',
    '//evil.example',
    '///evil.example',
    'https:/evil.example',
  ]) {
    assert.equal(safeRedirectPath(evil), DEFAULT_POST_AUTH_PATH, `should reject ${evil}`);
  }
});

test('rejects backslash-based protocol-relative bypasses', () => {
  for (const evil of ['/\\evil.example', '/\\/evil.example', '\\\\evil.example', '/path\\..\\x']) {
    assert.equal(safeRedirectPath(evil), DEFAULT_POST_AUTH_PATH, `should reject ${evil}`);
  }
});

test('rejects non-http schemes', () => {
  for (const evil of ['javascript:alert(1)', 'data:text/html,<script>', 'mailto:a@b.c']) {
    assert.equal(safeRedirectPath(evil), DEFAULT_POST_AUTH_PATH, `should reject ${evil}`);
  }
});

test('rejects control characters used to smuggle schemes', () => {
  // A tab or newline inside "java\tscript:" is stripped by some URL parsers.
  const withTab = '/x' + String.fromCharCode(9) + 'y';
  const withNewline = '/x' + String.fromCharCode(10) + 'y';
  const withNul = '/x' + String.fromCharCode(0);
  assert.equal(safeRedirectPath(withTab), DEFAULT_POST_AUTH_PATH);
  assert.equal(safeRedirectPath(withNewline), DEFAULT_POST_AUTH_PATH);
  assert.equal(safeRedirectPath(withNul), DEFAULT_POST_AUTH_PATH);
});

test('honours a custom fallback', () => {
  assert.equal(safeRedirectPath('https://evil.example', '/login'), '/login');
});

test('does not let a traversal escape the origin', () => {
  // Normalised by URL, but must still resolve to a same-origin path.
  const result = safeRedirectPath('/../../etc/passwd');
  assert.ok(result.startsWith('/'), 'stays a path');
  assert.ok(!result.includes('..'), 'traversal is normalised away');
});
