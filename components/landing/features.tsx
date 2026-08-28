import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';

const FEATURES = [
  ['✦', 'AI website generation', 'Go from a plain-English idea to a structured, responsive website in minutes.'],
  ['◫', 'Visual workspace', 'Preview every screen, switch devices, edit code and refine the design without leaving UFO.'],
  ['◎', 'Design system built in', 'Consistent typography, spacing, colors and components keep generated pages feeling intentional.'],
  ['↗', 'Publish & share', 'Turn a project into a shareable prototype, public link or production-ready handoff.'],
  ['⌘', 'Version history', 'Experiment freely with AI edits. Restore previous versions whenever you need.'],
  ['⚡', 'Fast iteration', 'Use the AI Design Copilot to rewrite sections, improve layouts and polish conversion paths.'],
];

export function Features() {
  return <section id="features" className="relative mx-auto max-w-7xl px-5 py-24 lg:px-8">
    <Reveal><div className="max-w-2xl"><span className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Everything in one workspace</span><h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-5xl">From first prompt to polished product.</h2><p className="mt-5 text-base leading-7 text-white/45">UFO combines generation, visual editing and product handoff into a single workflow built for shipping.</p></div></Reveal>
    <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([icon,title,body],i)=><Reveal key={title} delay={i*60}><Panel className="group h-full border-white/[0.08] bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-400/20 hover:bg-white/[0.04]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-lg text-violet-300 transition group-hover:bg-studio-citron/10 group-hover:text-studio-citron">{icon}</span><h3 className="mt-6 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/40">{body}</p><span className="mt-6 block h-px w-full bg-gradient-to-r from-white/10 to-transparent" /></Panel></Reveal>)}</div>
  </section>;
}
