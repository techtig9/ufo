'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

/**
 * Without this, an error anywhere under /dashboard bubbled up to the root
 * app/error.tsx, which replaces the whole screen — including the sidebar and
 * topnav, so the only way out was a full reload. This one renders inside
 * DashboardLayout, so navigation stays usable while the broken page recovers.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ufo] dashboard route error', error);
  }, [error]);

  return (
    <ErrorState
      title="This page hit an error"
      description="It's been logged. Try again, or use the sidebar to go somewhere else."
      onRetry={reset}
      className="min-h-[60vh]"
    />
  );
}
