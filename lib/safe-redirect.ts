/**
 * Open-redirect guard for post-authentication `next` targets.
 *
 * `/auth/callback` and the login page both take a caller-supplied `next` and
 * send the freshly-authenticated user there. Before Phase 1 neither validated
 * it, so a crafted link could bounce a user who had just signed in — the most
 * credible moment to hand off to a phishing page — to an arbitrary destination.
 *
 * Only same-origin *paths* are allowed. Anything else falls back to the
 * default, silently: a bad `next` is not worth failing an otherwise successful
 * login over.
 */

export const DEFAULT_POST_AUTH_PATH = '/dashboard';

/**
 * True if the string contains a C0 control character or DEL. Written as a
 * char-code scan rather than a regex literal so no control characters have to
 * appear in this source file.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_POST_AUTH_PATH
): string {
  if (!next) return fallback;

  // Must be a path on this origin.
  if (!next.startsWith('/')) return fallback;

  // `//evil.com` and `/\evil.com` are protocol-relative URLs: browsers treat
  // both as absolute and would leave the site.
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;

  // A backslash anywhere can be normalised to `/` by some parsers, and control
  // characters (tab/newline are used to smuggle schemes past naive checks)
  // have no legitimate place in a path we generate ourselves.
  if (next.includes('\\')) return fallback;
  if (hasControlChars(next)) return fallback;

  // Final check: reject anything that still parses as pointing off-origin.
  try {
    const parsed = new URL(next, 'https://ufo.invalid');
    if (parsed.origin !== 'https://ufo.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
