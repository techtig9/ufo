'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook this up to your error monitoring tool (Sentry, etc.) before launch.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm text-studio-coral">Something broke</p>
      <h1 className="mt-3 font-display text-2xl font-semibold">This screen hit an error</h1>
      <p className="mt-2 max-w-sm text-white/50">
        It&rsquo;s been logged. Try again, or head back if it keeps happening.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <a href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </a>
      </div>
    </div>
  );
}
