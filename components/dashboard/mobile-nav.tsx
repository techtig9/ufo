'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Drawer } from '@/components/ui/drawer';
import { LINKS, SECONDARY } from '@/components/dashboard/sidebar';

/**
 * The desktop Sidebar is `hidden md:flex` — below that breakpoint there was no
 * navigation at all (no hamburger, no bottom bar), so a mobile user had no way to
 * reach Projects/Templates/Billing/Settings except typing the URL directly.
 */
export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  function renderLink(link: { href: string; label: string; icon: string }) {
    const active = link.href === '/dashboard' ? pathname === link.href : pathname.startsWith(link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClose}
        className={clsx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
          active ? 'bg-surface-raised text-fg' : 'text-fg-muted hover:bg-surface-subtle hover:text-fg'
        )}
      >
        <span className={clsx('grid h-7 w-7 place-items-center rounded-lg text-xs', active ? 'bg-surface-raised text-brand-text' : 'bg-surface-subtle')}>
          {link.icon}
        </span>
        {link.label}
      </Link>
    );
  }

  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="left" widthClassName="max-w-xs">
      <Link href="/dashboard/ai-designer" onClick={onClose} className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-studio-citron px-4 py-3 text-sm font-semibold text-brand-ink">
        <span>✦</span> Create with AI
      </Link>
      <nav className="space-y-1">
        <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[.18em] text-fg-faint">Workspace</p>
        {LINKS.map(renderLink)}
      </nav>
      <nav className="mt-6 space-y-1">
        <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[.18em] text-fg-faint">Account</p>
        {SECONDARY.map(renderLink)}
      </nav>
    </Drawer>
  );
}
