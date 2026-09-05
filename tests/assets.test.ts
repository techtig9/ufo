import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_ASSET_TYPES,
  MAX_ASSET_BYTES,
  PLAN_STORAGE_BYTES,
  assetStoragePath,
  formatBytes,
  isScriptableType,
  sanitizeAssetName,
  validateAssetUpload,
} from '../lib/assets.ts';

const base = { name: 'logo.png', mimeType: 'image/png', size: 1024, plan: 'free' as const, usedBytes: 0 };

test('a normal image upload is accepted', () => {
  assert.equal(validateAssetUpload(base), null);
});

test('an unsupported type is rejected by name', () => {
  // Allow-list, not deny-list: anything not explicitly permitted is refused.
  for (const mimeType of ['text/html', 'application/javascript', 'application/zip', '', 'image/png ']) {
    const result = validateAssetUpload({ ...base, mimeType });
    assert.equal(result?.field, 'mimeType', `${JSON.stringify(mimeType)} rejected`);
  }
});

test('every allowed type is actually accepted', () => {
  for (const mimeType of Object.keys(ALLOWED_ASSET_TYPES)) {
    assert.equal(validateAssetUpload({ ...base, mimeType }), null, mimeType);
  }
});

test('an empty or nonsense size is rejected', () => {
  for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(validateAssetUpload({ ...base, size }).field, 'size', String(size));
  }
});

test('a file over the per-file cap is rejected', () => {
  assert.equal(validateAssetUpload({ ...base, size: MAX_ASSET_BYTES + 1 })?.field, 'size');
  assert.equal(validateAssetUpload({ ...base, size: MAX_ASSET_BYTES, plan: 'pro' }), null);
});

test('an upload that would exceed the plan quota is rejected', () => {
  const limit = PLAN_STORAGE_BYTES.free;
  assert.equal(validateAssetUpload({ ...base, usedBytes: limit - 512, size: 1024 })?.field, 'quota');
  assert.equal(validateAssetUpload({ ...base, usedBytes: limit - 1024, size: 1024 }), null,
    'exactly filling the quota is allowed');
});

test('a bigger plan allows what a smaller one refuses', () => {
  const overFree = { ...base, size: 5 * 1024 * 1024, usedBytes: PLAN_STORAGE_BYTES.free - 1024 };
  assert.equal(validateAssetUpload(overFree)?.field, 'quota');
  assert.equal(validateAssetUpload({ ...overFree, plan: 'pro' }), null);
});

test('quotas increase with every plan tier', () => {
  const { free, starter, pro, business } = PLAN_STORAGE_BYTES;
  assert.ok(free < starter && starter < pro && pro < business);
});

test('the Pro and Business quotas match what the pricing page sells', () => {
  // These figures are printed on /dashboard/billing — a mismatch would make
  // the pricing copy false.
  assert.equal(PLAN_STORAGE_BYTES.pro, 10 * 1024 ** 3);
  assert.equal(PLAN_STORAGE_BYTES.business, 50 * 1024 ** 3);
});

test('the quota message says how much room is left', () => {
  const result = validateAssetUpload({ ...base, usedBytes: PLAN_STORAGE_BYTES.free - 512, size: 1024 });
  assert.match(result.message, /512 B free/);
});

// ---------------------------------------------------------------------------
// Names and paths.
// ---------------------------------------------------------------------------

test('a display name cannot contain path separators or traversal', () => {
  assert.equal(sanitizeAssetName('../../etc/passwd'), '.-.-etc-passwd');
  assert.equal(sanitizeAssetName('a\\b/c.png'), 'a-b-c.png');
  assert.ok(!sanitizeAssetName('../x').includes('..'));
});

test('a name of only junk still gets a name', () => {
  assert.equal(sanitizeAssetName('   '), 'untitled');
  assert.equal(sanitizeAssetName(''), 'untitled');
});

test('control characters are stripped from a name', () => {
  const withNul = 'logo' + String.fromCharCode(0) + '.png';
  const withNewline = 'logo\n.png';
  assert.equal(sanitizeAssetName(withNul), 'logo.png');
  assert.equal(sanitizeAssetName(withNewline), 'logo.png');
});

test('a very long name is truncated', () => {
  assert.ok(sanitizeAssetName('x'.repeat(500)).length <= 120);
});

test('the storage path is built from ids, never from the filename', () => {
  const path = assetStoragePath(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'image/png'
  );
  assert.equal(path, '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png');
});

test('the path always starts with the project id, so the storage policy can authorise it', () => {
  // storage.objects policies read (storage.foldername(name))[1] as the project.
  const projectId = '11111111-1111-4111-8111-111111111111';
  for (const mimeType of Object.keys(ALLOWED_ASSET_TYPES)) {
    const path = assetStoragePath(projectId, '22222222-2222-4222-8222-222222222222', mimeType);
    assert.equal(path.split('/')[0], projectId, mimeType);
    assert.equal(path.split('/').length, 2, 'exactly one folder level');
  }
});

test('an unknown type never produces an executable extension', () => {
  assert.match(assetStoragePath('a', 'b', 'text/html'), /\.bin$/);
});

test('SVG and PDF are flagged as scriptable', () => {
  // Which is why the bucket is private and files are served through signed URLs
  // rather than from the app origin.
  assert.ok(isScriptableType('image/svg+xml'));
  assert.ok(isScriptableType('application/pdf'));
  assert.equal(isScriptableType('image/png'), false);
});

// ---------------------------------------------------------------------------
// Formatting.
// ---------------------------------------------------------------------------

test('formatBytes reads the way a person would say it', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(25 * 1024 * 1024), '25 MB');
  assert.equal(formatBytes(10 * 1024 ** 3), '10 GB');
});
