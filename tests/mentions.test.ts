import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMentions,
  splitBody,
  toPlainText,
  mentionToken,
  activeMentionQuery,
} from '../lib/mentions.ts';

const ADA = '3f6c1e02-1111-4222-8333-444455556666';
const GRACE = '7a1b2c3d-9999-4888-8777-666655554444';

test('a body with no mentions parses to none', () => {
  assert.deepEqual(parseMentions('Looks good to me!'), []);
  assert.deepEqual(parseMentions(''), []);
});

test('a mention token yields its id and label', () => {
  const parsed = parseMentions(`${mentionToken(ADA, 'Ada Lovelace')} can you check this?`);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].userId, ADA);
  assert.equal(parsed[0].label, 'Ada Lovelace');
});

test('the same person mentioned twice notifies once', () => {
  const body = `${mentionToken(ADA, 'Ada')} and again ${mentionToken(ADA, 'Ada')}`;
  assert.equal(parseMentions(body).length, 1);
});

test('several mentions keep first-appearance order', () => {
  const body = `${mentionToken(GRACE, 'Grace')} ${mentionToken(ADA, 'Ada')}`;
  assert.deepEqual(parseMentions(body).map((m) => m.userId), [GRACE, ADA]);
});

test('a bare @name is NOT a mention', () => {
  // Resolving by display name is exactly the ambiguity the token format avoids.
  assert.deepEqual(parseMentions('@ada please look'), []);
  assert.deepEqual(parseMentions('@[Ada](not-a-uuid)'), []);
});

test('a label cannot break out of its own token', () => {
  // `]` inside the label would otherwise let crafted text close the token early
  // and smuggle a different id into the link half.
  assert.deepEqual(parseMentions(`@[bad]label](${ADA})`), []);
  assert.deepEqual(parseMentions(`@[line\nbreak](${ADA})`), []);
});

test('mentionToken strips characters that would not round-trip', () => {
  const token = mentionToken(ADA, 'Ev[il]\nName');
  assert.equal(parseMentions(token).length, 1, 'the sanitised token still parses');
  assert.equal(parseMentions(token)[0].label, 'EvilName');
});

test('mentionToken never produces an empty label', () => {
  assert.equal(parseMentions(mentionToken(ADA, '[[]]'))[0].label, 'member');
});

test('ids are normalised to lower case so they match the database', () => {
  assert.equal(parseMentions(`@[Ada](${ADA.toUpperCase()})`)[0].userId, ADA);
});

// ---------------------------------------------------------------------------
// Rendering.
// ---------------------------------------------------------------------------

test('splitBody separates text from mentions', () => {
  const segments = splitBody(`Hey ${mentionToken(ADA, 'Ada')}, ship it`);
  assert.deepEqual(segments, [
    { type: 'text', value: 'Hey ' },
    { type: 'mention', userId: ADA, label: 'Ada' },
    { type: 'text', value: ', ship it' },
  ]);
});

test('splitBody handles a body that is only a mention', () => {
  assert.deepEqual(splitBody(mentionToken(ADA, 'Ada')), [
    { type: 'mention', userId: ADA, label: 'Ada' },
  ]);
});

test('splitBody keeps markup as literal text, never as markup', () => {
  // The renderer prints each segment as React text, so this can only ever be
  // shown, not executed — this asserts the parser does not special-case it.
  const body = '<img src=x onerror=alert(1)>';
  assert.deepEqual(splitBody(body), [{ type: 'text', value: body }]);
});

test('toPlainText collapses tokens for email', () => {
  assert.equal(toPlainText(`${mentionToken(ADA, 'Ada')} take a look`), '@Ada take a look');
});

// ---------------------------------------------------------------------------
// Autocomplete trigger.
// ---------------------------------------------------------------------------

test('typing @ at the start opens the picker', () => {
  assert.deepEqual(activeMentionQuery('@', 1), { query: '', start: 0 });
  assert.deepEqual(activeMentionQuery('@ad', 3), { query: 'ad', start: 0 });
});

test('an @ after a space opens the picker', () => {
  assert.deepEqual(activeMentionQuery('hey @ad', 7), { query: 'ad', start: 4 });
});

test('an email address does not open the picker', () => {
  assert.equal(activeMentionQuery('mail me at ada@lovelace', 23), null);
});

test('the picker closes once the query ends', () => {
  assert.equal(activeMentionQuery('hey @ada thanks', 15), null);
});

test('a caret outside any mention returns null', () => {
  assert.equal(activeMentionQuery('no mentions here', 16), null);
  assert.equal(activeMentionQuery('', 0), null);
});

test('an already-inserted token does not reopen the picker', () => {
  const body = mentionToken(ADA, 'Ada');
  assert.equal(activeMentionQuery(body, body.length), null);
});

test('a very long run after @ stops being treated as a query', () => {
  assert.equal(activeMentionQuery('@' + 'x'.repeat(60), 61), null);
});
