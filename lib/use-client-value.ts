'use client';

import { useSyncExternalStore } from 'react';

/** A store that never changes — the value is read once per render, not subscribed to. */
const neverChanges = () => () => {};

/**
 * Reads a browser-only value (localStorage, Date.now(), matchMedia…) without a
 * hydration mismatch and without the `useEffect` + `setState` cascade that
 * `react-hooks/set-state-in-effect` flags.
 *
 * Renders `serverValue` during SSR and the very first client paint, then the
 * real value — visibly identical to the effect-based pattern it replaces, but
 * in one render pass instead of two.
 *
 * `read` must be pure and return a primitive (or a stable reference): React
 * compares successive snapshots with Object.is and will loop if a fresh object
 * is returned each call.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(neverChanges, read, () => serverValue);
}
