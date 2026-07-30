import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';

// TODO: replace the bracketed placeholders with your real branding before shipping.
export function About() {
  return (
    <section className="relative mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <Panel>
          <h2 className="font-display text-2xl font-semibold tracking-tight">About Us</h2>
          <p className="mt-4 text-white/60">
            ufo is built by <strong className="text-white">[Your Name / Agency Name]</strong>,
            [a solo developer / a small team] focused on making polished UI/UX design accessible
            to anyone with an idea — no design background required. We specialize in AI-powered
            design generation, rapid prototyping, and MVP delivery, helping founders and small
            teams go from a description to a clickable, presentable prototype in a single
            sitting.
          </p>
        </Panel>
      </Reveal>
    </section>
  );
}
