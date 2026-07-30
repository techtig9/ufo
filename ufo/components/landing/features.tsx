import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';
import { TiltCard } from '@/components/ui/tilt-card';

const FEATURES = [
  {
    fig: '01',
    title: 'Real clickable prototype',
    body: 'Not a static image. Click through linked screens on a real device-frame preview, on desktop or on your phone.',
    span: 'lg:col-span-2',
  },
  {
    fig: '02',
    title: 'One shared design system',
    body: 'Every screen shares the same color tokens, font tokens, and spacing scale — it looks designed, not assembled.',
  },
  {
    fig: '03',
    title: 'Import & redesign',
    body: 'Paste a live URL, upload a screenshot, or drop a Figma link — ufo analyzes it and redesigns or extends it.',
  },
  {
    fig: '04',
    title: 'Design Handoff, no Figma needed',
    body: 'Pull the exact hex codes, font stack, and spacing scale as a copyable spec sheet.',
  },
  {
    fig: '05',
    title: 'Full code access',
    body: 'Fine-tune any screen in a built-in Monaco editor, then export the HTML/CSS or PNG snapshots.',
    span: 'lg:col-span-2',
  },
  {
    fig: '06',
    title: 'Share with a link and a QR code',
    body: 'Publish a prototype stakeholders can click through with no account — and drop comments right on the screen.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-6 py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-wider text-studio-citron">Spec sheet</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Everything between an idea and a demo you can hand to a client
          </h2>
        </div>
      </Reveal>
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 60}>
            <TiltCard className={f.span}>
              <Panel className="h-full">
                <span className="font-mono text-xs text-white/30">FIG. {f.fig}</span>
                <h3 className="mt-2 font-display font-medium">{f.title}</h3>
                <p className="mt-2 text-sm text-white/60">{f.body}</p>
              </Panel>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
