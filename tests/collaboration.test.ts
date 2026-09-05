import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roleAtLeast,
  isWorkspaceRole,
  isInvitableRole,
  generateInviteToken,
  hashInviteToken,
  inviteTokenMatches,
  inviteExpiry,
  WORKSPACE_ROLES,
} from '../lib/workspaces.ts';
import {
  hashSharePassword,
  verifySharePassword,
  issueShareGrant,
  verifyShareGrant,
} from '../lib/share-access.ts';

// ---------------------------------------------------------------------------
// Roles. The rank order is duplicated in SQL (workspace_role_rank, migration
// 010) so RLS can answer "at least editor?" without calling the app — these
// assertions are what keep the two from drifting apart.
// ---------------------------------------------------------------------------

test('the role hierarchy is owner > admin > editor > viewer', () => {
  assert.ok(roleAtLeast('owner', 'admin'));
  assert.ok(roleAtLeast('admin', 'editor'));
  assert.ok(roleAtLeast('editor', 'viewer'));
  assert.ok(roleAtLeast('viewer', 'viewer'));
});

test('a lower role never satisfies a higher requirement', () => {
  assert.equal(roleAtLeast('viewer', 'editor'), false);
  assert.equal(roleAtLeast('editor', 'admin'), false);
  assert.equal(roleAtLeast('admin', 'owner'), false);
});

test('no role means no access', () => {
  assert.equal(roleAtLeast(null, 'viewer'), false);
  assert.equal(roleAtLeast(undefined, 'viewer'), false);
});

test('owner cannot be granted by invitation', () => {
  // Ownership transfer is a separate, deliberate action — an admin must not be
  // able to mint another owner through the invite flow.
  assert.equal(isInvitableRole('owner'), false);
  for (const r of ['admin', 'editor', 'viewer']) assert.ok(isInvitableRole(r));
});

test('role guards reject anything not in the set', () => {
  for (const r of WORKSPACE_ROLES) assert.ok(isWorkspaceRole(r));
  for (const bogus of ['superuser', 'OWNER', '', null, undefined, 3, {}]) {
    assert.equal(isWorkspaceRole(bogus), false, `${String(bogus)} rejected`);
    assert.equal(isInvitableRole(bogus), false, `${String(bogus)} not invitable`);
  }
});

// ---------------------------------------------------------------------------
// Invite tokens — bearer credentials, so treated like passwords.
// ---------------------------------------------------------------------------

test('invite tokens are long and unpredictable', () => {
  const a = generateInviteToken();
  const b = generateInviteToken();
  assert.notEqual(a, b, 'two tokens must differ');
  assert.ok(a.length >= 40, `token is long enough (${a.length} chars)`);
  assert.match(a, /^[A-Za-z0-9_-]+$/, 'URL-safe, so it survives an email link');
});

test('1000 generated tokens are all distinct', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(generateInviteToken());
  assert.equal(seen.size, 1000);
});

test('a token hash is not the token', () => {
  const token = generateInviteToken();
  const hash = hashInviteToken(token);
  assert.notEqual(hash, token, 'a database leak must not yield working invites');
  assert.match(hash, /^[0-9a-f]{64}$/, 'sha256 hex');
});

test('hashing is deterministic, so lookup by hash works', () => {
  const token = generateInviteToken();
  assert.equal(hashInviteToken(token), hashInviteToken(token));
});

test('a token matches only its own hash', () => {
  const token = generateInviteToken();
  const other = generateInviteToken();
  assert.ok(inviteTokenMatches(token, hashInviteToken(token)));
  assert.equal(inviteTokenMatches(other, hashInviteToken(token)), false);
  assert.equal(inviteTokenMatches('', hashInviteToken(token)), false);
  assert.equal(inviteTokenMatches(token, 'short'), false, 'length mismatch is handled, not thrown');
});

test('invites expire in the future, within a week', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const expiry = inviteExpiry(now);
  assert.ok(expiry.getTime() > now.getTime());
  const days = (expiry.getTime() - now.getTime()) / 86_400_000;
  assert.equal(days, 7);
});

// ---------------------------------------------------------------------------
// Share passwords.
// ---------------------------------------------------------------------------

test('a share password is never stored in the clear', () => {
  const stored = hashSharePassword('hunter2');
  assert.ok(!stored.includes('hunter2'));
  assert.match(stored, /^pbkdf2\$\d+\$/, 'the format records its own parameters');
});

test('the same password hashes differently each time (salted)', () => {
  const a = hashSharePassword('same');
  const b = hashSharePassword('same');
  assert.notEqual(a, b, 'two identical passwords must not produce identical rows');
  assert.ok(verifySharePassword('same', a));
  assert.ok(verifySharePassword('same', b));
});

test('verification accepts the right password and rejects everything else', () => {
  const stored = hashSharePassword('correct horse');
  assert.ok(verifySharePassword('correct horse', stored));
  for (const wrong of ['correct hors', 'Correct Horse', '', 'correct horse ']) {
    assert.equal(verifySharePassword(wrong, stored), false, `rejects ${JSON.stringify(wrong)}`);
  }
});

test('a malformed stored hash is rejected rather than throwing', () => {
  for (const bad of ['', 'garbage', 'pbkdf2$', 'pbkdf2$abc$x$y', 'bcrypt$1$a$b']) {
    assert.equal(verifySharePassword('anything', bad), false, `handles ${JSON.stringify(bad)}`);
  }
});

test('unicode and long passwords round-trip', () => {
  const pw = 'pässwörd-🔐-' + 'x'.repeat(150);
  assert.ok(verifySharePassword(pw, hashSharePassword(pw)));
});

// ---------------------------------------------------------------------------
// Share grants — the cookie proving a visitor answered the password.
// ---------------------------------------------------------------------------

test('a grant validates for its own share', () => {
  const grant = issueShareGrant('share-1');
  assert.ok(verifyShareGrant(grant, 'share-1'));
});

test('a grant for one share does NOT unlock another', () => {
  // Otherwise one password would open every protected prototype.
  const grant = issueShareGrant('share-1');
  assert.equal(verifyShareGrant(grant, 'share-2'), false);
});

test('a tampered grant is rejected', () => {
  const grant = issueShareGrant('share-1');
  const [id, expires, sig] = grant.split('.');
  assert.equal(verifyShareGrant(`${id}.${Number(expires) + 86_400_000}.${sig}`, 'share-1'), false,
    'extending the expiry invalidates the signature');
  assert.equal(verifyShareGrant(`${id}.${expires}.${sig.slice(0, -1)}x`, 'share-1'), false,
    'a forged signature is rejected');
});

test('an expired grant is rejected', () => {
  const past = Date.now() - 1000;
  assert.equal(verifyShareGrant(`share-1.${past}.whatever`, 'share-1'), false);
});

test('a missing or malformed grant is rejected rather than throwing', () => {
  for (const bad of [undefined, '', 'a', 'a.b', 'a.b.c.d']) {
    assert.equal(verifyShareGrant(bad as string | undefined, 'share-1'), false);
  }
});
