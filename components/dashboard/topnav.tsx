'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { CommandPalette } from '@/components/ui/command-palette';

interface TopnavProps { userName: string | null; plan: string; creditsRemaining: number; }

export function Topnav({ userName, plan, creditsRemaining }: TopnavProps) {
  const router = useRouter();
  const supabase = createClient();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  /**
   * Clicking the search field raises the same shortcut the palette listens
   * for, so the keyboard path and the pointer path cannot drift apart.
   */
  function openCommandPalette() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const menuItems: DropdownItem[] = [
    { id: 'settings', label: 'Settings', onSelect: () => router.push('/dashboard/settings') },
    { id: 'help', label: 'Help & Support', onSelect: () => router.push('/help') },
    { id: 'logout', label: 'Log out', destructive: true, onSelect: handleLogout },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-edge bg-chrome-translucent px-4 backdrop-blur-xl md:px-6">
      <button
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open menu"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-edge text-fg-muted hover:text-fg md:hidden"
      >
        ☰
      </button>
      {/* Opens the real command palette. This previously routed to
          /dashboard/projects while advertising ⌘K — a dead control. */}
      <button
        onClick={openCommandPalette}
        aria-keyshortcuts="Meta+K Control+K"
        className="hidden w-full max-w-md items-center gap-3 rounded-xl border border-edge bg-surface-subtle px-3.5 py-2.5 text-left text-xs text-fg-faint transition-colors duration-micro hover:border-edge-strong hover:text-fg-muted sm:flex"
      >
        <span aria-hidden="true" className="text-sm">⌕</span>
        <span>Search projects, pages and actions…</span>
        <kbd className="ml-auto rounded-md border border-edge px-1.5 py-0.5 text-[9px] text-fg-faint">⌘ K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden rounded-full border border-edge bg-surface-subtle px-3 py-1.5 text-[10px] text-fg-muted sm:block">
          <span className="text-brand-text">●</span> {creditsRemaining.toLocaleString()} credits · <span className="capitalize">{plan}</span>
        </div>
        <NotificationCenter />
        <Dropdown
          triggerLabel={`Account menu${userName ? ` for ${userName}` : ''}`}
          items={menuItems}
          header={userName && <p className="truncate text-xs text-fg-faint">{userName}</p>}
          trigger={
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-xs font-semibold !text-fg ring-2 ring-edge">
              {(userName ?? 'U').charAt(0).toUpperCase()}
            </span>
          }
        />
      </div>
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <CommandPalette />
    </header>
  );
}
