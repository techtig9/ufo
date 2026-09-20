'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';
import { FAQS } from '@/lib/faq';



export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative mx-auto max-w-3xl px-6 py-24">
      <Reveal>
        <p className="text-center font-mono text-xs uppercase tracking-wider text-brand-text">FAQ</p>
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
              <span className="text-fg-faint">{open === i ? '\u2212' : '+'}</span>
            </button>
            {open === i && <p className="mt-3 text-sm text-fg-muted">{item.a}</p>}
          </Panel>
        ))}
      </div>
    </section>
  );
}
