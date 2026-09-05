'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Logo } from '@/components/ui/logo';

export const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: '⌂' },
  { href: '/dashboard/projects', label: 'Projects', icon: '▦' },
  { href: '/dashboard/templates', label: 'Templates', icon: '◇' },
  { href: '/dashboard/ai-designer', label: 'AI Designer', icon: '✦' },
];
export const SECONDARY = [
  { href: '/dashboard/billing', label: 'Billing', icon: '◈' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙' },
  { href: '/help', label: 'Help & Support', icon: '?' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-edge bg-chrome px-4 py-5 md:flex md:flex-col">
      <Link href="/" className="px-3"><Logo /></Link>
      <Link href="/dashboard/ai-designer" className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-studio-citron px-4 py-3 text-sm font-semibold text-brand-ink shadow-[0_10px_30px_rgba(212,255,79,.12)] transition hover:-translate-y-0.5"><span>✦</span> Create with AI</Link>
      <nav className="mt-7 space-y-1">
        <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[.18em] text-fg-faint">Workspace</p>
        {LINKS.map((link) => { const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href)); return <Link key={link.href} href={link.href} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition', active ? 'bg-surface-raised text-fg shadow-inner' : 'text-fg-muted hover:bg-surface-subtle hover:text-fg')}><span className={clsx('grid h-7 w-7 place-items-center rounded-lg text-xs', active ? 'bg-surface-raised text-brand-text' : 'bg-surface-subtle')}>{link.icon}</span>{link.label}</Link>; })}
      </nav>
      <nav className="mt-7 space-y-1">
        <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[.18em] text-fg-faint">Account</p>
        {SECONDARY.map((link) => { const active = pathname.startsWith(link.href); return <Link key={link.href} href={link.href} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition', active ? 'bg-surface-raised text-fg' : 'text-fg-muted hover:bg-surface-subtle hover:text-fg')}><span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-subtle text-xs">{link.icon}</span>{link.label}</Link>; })}
      </nav>
      <div className="mt-auto rounded-2xl border border-edge bg-gradient-to-br from-violet-500/10 to-studio-citron/5 p-4"><p className="text-xs font-semibold">Need more generations?</p><p className="mt-1 text-[10px] leading-4 text-fg-faint">Upgrade your plan to unlock more AI credits and premium workflows.</p><Link href="/dashboard/billing" className="mt-3 block text-[10px] font-semibold text-brand-text">View plans →</Link></div>
    </aside>
  );
}
