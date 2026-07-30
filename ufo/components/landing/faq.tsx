'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';

const FAQS = [
  {
    q: 'Does it export real code, or just images?',
    a: 'Real HTML + Tailwind CSS per screen, plus PNG snapshots and a generated style guide — the ZIP export opens directly in a browser with no missing assets.',
  },
  {
    q: 'What happens to unused credits?',
    a: 'They expire at the end of each billing cycle and don\u2019t roll over. You can buy top-up packs any time if you run out mid-cycle.',
  },
  {
    q: 'Can I bring an existing design in?',
    a: 'On paid plans, yes — paste a live URL, upload a screenshot, or drop a Figma link, describe what you want changed, and ufo redesigns or extends it.',
  },
  {
    q: 'Is Figma export real today?',
    a: 'The button is wired up, but the real Figma REST API integration ships in Phase 2 once OAuth app review is complete — today it queues the request.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, from Billing in your dashboard. You keep access through the end of the current billing period.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <p className="text-center font-mono text-xs uppercase tracking-wider text-studio-citron">FAQ</p>
        <h2 className="mt-3 text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Questions
        </h2>
      </Reveal>
      <div className="mt-10 space-y-3">
        {FAQS.map((item, i) => (
          <Panel key={item.q} hover={false} className="cursor-pointer p-5">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              <span className="font-medium">{item.q}</span>
              <span className="text-white/40">{open === i ? '\u2212' : '+'}</span>
            </button>
            {open === i && <p className="mt-3 text-sm text-white/60">{item.a}</p>}
          </Panel>
        ))}
      </div>
    </section>
  );
}
