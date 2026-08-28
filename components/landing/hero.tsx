import Link from 'next/link';
import { Button } from '@/components/ui/button';

const chips = ['SaaS', 'E-commerce', 'Mobile app', 'Dashboard', 'Landing page'];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-16 md:pt-24 lg:pb-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,92,255,0.18),transparent_34%),radial-gradient(circle_at_10%_30%,rgba(212,255,79,0.07),transparent_25%)]" />
      <div className="relative mx-auto max-w-6xl text-center">
        <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3.5 py-2 text-xs text-white/60 shadow-[0_8px_30px_rgba(0,0,0,.18)]">
          <span className="h-1.5 w-1.5 rounded-full bg-studio-citron shadow-[0_0_10px_rgba(212,255,79,.8)]" />
          AI website generation, redesigned
          <span className="text-white/25">·</span>
          No credit card required
        </div>

        <h1 className="mx-auto max-w-5xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl md:text-7xl lg:text-[84px]">
          Turn an idea into a
          <span className="block bg-gradient-to-r from-white via-white to-studio-indigo bg-clip-text text-transparent">production-ready website.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
          Describe what you want. UFO generates the structure, UI, copy and responsive screens — then you refine everything in one intelligent workspace.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/signup"><Button size="lg" className="h-12 rounded-xl px-7 text-sm shadow-[0_0_36px_rgba(212,255,79,.18)]">Create a website with AI <span className="ml-2">→</span></Button></Link>
          <a href="#ai-demo"><Button size="lg" variant="secondary" className="h-12 rounded-xl px-7 text-sm">Watch how it works</Button></a>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {chips.map((chip) => <span key={chip} className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[11px] text-white/40">{chip}</span>)}
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl text-left">
          <div className="absolute -inset-8 rounded-[40px] bg-[radial-gradient(circle_at_50%_20%,rgba(124,92,255,.16),transparent_55%)] blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#101116] p-2 shadow-[0_35px_100px_rgba(0,0,0,.55)]">
            <div className="flex h-11 items-center justify-between border-b border-white/[0.08] px-4">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#ff6b57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f4c84b]" /><span className="h-2.5 w-2.5 rounded-full bg-[#67d17a]" /></div>
              <div className="hidden rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] text-white/35 sm:block">ufo / studio / acme-saas</div>
              <div className="flex gap-2"><span className="rounded-lg bg-white/5 px-2.5 py-1 text-[10px] text-white/50">Preview</span><span className="rounded-lg bg-studio-citron px-2.5 py-1 text-[10px] font-semibold text-black">Publish</span></div>
            </div>
            <div className="grid min-h-[390px] grid-cols-[150px_minmax(0,1fr)_230px]">
              <div className="hidden border-r border-white/[0.08] p-3 sm:block">
                <p className="mb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-white/30">Pages</p>
                {['Home', 'Features', 'Pricing', 'Contact'].map((p, i) => <div key={p} className={`mb-1 rounded-lg px-3 py-2 text-xs ${i === 0 ? 'bg-white/[0.08] text-white' : 'text-white/35'}`}>{i === 0 ? '⌂' : '○'} <span className="ml-2">{p}</span></div>)}
                <div className="mt-5 rounded-xl border border-dashed border-white/10 p-3 text-center text-[10px] text-white/25">+ Add page</div>
              </div>
              <div className="bg-[#0b0c0f] p-5 sm:p-8">
                <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-white/[0.08] bg-white shadow-2xl">
                  <div className="flex h-7 items-center justify-between border-b border-black/5 px-3"><span className="text-[7px] font-semibold text-black/70">ACME</span><div className="flex gap-2 text-[6px] text-black/35"><span>Product</span><span>Pricing</span><span>About</span></div></div>
                  <div className="bg-gradient-to-br from-[#f8fafc] to-[#eef2ff] px-6 py-10 text-center sm:px-10 sm:py-14">
                    <span className="rounded-full bg-violet-100 px-2 py-1 text-[6px] font-semibold text-violet-700">THE MODERN WORKSPACE</span>
                    <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">Build, launch and grow faster.</h3>
                    <p className="mx-auto mt-2 max-w-xs text-[7px] leading-3 text-slate-500">Everything your team needs to turn ideas into products without slowing down.</p>
                    <div className="mt-5 flex justify-center gap-2"><span className="rounded-md bg-slate-900 px-3 py-1.5 text-[7px] font-semibold text-white">Get started</span><span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[7px] font-semibold text-slate-600">View demo</span></div>
                    <div className="mx-auto mt-8 h-16 max-w-md rounded-lg border border-slate-200 bg-white shadow-sm"><div className="grid h-full grid-cols-3 gap-2 p-2"><span className="rounded bg-slate-100" /><span className="rounded bg-violet-100" /><span className="rounded bg-slate-100" /></div></div>
                  </div>
                </div>
              </div>
              <div className="hidden border-l border-white/[0.08] p-3 md:block">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/15 text-violet-300">✦</span><div><p className="text-[10px] font-semibold">UFO AI</p><p className="text-[8px] text-white/30">Design Copilot</p></div></div><p className="mt-4 text-[10px] leading-4 text-white/45">Make the hero feel more premium and improve the conversion path.</p><button className="mt-3 w-full rounded-lg bg-white/[0.08] py-2 text-[9px] text-white/60">Apply suggestion</button></div>
                <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><p className="text-[9px] font-semibold text-white/50">Responsive</p><div className="mt-2 flex gap-1.5"><span className="flex-1 rounded bg-studio-citron/20 py-1 text-center text-[7px] text-studio-citron">Desktop</span><span className="flex-1 rounded bg-white/5 py-1 text-center text-[7px] text-white/30">Tablet</span><span className="flex-1 rounded bg-white/5 py-1 text-center text-[7px] text-white/30">Mobile</span></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
