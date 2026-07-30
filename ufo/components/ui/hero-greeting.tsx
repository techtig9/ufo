'use client';

import { useEffect, useState } from 'react';
import { getTimeBasedGreeting } from '@/lib/greeting';

export function HeroGreeting() {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(getTimeBasedGreeting());
  }, []);

  // Renders nothing until mounted, rather than guessing server-side and
  // risking a hydration mismatch against the visitor's actual local time.
  if (!greeting) return null;

  return <p className="mb-3 text-sm text-white/40">{greeting} {'\u{1F44B}'}</p>;
}
