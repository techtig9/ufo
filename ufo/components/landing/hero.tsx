import Link from 'next/link';
import { GridField } from '@/components/ui/grid-field';
import { Button } from '@/components/ui/button';
import { TiltCard } from '@/components/ui/tilt-card';
import { HeroGreeting } from '@/components/ui/hero-greeting';

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20 md:pt-28">
      <GridField strength="strong" />
      <div className="relative mx-auto max-w-4xl text-center">
        <HeroGreeting />
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-studio-citron animate-blink" />
          A full clickable prototype, not a mockup
        </div>
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Describe the product.
          <br />
          Get a <span className="text-studio-citron">clickable prototype</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/60">
          Answer a few multiple-choice questions. ufo generates a full multi-screen UI with a
          real design system — then you click through it like a real product, edit the code, and
          export it.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup">
            <Button size="lg">Generate Your First Design</Button>
          </Link>
          <a href="#ai-demo">
            <Button size="lg" variant="secondary">See How It Works</Button>
          </a>
        </div>
      </div>

      {/* Signature element: a live "artboard" — ruler ticks, crop-marks,
          a marching-ants selection box with a dimension label, like the
          canvas of the tool itself, not a generic screenshot. */}
      <div className="relative mx-auto mt-16 max-w-4xl">
        <div className="ruler-ticks mb-1 opacity-40" />
        <TiltCard>
          <div className="crop-marks panel p-3">
            <div className="flex items-center gap-1.5 border-b border-line px-3 pb-3">
              <span className="h-2.5 w-2.5 rounded-full bg-studio-coral/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-studio-citron/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-studio-indigo/70" />
              <span className="ml-3 font-mono text-xs text-white/40">ufo/proto/onboarding-flow-3x8k</span>
            </div>
            <div className="grid grid-cols-3 gap-3 p-4">
              {['Home', 'Onboarding', 'Dashboard'].map((name, i) => (
                <div key={name} className="relative aspect-[9/16] rounded-lg border border-line bg-white/[0.02] p-2">
                  {i === 1 && (
                    <span className="marching-ants absolute -inset-1 rounded-lg opacity-70" />
                  )}
                  <div className="mb-2 h-2 w-1/2 rounded bg-white/15" />
                  <div className="space-y-1.5">
                    <div className="h-8 rounded bg-studio-citron/10 border border-studio-citron/20" />
                    <div className="h-2 w-3/4 rounded bg-white/10" />
                    <div className="h-2 w-1/2 rounded bg-white/10" />
                  </div>
                  <p className="mt-3 text-center font-mono text-[10px] text-white/30">{name}</p>
                  {i === 1 && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded bg-studio-citron px-1.5 py-0.5 font-mono text-[9px] text-ink">
                      375 &times; 812
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TiltCard>
      </div>
    </section>
  );
}
