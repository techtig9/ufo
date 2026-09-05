'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { getServerTheme, getTheme, setTheme, subscribeTheme } from '@/lib/theme';

export function ThemeToggle() {
  // Subscribes to the real DOM/localStorage theme rather than mirroring it into
  // component state on mount, so the label is correct on the first paint and
  // stays in sync if the theme changes in another tab.
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const isLight = theme === 'light';

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      aria-pressed={isLight}
    >
      Switch to {isLight ? 'Dark' : 'Light'} mode
    </Button>
  );
}
