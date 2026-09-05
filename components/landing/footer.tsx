import Link from 'next/link';
import { companyValue } from '@/lib/company';
import { Logo } from '@/components/ui/logo';

const LEGAL_LINKS = [
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/refunds', label: 'Refunds' },
  { href: '/legal/cookies', label: 'Cookies' },
];

export function Footer() {
  return (
    <footer className="border-t border-edge px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row md:items-start">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-fg-faint">Built by {companyValue('displayName')}</p>
          <p className="text-sm text-fg-faint">Email: {companyValue('contactEmail')}</p>
        </div>
        <div className="flex flex-col items-center gap-2 text-sm text-fg-muted md:items-end">
          <div className="flex gap-4">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-fg">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-4">
            <Link href="/changelog" className="hover:text-fg">Changelog</Link>
            <Link href="/contact" className="hover:text-fg">Contact</Link>
          </div>
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-fg-faint">
        &copy; {new Date().getFullYear()} ufo. All rights reserved.
      </p>
    </footer>
  );
}
