import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';

const STEPS = [
  {
    q: 'What are you building?',
    a: '"A meal-planning app for people cooking for one" + Mobile App',
  },
  {
    q: 'Pick your defaults',
    a: 'Style: Minimal · Nav: Bottom tabs · Screens: Home, Onboarding, Recipe Detail, Settings',
  },
  {
    q: 'Generate',
    a: 'Four linked screens with one shared palette and font system, ready to click through',
  },
];

export function AIDemo() {
  return (
    <section id="ai-demo" className="relative mx-auto max-w-5xl px-6 py-24">
      <Reveal>
        <p className="text-center font-mono text-xs uppercase tracking-wider text-studio-citron">Process</p>
        <h2 className="mt-3 text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Multiple-choice, not a blank chat box
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-white/60">
          A fixed sequence of questions keeps the output structure predictable — which is what
          keeps generation error-free.
        </p>
      </Reveal>
      <div className="relative mt-14 grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.q} delay={i * 100}>
            <div className="relative">
              <Panel className="h-full">
                <span className="font-mono text-xs text-studio-coral">STEP {String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 font-display font-medium">{s.q}</h3>
                <p className="mt-2 text-sm text-white/60">{s.a}</p>
              </Panel>
              {i < STEPS.length - 1 && (
                <span className="absolute -right-4 top-1/2 hidden -translate-y-1/2 font-mono text-studio-citron/40 md:block">
                  &rarr;
                </span>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
