import Link from 'next/link';
import { GridField } from '@/components/ui/grid-field';
import { Logo } from '@/components/ui/logo';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/activity', label: 'Activity' },
  { href: '/admin/ai', label: 'AI' },
  { href: '/admin/email', label: 'Email' },
  { href: '/admin/system', label: 'System' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <GridField strength="subtle" className="fixed" />
      <div className="relative mx-auto max-w-6xl p-6">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-sm text-fg-faint">Admin</span>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm text-fg-muted">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-fg">
                {l.label}
              </Link>
            ))}
            <Link href="/dashboard" className="text-fg-faint hover:text-fg">
              &larr; Back to app
            </Link>
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}
