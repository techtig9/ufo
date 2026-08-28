'use client';

import { useEffect, useState } from 'react';
import { getTimeBasedGreeting } from '@/lib/greeting';

export function DashboardGreeting({ name }: { name: string | null }) {
  const [greeting, setGreeting] = useState('Welcome back');

  useEffect(() => {
    setGreeting(getTimeBasedGreeting());
  }, []);

  return (
    <h1 className="font-display text-2xl font-semibold">
      {greeting}
      {name ? `, ${name}` : ''}
    </h1>
  );
}
