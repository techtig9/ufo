import Link from 'next/link';
import { GridField } from '@/components/ui/grid-field';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 text-center">
      <GridField strength="subtle" />
      <div className="relative">
        <p className="font-mono text-sm text-studio-citron">404</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">This screen doesn&rsquo;t exist</h1>
        <p className="mt-2 text-white/50">The page you&rsquo;re looking for was moved, renamed, or never generated.</p>
        <Link href="/" className="mt-8 inline-block">
          <Button>Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
