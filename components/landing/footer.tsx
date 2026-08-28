import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

const LEGAL_LINKS = [
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/refunds', label: 'Refunds' },
  { href: '/legal/cookies', label: 'Cookies' },
];

export function Footer() {
  return (
    <footer className="border-t border-line px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row md:items-start">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-white/40">Built by [Your Name / Agency Name]</p>
          <p className="text-sm text-white/40">Email: [your contact email]</p>
        </div>
        <div className="flex flex-col items-center gap-2 text-sm text-white/50 md:items-end">
          <div className="flex gap-4">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-4">
            <Link href="/changelog" className="hover:text-white">Changelog</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-white/20">
        &copy; {new Date().getFullYear()} ufo. All rights reserved.
      </p>
    </footer>
  );
}
