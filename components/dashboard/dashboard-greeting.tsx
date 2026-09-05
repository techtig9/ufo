'use client';

import { getTimeBasedGreeting } from '@/lib/greeting';
import { useClientValue } from '@/lib/use-client-value';

export function DashboardGreeting({ name }: { name: string | null }) {
  // The greeting depends on the *viewer's* local time, which the server can't
  // know — so render a neutral greeting server-side and swap to the real one
  // once hydrated. Same behaviour as before, one render pass instead of two.
  const greeting = useClientValue(getTimeBasedGreeting, 'Welcome back');

  return (
    <h1 className="font-display text-2xl font-semibold">
      {greeting}
      {name ? `, ${name}` : ''}
    </h1>
  );
}
