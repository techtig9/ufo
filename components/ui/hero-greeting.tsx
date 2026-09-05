'use client';

import { getTimeBasedGreeting } from '@/lib/greeting';
import { useClientValue } from '@/lib/use-client-value';

export function HeroGreeting() {
  // Renders nothing until mounted, rather than guessing server-side and
  // risking a hydration mismatch against the visitor's actual local time.
  const greeting = useClientValue<string | null>(getTimeBasedGreeting, null);

  if (!greeting) return null;

  return <p className="mb-3 text-sm text-fg-faint">{greeting} {'\u{1F44B}'}</p>;
}
