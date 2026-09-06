import Link from 'next/link';
import clsx from 'clsx';
import { PLAN_CARDS } from '@/lib/plan-features';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';
import { GridField } from '@/components/ui/grid-field';
import { TiltCard } from '@/components/ui/tilt-card';

export function PricingSection() {
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

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-semibold">
                    ${card.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-fg-faint">/mo</span>
                </div>
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
                <Link href={`/signup?plan=${card.plan}`} className="mt-8 block">
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

        <p className="mt-8 text-center text-xs text-fg-faint">
          First 30 days: 10&ndash;20% off Starter/Pro/Business. Annual billing saves 10&ndash;15%. Extra
          credits available as top-up packs from your dashboard.
        </p>
      </div>
    </section>
  );
}
