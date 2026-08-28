import Link from 'next/link';
import { Nav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-wider text-studio-citron">Legal</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-white/40">Last updated: {updated}</p>
        <div className="mt-10 max-w-none space-y-5 leading-relaxed text-white/70 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-white [&_a]:text-studio-citron [&_a]:no-underline hover:[&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-12 text-xs text-white/30">
          Questions? <Link href="/legal/privacy" className="text-studio-citron hover:underline">Contact us</Link> at [your contact email].
        </p>
      </main>
      <Footer />
    </div>
  );
}
