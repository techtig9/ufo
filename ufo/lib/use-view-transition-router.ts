'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Returns a `push(href)` that wraps Next's router navigation in the native
 * View Transitions API when the browser supports it (Chrome/Edge, Safari
 * 18+), and falls back to a plain router.push everywhere else — no
 * dependency, no polyfill, genuinely optional. Cast to `unknown` first
 * rather than redeclaring `Document.startViewTransition` globally, since
 * newer TS DOM libs already type it and a second declaration conflicts.
 */
export function useViewTransitionRouter() {
  const router = useRouter();

  const push = useCallback(
    (href: string) => {
      const startViewTransition = (document as unknown as { startViewTransition?: (cb: () => void) => void })
        .startViewTransition;

      if (typeof document !== 'undefined' && startViewTransition) {
        startViewTransition(() => {
          router.push(href);
        });
      } else {
        router.push(href);
      }
    },
    [router]
  );

  return { push };
}
