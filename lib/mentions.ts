/**
 * Comment mentions.
 *
 * A mention is stored inside the comment body as an explicit token:
 *
 *     @[Ada Lovelace](3f6c1e02-....-....-....-............)
 *
 * rather than as a bare `@name`. That choice is deliberate and security-
 * relevant: resolving `@ada` by display name means the server has to guess who
 * was meant, and a display name is not unique or stable — two members called
 * "Ada", or someone who renames themselves to match a colleague, would both
 * misdirect a notification. Carrying the id makes resolution exact, and the
 * server still verifies that every id belongs to the project's workspace before
 * a notification goes anywhere, so a forged token mentions nobody.
 *
 * Pure module, no imports — the same parser runs on the server (to build the
 * mention rows) and in the browser (to render chips), and it is unit-tested
 * directly.
 */

export interface ParsedMention {
  userId: string;
  /** The display name captured at the time of writing. */
  label: string;
}

export type BodySegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; userId: string; label: string };

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

/**
 * A label may not contain `]`, `[` or a newline, so a token cannot be closed
 * early or spread across lines by crafted input.
 */
const MENTION_PATTERN = new RegExp(`@\\[([^\\][\\n]{1,80})\\]\\((${UUID})\\)`, 'g');

/** Every distinct user mentioned in `body`, in first-appearance order. */
export function parseMentions(body: string): ParsedMention[] {
  const found: ParsedMention[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const userId = match[2].toLowerCase();
    if (seen.has(userId)) continue;
    seen.add(userId);
    found.push({ userId, label: match[1] });
  }
  return found;
}

/**
 * Split a body into text and mention segments for rendering.
 *
 * Returning segments rather than an HTML string is the point: the caller
 * renders each piece as React text, so a comment body can never inject markup.
 */
export function splitBody(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ type: 'text', value: body.slice(cursor, start) });
    segments.push({ type: 'mention', userId: match[2].toLowerCase(), label: match[1] });
    cursor = start + match[0].length;
  }

  if (cursor < body.length) segments.push({ type: 'text', value: body.slice(cursor) });
  return segments;
}

/** The body as a human reads it, with tokens collapsed to `@Name`. Used in emails. */
export function toPlainText(body: string): string {
  return body.replace(MENTION_PATTERN, (_full, label: string) => `@${label}`);
}

/** Build the token the composer inserts. */
export function mentionToken(userId: string, label: string): string {
  // A label containing `[`, `]` or a newline would produce a token that does not
  // round-trip through the parser, so those are stripped rather than escaped —
  // display names have no legitimate use for them.
  const safeLabel = label.replace(/[[\]\n]/g, '').trim().slice(0, 80) || 'member';
  return `@[${safeLabel}](${userId})`;
}

/**
 * The partial `@query` the caret sits in, or null when the caret is not in one.
 * Drives the autocomplete popover.
 */
export function activeMentionQuery(
  value: string,
  caret: number
): { query: string; start: number } | null {
  // Walk back from the caret to the nearest '@'. Whitespace or a newline before
  // finding one means the caret is not inside a mention.
  for (let i = caret - 1; i >= 0; i--) {
    const char = value[i];
    if (char === '@') {
      // Must start the line or follow whitespace, so an email address does not
      // open the picker on every keystroke.
      const before = i > 0 ? value[i - 1] : ' ';
      if (!/\s/.test(before)) return null;
      const query = value.slice(i + 1, caret);
      // A completed token has already been inserted — don't reopen on it.
      if (query.includes('[') || query.includes(']')) return null;
      return { query, start: i };
    }
    if (/\s/.test(char)) return null;
    if (caret - i > 40) return null;
  }
  return null;
}
