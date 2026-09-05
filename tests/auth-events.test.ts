import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ipPrefixOf,
  userAgentSummaryOf,
  isAuthEventType,
  AUTH_EVENT_TYPES,
} from '../lib/auth-event-types.ts';
import { escapeHtml } from '../lib/escape-html.ts';

test('ipPrefixOf truncates IPv4 to a /24 network', () => {
  assert.equal(ipPrefixOf('203.0.113.42'), '203.0.113.0/24');
  // Takes the first hop of an X-Forwarded-For chain.
  assert.equal(ipPrefixOf('203.0.113.42, 70.41.3.18'), '203.0.113.0/24');
});

test('ipPrefixOf truncates IPv6 to a /48 network', () => {
  assert.equal(ipPrefixOf('2001:db8:1234:5678::1'), '2001:db8:1234::/48');
});

test('ipPrefixOf never returns a full address', () => {
  for (const ip of ['203.0.113.42', '2001:db8:1234:5678::1']) {
    const prefix = ipPrefixOf(ip);
    assert.ok(prefix, 'produces a prefix');
    assert.notEqual(prefix, ip, 'must not be the untruncated address');
  }
});

test('ipPrefixOf handles missing or malformed input', () => {
  assert.equal(ipPrefixOf(null), undefined);
  assert.equal(ipPrefixOf(undefined), undefined);
  assert.equal(ipPrefixOf(''), undefined);
  assert.equal(ipPrefixOf('not-an-ip'), undefined);
  assert.equal(ipPrefixOf('1.2.3'), undefined);
});

test('userAgentSummaryOf reduces a UA to browser + platform', () => {
  const chromeOnMac =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
  assert.equal(userAgentSummaryOf(chromeOnMac), 'Chrome on macOS');

  const safariOnIphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/604.1';
  assert.equal(userAgentSummaryOf(safariOnIphone), 'Safari on iOS');

  const firefoxOnLinux = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
  assert.equal(userAgentSummaryOf(firefoxOnLinux), 'Firefox on Linux');
});

test('userAgentSummaryOf discards the raw UA (not a fingerprint)', () => {
  const ua =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.6099.199 Safari/537.36';
  const summary = userAgentSummaryOf(ua) ?? '';
  assert.ok(!summary.includes('537.36'), 'no engine build');
  assert.ok(!summary.includes('120.0.6099.199'), 'no full version');
  assert.ok(summary.length < 40, 'stays coarse');
});

test('userAgentSummaryOf tolerates missing input', () => {
  assert.equal(userAgentSummaryOf(null), undefined);
  assert.equal(userAgentSummaryOf(''), undefined);
  assert.equal(userAgentSummaryOf('nonsense'), 'a browser on an unknown platform');
});

test('isAuthEventType accepts every declared type and nothing else', () => {
  for (const type of AUTH_EVENT_TYPES) assert.ok(isAuthEventType(type), `${type} accepted`);
  for (const bogus of ['ADMIN_LOGIN', '', 'password_login', null, undefined, 42, {}]) {
    assert.equal(isAuthEventType(bogus), false, `${String(bogus)} rejected`);
  }
});

test('the seven Master Command event types are all present', () => {
  assert.deepEqual(
    [...AUTH_EVENT_TYPES].sort(),
    [
      'EMAIL_VERIFIED',
      'GOOGLE_SIGN_IN',
      'MFA_LOGIN_SUCCESS',
      'PASSWORD_CHANGED',
      'PASSWORD_LOGIN',
      'PASSWORD_RESET_REQUESTED',
      'SIGNUP',
    ]
  );
});

test('escapeHtml neutralises markup injected through the contact form', () => {
  assert.equal(
    escapeHtml('<script>fetch("//evil")</script>'),
    '&lt;script&gt;fetch(&quot;//evil&quot;)&lt;/script&gt;'
  );
  assert.equal(escapeHtml("<a href='x'>"), '&lt;a href=&#39;x&#39;&gt;');
  // Ampersand first, so entities are not double-decoded.
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
});

test('escapeHtml leaves ordinary text untouched', () => {
  const plain = 'Hi, I would like a quote for a 12-screen dashboard. Budget: 5000 USD.';
  assert.equal(escapeHtml(plain), plain);
});

