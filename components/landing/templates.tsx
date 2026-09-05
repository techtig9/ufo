import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';

const TEMPLATES = [
  { name: 'SaaS Dashboard', type: 'Dashboard', tone: 'from-violet-500/25 to-indigo-500/5' },
  { name: 'D2C Storefront', type: 'E-commerce', tone: 'from-amber-400/20 to-orange-500/5' },
  { name: 'Mobile App', type: 'Product', tone: 'from-cyan-400/20 to-blue-500/5' },
  { name: 'Agency Landing', type: 'Marketing', tone: 'from-studio-citron/20 to-emerald-500/5' },
];

export function Templates() {
  return <section id="templates" className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><Reveal><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><span className="text-xs font-semibold uppercase tracking-[.18em] text-accent-alt-text">Templates</span><h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-5xl">A head start for every idea.</h2></div><p className="max-w-md text-sm leading-6 text-fg-faint">Start from a proven structure, then let UFO adapt it to your brand and requirements.</p></div></Reveal><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{TEMPLATES.map((t,i)=><Reveal key={t.name} delay={i*60}><Panel className="group overflow-hidden border-edge bg-surface p-0 transition duration-300 hover:-translate-y-1 hover:border-edge-strong"><div className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${t.tone} p-4`}><div className="h-full rounded-xl border border-edge bg-[#0d0e12]/75 p-3 shadow-xl"><div className="flex items-center justify-between"><span className="h-1.5 w-10 rounded-full bg-surface-strong"/><span className="h-3 w-3 rounded-full bg-surface-raised"/></div><div className="mt-5 h-3 w-2/3 rounded bg-surface-strong"/><div className="mt-2 h-1.5 w-1/2 rounded bg-surface-raised"/><div className="mt-5 grid grid-cols-2 gap-2"><span className="h-16 rounded-lg bg-surface-subtle"/><span className="h-16 rounded-lg bg-violet-400/10"/></div></div></div><div className="flex items-center justify-between p-4"><div><p className="text-sm font-semibold">{t.name}</p><p className="mt-1 text-[10px] text-fg-faint">{t.type}</p></div><span className="text-fg-faint transition group-hover:translate-x-1 group-hover:text-fg">→</span></div></Panel></Reveal>)}</div></section>;
}
