'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useState } from 'react';
import { PLAN_CARDS } from '@/lib/plan-features';
import { monthlyEquivalent, PLAN_PRICE_USD_YEARLY, type BillingPeriod } from '@/lib/credits';
import { PricingToggle } from './pricing-toggle';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';
import { GridField } from '@/components/ui/grid-field';
import { TiltCard } from '@/components/ui/tilt-card';

export function PricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  return (
    <section id="pricing" className="relative overflow-hidden px-6 py-24">
      <GridField strength="subtle" />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <div className="mx-auto max-w-xl text-center">
            <p className="font-mono text-xs uppercase tracking-wider text-brand-text">Pricing</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Simple pricing, real credits
            </h2>
            <p className="mt-3 text-fg-muted">
              Every plan includes the full generator. Credits cover AI generation; everything
              else — exports, sharing, folders, comments — stays free.
            </p>
          </div>
        </Reveal>

        <PricingToggle period={period} onChange={setPeriod} />

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_CARDS.map((card, i) => {
            const cardInner = (
              <Panel
                hover={!card.featured}
                className={clsx(
                  'flex h-full flex-col',
                  card.featured ? 'crop-marks border-studio-citron/50 shadow-glow' : undefined
                )}
              >
                {card.featured && (
                  <span className="mb-3 inline-block w-fit rounded border border-studio-citron/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brand-text">
                    Most popular
                  </span>
                )}
                <h3 className="font-display text-lg font-medium">{card.label}</h3>
                <p className="mt-1 text-sm text-fg-muted">{card.tagline}</p>
                {/*
                  Rendered plainly, not animated.

                  These were counted up from 0 on scroll, which meant the price
                  read "$0 /mo" and "0 credits" in the server-rendered HTML —
                  what a crawler indexes and a visitor without JavaScript sees —
                  and stayed at 0 for anyone who had not yet scrolled the
                  section into view. A count-up animation is decoration; a
                  price is a claim. Where the two conflict, the price wins.
                */}
                {/*
                  On yearly, the headline stays a MONTHLY figure — the
                  per-month equivalent — with the annual total spelled out
                  underneath. Swapping the headline to $150 next to a
                  competitor's $15 loses the comparison the visitor is actually
                  making, and hiding the annual total would be the other kind
                  of dishonest. Both numbers, one prominent.
                */}
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-semibold">
                    ${(period === 'yearly' ? monthlyEquivalent(card.plan) : card.price).toLocaleString()}
                  </span>
                  <span className="text-sm text-fg-faint">/mo</span>
                </div>
                {period === 'yearly' && card.price > 0 ? (
                  <p className="mt-1 text-xs text-brand-text">
                    ${PLAN_PRICE_USD_YEARLY[card.plan].toLocaleString()} billed yearly
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-xs text-fg-faint">
                  {card.credits.toLocaleString()} credits &middot; ~{card.fullProjects} full projects/mo
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-fg-secondary">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-studio-coral" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={`/signup?plan=${card.plan}&billing=${period}`} className="mt-8 block">
                  <Button variant={card.featured ? 'primary' : 'secondary'} className="w-full">
                    {card.plan === 'free' ? 'Start free' : `Choose ${card.label}`}
                  </Button>
                </Link>
              </Panel>
            );

            return (
              <Reveal key={card.plan} delay={i * 60}>
                {card.featured ? <TiltCard className="h-full">{cardInner}</TiltCard> : cardInner}
              </Reveal>
            );
          })}
        </div>

        {/*
          The old line claimed "annual billing saves 10-15%" and "first 30
          days: 10-20% off" — two ranges with nothing in the code computing
          either, and no launch discount implemented anywhere. The saving is
          now derived from ANNUAL_MONTHS_CHARGED and stated by the toggle; the
          unimplemented launch discount is gone rather than advertised.
        */}
        <p className="mt-8 text-center text-xs text-fg-faint">
          Credits cover AI generation. Extra credits are available as top-up packs from your
          dashboard, on any plan.
        </p>
      </div>
    </section>
  );
}
