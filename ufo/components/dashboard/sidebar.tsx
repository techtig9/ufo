'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Logo } from '@/components/ui/logo';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: '\u25A6' },
  { href: '/dashboard/projects', label: 'Projects', icon: '\u25A3' },
  { href: '/dashboard/templates', label: 'Templates', icon: '\u2699' },
  { href: '/dashboard/ai-designer', label: 'AI Designer', icon: '\u2728' },
  { href: '/dashboard/settings', label: 'Settings', icon: '\u2699\uFE0F' },
  { href: '/dashboard/billing', label: 'Billing', icon: '\u25C8' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="panel sticky top-4 m-4 hidden h-[calc(100vh-2rem)] w-56 flex-col rounded-panel p-4 md:flex">
      <Link href="/" className="mb-8 px-2">
        <Logo />
      </Link>
      <nav className="flex-1 space-y-1">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-studio-citron bg-studio-citron/10 text-white'
                  : 'border-transparent text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