// ---------------------------------------------------------------------------
// Duplicate suppression.
//
// The Master Command requires that one authentication produces one email. A
// login cascade — password, then MFA, then a token refresh, then a remount —
// reports the same event several times within seconds, and without this every
// sign-in would send a small burst of "new sign-in" warnings, which is both
// annoying and the fastest way to train someone to ignore them.
// ---------------------------------------------------------------------------

import { DEDUP_WINDOW_SECONDS, dedupKeyFor } from '../lib/auth-events.ts';

const USER = 'c0ffee00-0000-4000-8000-000000000001';
const T0 = 1_700_000_000_000; // a fixed instant, so bucket edges are exact

test('every event type has a dedup window', () => {
  for (const type of AUTH_EVENT_TYPES) {
    assert.ok(DEDUP_WINDOW_SECONDS[type] > 0, type);
  }
});

test('reports of one authentication share a key, so they collide', () => {
  // Same bucket -> same string -> UNIQUE violation on the second insert. That
  // collision is the suppression; a read-then-write check would let two
  // concurrent reports both past the SELECT.
  const first = dedupKeyFor(USER, 'PASSWORD_LOGIN', T0);
  const secondsLater = dedupKeyFor(USER, 'PASSWORD_LOGIN', T0 + 4_000);
  assert.equal(first, secondsLater);
});

test('a genuine later login gets a different key', () => {
  const window = DEDUP_WINDOW_SECONDS.PASSWORD_LOGIN * 1000;
  // Two full windows on, so the result cannot depend on where T0 sits inside
  // its bucket.
  assert.notEqual(dedupKeyFor(USER, 'PASSWORD_LOGIN', T0), dedupKeyFor(USER, 'PASSWORD_LOGIN', T0 + 2 * window));
});

test('different users never share a key', () => {
  const other = 'c0ffee00-0000-4000-8000-000000000002';
  assert.notEqual(dedupKeyFor(USER, 'PASSWORD_LOGIN', T0), dedupKeyFor(other, 'PASSWORD_LOGIN', T0));
});

test('different event types never share a key', () => {
  // Otherwise a sign-in would suppress the password-changed warning that
  // follows it — the one email a victim most needs to see.
  const keys = AUTH_EVENT_TYPES.map((type) => dedupKeyFor(USER, type, T0));
  assert.equal(new Set(keys).size, keys.length);
});

test('the key encodes user, type and bucket, and nothing else', () => {
  const key = dedupKeyFor(USER, 'GOOGLE_SIGN_IN', T0);
  const [user, type, bucket] = key.split(':');
  assert.equal(user, USER);
  assert.equal(type, 'GOOGLE_SIGN_IN');
  assert.match(bucket, /^\d+$/);
});

test('a login cascade across a whole window collapses to at most two keys', () => {
  // Bucketing has edges: a cascade straddling a boundary yields two keys. That
  // is why recordAuthEvent also does a look-back for an already-sent event of
  // the same type. This asserts the bound the look-back has to cover.
  const window = DEDUP_WINDOW_SECONDS.MFA_LOGIN_SUCCESS;
  for (let start = 0; start < window; start += 37) {
    const at = T0 + start * 1000;
    const cascade = [0, 800, 2_000, 4_500].map((offset) =>
      dedupKeyFor(USER, 'MFA_LOGIN_SUCCESS', at + offset)
    );
    assert.ok(new Set(cascade).size <= 2, `cascade starting at +${start}s produced ${new Set(cascade).size} keys`);
  }
});

test('one-per-flow events get a much longer window than logins', () => {
  // Signup and a password change should happen once; a login legitimately
  // recurs, so its window has to stay short enough to report a real second one.
  assert.ok(DEDUP_WINDOW_SECONDS.SIGNUP > DEDUP_WINDOW_SECONDS.PASSWORD_LOGIN);
  assert.ok(DEDUP_WINDOW_SECONDS.PASSWORD_CHANGED > DEDUP_WINDOW_SECONDS.PASSWORD_LOGIN);
});

test('the login window is long enough for a cascade but short enough to be useful', () => {
  for (const type of ['PASSWORD_LOGIN', 'GOOGLE_SIGN_IN', 'MFA_LOGIN_SUCCESS'] as const) {
    assert.ok(DEDUP_WINDOW_SECONDS[type] >= 60, `${type} must outlast a login cascade`);
    assert.ok(DEDUP_WINDOW_SECONDS[type] <= 3600, `${type} must not hide a real second sign-in for an hour`);
  }
});
