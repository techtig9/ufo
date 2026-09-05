import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-edge bg-chrome-translucent backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" aria-label="ufo home"><Logo /></Link>
        <nav className="hidden items-center gap-8 text-sm text-fg-muted md:flex">
          <a href="#features" className="transition hover:text-fg">Features</a>
          <a href="#templates" className="transition hover:text-fg">Templates</a>
          <a href="#pricing" className="transition hover:text-fg">Pricing</a>
          <a href="#faq" className="transition hover:text-fg">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm text-fg-muted transition hover:text-fg sm:block">Log in</Link>
          <Link href="/signup">
            <Button size="sm" className="rounded-xl px-4 shadow-[0_0_28px_rgba(212,255,79,0.18)]">Start building free</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
