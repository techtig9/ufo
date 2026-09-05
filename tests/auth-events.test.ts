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
