import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';

const TEMPLATES = [
  { name: 'SaaS Dashboard', type: 'Dashboard', tone: 'from-violet-500/25 to-indigo-500/5' },
  { name: 'D2C Storefront', type: 'E-commerce', tone: 'from-amber-400/20 to-orange-500/5' },
  { name: 'Mobile App', type: 'Product', tone: 'from-cyan-400/20 to-blue-500/5' },
  { name: 'Agency Landing', type: 'Marketing', tone: 'from-studio-citron/20 to-emerald-500/5' },
];

export function Templates() {
  return <section id="templates" className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><Reveal><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><span className="text-xs font-semibold uppercase tracking-[.18em] text-violet-300">Templates</span><h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-5xl">A head start for every idea.</h2></div><p className="max-w-md text-sm leading-6 text-white/40">Start from a proven structure, then let UFO adapt it to your brand and requirements.</p></div></Reveal><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{TEMPLATES.map((t,i)=><Reveal key={t.name} delay={i*60}><Panel className="group overflow-hidden border-white/[0.08] bg-[#111218] p-0 transition duration-300 hover:-translate-y-1 hover:border-white/15"><div className={`relative aspect-[4/3] overflow-hidden bg-gradient-to-br ${t.tone} p-4`}><div className="h-full rounded-xl border border-white/10 bg-[#0d0e12]/75 p-3 shadow-xl"><div className="flex items-center justify-between"><span className="h-1.5 w-10 rounded-full bg-white/20"/><span className="h-3 w-3 rounded-full bg-white/10"/></div><div className="mt-5 h-3 w-2/3 rounded bg-white/15"/><div className="mt-2 h-1.5 w-1/2 rounded bg-white/[0.08]"/><div className="mt-5 grid grid-cols-2 gap-2"><span className="h-16 rounded-lg bg-white/5"/><span className="h-16 rounded-lg bg-violet-400/10"/></div></div></div><div className="flex items-center justify-between p-4"><div><p className="text-sm font-semibold">{t.name}</p><p className="mt-1 text-[10px] text-white/30">{t.type}</p></div><span className="text-white/25 transition group-hover:translate-x-1 group-hover:text-white">→</span></div></Panel></Reveal>)}</div></section>;
}
