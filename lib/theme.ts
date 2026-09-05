/**
 * Theme store.
 *
 * Deliberately NOT marked 'use client': it is a plain utility module, and the
 * root layout (a server component) imports THEME_INIT_SCRIPT from it. Marking
 * it as a client boundary would drag that boundary into the layout. The DOM
 * functions below are only ever *called* from client components.
 *
 * Before Phase 1 the theme toggle wrote a class onto <html> and persisted
 * nothing, so the choice was discarded on every reload and every client-side
 * navigation — light mode was effectively unusable. This module makes the
 * choice durable and gives React a proper external store to subscribe to,
 * instead of the `useEffect` + `setState` mount dance the toggle used before.
 *
 * The <html class="light"> convention is unchanged — app/globals.css and the
 * `html.light` rules there keep working exactly as they did.
 */

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'ufo-theme';

/**
 * Runs before first paint, injected into <head>. Applies the stored choice (or
 * the OS preference when nothing is stored) so the correct theme is on <html>
 * before React hydrates — no flash of the wrong theme, no hydration mismatch.
 *
 * Kept dependency-free and wrapped in try/catch: a blocking head script must
 * never be able to throw and block rendering (private mode can make
 * localStorage access itself throw).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var l=t?t==="light":window.matchMedia("(prefers-color-scheme: light)").matches;if(l){document.documentElement.classList.add("light")}}catch(e){}})();`;

const listeners = new Set<() => void>();

/** Subscribe to theme changes — in this tab, and from other tabs via `storage`. */
export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The live theme, read from the DOM — the single source of truth. */
export function getTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

/** Server/pre-hydration snapshot. The init script above corrects it before paint. */
export function getServerTheme(): Theme {
  return 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('light', theme === 'light');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked — the theme still applies for this session.
  }
  listeners.forEach((listener) => listener());
}
