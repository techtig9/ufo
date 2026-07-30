'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const stored = document.documentElement.classList.contains('light');
    setLight(stored);
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle('light', next);
  }

  return (
    <Button variant="secondary" size="sm" onClick={toggle}>
      Switch to {light ? 'Dark' : 'Light'} mode
    </Button>
  );
}
