import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishStatus, deviceBucket, referrerHost } from '../lib/publishing.ts';

const base = { is_public: true, expires_at: null, hasPassword: false, published_at: '2026-01-01T00:00:00Z' };

test('an unpublished share reads as a draft', () => {
  const status = publishStatus({ ...base, is_public: false });
  assert.equal(status.state, 'draft');
  assert.match(status.detail, /404/);
});

test('a live share says anyone with the link can open it', () => {
  assert.equal(publishStatus(base).state, 'live');
});

test('a past expiry reads as expired, even while is_public is true', () => {
  // Publishing does not clear a past expiry, so this state is reachable and
  // the UI has to name it rather than claiming the link works.
  const status = publishStatus({ ...base, expires_at: '2020-01-01T00:00:00Z' });
  assert.equal(status.state, 'expired');
});

test('a future expiry is still live', () => {
  assert.equal(publishStatus({ ...base, expires_at: '2099-01-01T00:00:00Z' }).state, 'live');
});

test('expiry outranks a password — an expired link opens for nobody', () => {
  const status = publishStatus({ ...base, expires_at: '2020-01-01T00:00:00Z', hasPassword: true });
  assert.equal(status.state, 'expired');
});

test('a password-protected live share is reported as such', () => {
  assert.equal(publishStatus({ ...base, hasPassword: true }).state, 'locked');
});

test('the raw hash column works as the other half of the union', () => {
  // The editor holds `hasPassword` (the hash never reaches the browser); a
  // server-side caller holds the row. The type makes supplying both — and so
  // needing a precedence rule — unrepresentable.
  const row = { is_public: true, expires_at: null, published_at: '2026-01-01T00:00:00Z' };
  assert.equal(publishStatus({ ...row, password_hash: 'pbkdf2$1$a$b' }).state, 'locked');
  assert.equal(publishStatus({ ...row, password_hash: null }).state, 'live');
});

test('an unpublished share is a draft whatever else is set', () => {
  assert.equal(
    publishStatus({ is_public: false, expires_at: '2020-01-01T00:00:00Z', hasPassword: true, published_at: null }).state,
    'draft'
  );
});

// ---------------------------------------------------------------------------
// What a view records. These are the privacy guarantees, so they are asserted.
// ---------------------------------------------------------------------------

test('the device bucket is coarse, never the user agent', () => {
  assert.equal(deviceBucket('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'mobile');
  assert.equal(deviceBucket('Mozilla/5.0 (iPad; CPU OS 17_0)'), 'tablet');
  assert.equal(deviceBucket('Mozilla/5.0 (Macintosh) AppleWebKit Chrome/120'), 'desktop');
  assert.equal(deviceBucket('curl/8.0'), 'unknown');
  assert.equal(deviceBucket(null), 'unknown');
});

test('only the referrer HOST is kept, never its path or query', () => {
  assert.equal(referrerHost('https://slack.com/archives/C123?x=secret'), 'slack.com');
  assert.equal(referrerHost('https://mail.google.com/mail/u/0/#inbox/abc'), 'mail.google.com');
});

test('a missing or unparseable referrer records nothing', () => {
  assert.equal(referrerHost(null), null);
  assert.equal(referrerHost(''), null);
  assert.equal(referrerHost('not a url'), null);
  assert.equal(referrerHost('about:blank'), null);
});

test('an absurdly long host is truncated rather than stored whole', () => {
  const host = `${'a'.repeat(300)}.example`;
  const stored = referrerHost(`https://${host}/`);
  assert.ok(stored && stored.length <= 120);
});

// ---------------------------------------------------------------------------
// Sub-processor disclosure. The legal pages named "Google Gemini" long after
// the code had moved to a four-provider cascade — naming who receives customer
// data is a disclosure obligation, so it is asserted rather than trusted.
// ---------------------------------------------------------------------------

import { AI_SUBPROCESSORS, aiProviderSentence } from '../lib/subprocessors.ts';
import { PROVIDER_CASCADE } from '../lib/ai/providers.ts';

test('the disclosed AI providers are exactly the ones the router uses', () => {
  assert.deepEqual(
    AI_SUBPROCESSORS.map((p) => p.providerName),
    PROVIDER_CASCADE.map((p) => p.name),
    'a provider added to the cascade must also be disclosed'
  );
});

test('every disclosed sub-processor says what it is for', () => {
  for (const entry of AI_SUBPROCESSORS) {
    assert.ok(entry.purpose.length > 10, entry.name);
  }
});

test('the prose sentence lists every provider', () => {
  const sentence = aiProviderSentence();
  for (const entry of AI_SUBPROCESSORS) assert.ok(sentence.includes(entry.name), entry.name);
});

// ---------------------------------------------------------------------------
// companyValue is server-only. Calling it from a client component renders the
// real value during SSR and "— not set —" in the browser: a hydration mismatch
// that broke /contact until the browser suite caught it.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Local `@/...` imports in a file, resolved to paths on disk. */
function localImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/from\s+['"]@\/([^'"]+)['"]/g)].map((m) => m[1]);
  const resolved: string[] = [];
  for (const specifier of specifiers) {
    for (const candidate of [`${specifier}.tsx`, `${specifier}.ts`, `${specifier}/index.tsx`, `${specifier}/index.ts`]) {
      if (existsSync(candidate)) {
        resolved.push(candidate);
        break;
      }
    }
  }
  return resolved;
}

function isClientEntry(file: string): boolean {
  return /^['"]use client['"]/.test(readFileSync(file, 'utf8').trimStart());
}

function importsCompany(file: string): boolean {
  return /from\s+['"]@\/lib\/company['"]/.test(readFileSync(file, 'utf8'));
}

test('nothing in the client bundle reads companyValue', () => {
  // Transitive, not just direct: the real bug was Footer, a server component
  // that calls companyValue and was pulled into the client bundle merely by
  // being rendered from a 'use client' page. A direct-only check would have
  // missed it.
  const offenders: string[] = [];

  for (const entry of ['app', 'components'].flatMap((dir) => walk(dir))) {
    if (!isClientEntry(entry)) continue;

    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      if (importsCompany(file)) {
        offenders.push(`${entry} -> ${file}`);
        break;
      }
      queue.push(...localImports(file));
    }
  }

  assert.deepEqual(offenders, [], 'these reach @/lib/company from the client bundle — pass the value down as a prop instead');
});
