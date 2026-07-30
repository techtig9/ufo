import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';

const TEMPLATES = [
  { name: 'SaaS Dashboard', type: 'Dashboard' },
  { name: 'D2C Storefront', type: 'E-commerce' },
  { name: 'Fitness App Onboarding', type: 'Mobile' },
  { name: 'Agency Landing Page', type: 'Landing' },
];

export function Templates() {
  return (
    <section id="templates" className="relative mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <p className="font-mono text-xs uppercase tracking-wider text-studio-citron">Library</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Start from a template, or from a blank description
        </h2>
        <p className="mt-3 text-white/60">
          A growing library across project types — enough today to see the range, more added over time.
        </p>
      </Reveal>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATES.map((t, i) => (
          <Reveal key={t.name} delay={i * 60}>
            <Panel className="panel-hover overflow-hidden p-0">
              <div className="dot-canvas flex aspect-[4/3] items-center justify-center">
                <div className="h-16 w-12 rounded-md border border-line bg-white/5" />
              </div>
              <div className="flex items-center justify-between p-4">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="font-mono text-[10px] uppercase text-studio-citron/70">{t.type}</p>
              </div>
            </Panel>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
