'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui/panel';
import { PaddleCheckoutButton } from '@/components/dashboard/paddle-checkout-button';
import { PricingToggle } from '@/components/landing/pricing-toggle';
import { PLAN_CARDS } from '@/lib/plan-features';
import { monthlyEquivalent, PLAN_PRICE_USD_YEARLY, type BillingPeriod } from '@/lib/credits';
import type { Plan } from '@/lib/types';

/**
 * Plan selection with the monthly/yearly switch, in the dashboard.
 *
 * The price ids arrive as a prop rather than being read from `process.env`
 * here. Both sets ARE `NEXT_PUBLIC_`, so either would work — but resolving
 * them on the server keeps one list of what is configured, and means the
 * "not configured" message can name the exact variable that is missing for
 * the period the user is actually looking at.
 */
export function PlanPicker({
  priceIds,
  currentPlan,
  userId,
  userEmail,
}: {
  priceIds: Record<BillingPeriod, Partial<Record<Plan, string>>>;
  currentPlan: Plan | null;
  userId: string;
  userEmail: string;
}) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  return (
    <div>
      <PricingToggle period={period} onChange={setPeriod} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_CARDS.map((card) => {
          const isCurrent = currentPlan === card.plan;
          const priceId = priceIds[period][card.plan];
          const envName = `NEXT_PUBLIC_PADDLE_PRICE_${card.plan.toUpperCase()}${
            period === 'yearly' ? '_YEARLY' : ''
          }`;

          return (
            <Panel key={card.plan}>
              <h3 className="font-medium">{card.label}</h3>
              <p className="mt-1 text-2xl font-semibold">
                ${period === 'yearly' ? monthlyEquivalent(card.plan) : card.price}
                <span className="text-sm text-fg-faint">/mo</span>
              </p>
              {period === 'yearly' && card.price > 0 ? (
                <p className="mt-0.5 text-xs text-brand-text">
                  ${PLAN_PRICE_USD_YEARLY[card.plan].toLocaleString()} billed yearly
                </p>
              ) : null}
              <p className="mt-1 text-xs text-fg-faint">{card.credits.toLocaleString()} credits</p>

              <div className="mt-4">
                {isCurrent ? (
                  <span className="text-xs text-accent-text">Current plan</span>
                ) : card.plan === 'free' ? (
                  <span className="text-xs text-fg-faint">Cancel above to move to Free</span>
                ) : priceId ? (
                  <PaddleCheckoutButton
                    priceId={priceId}
                    userId={userId}
                    userEmail={userEmail}
                    label={`Choose ${card.label}`}
                  />
                ) : (
                  // Names the variable for the period being viewed, so a
                  // half-configured Paddle account (monthly set up, yearly not)
                  // says exactly which one is missing.
                  <span className="text-xs text-fg-faint">Set {envName}</span>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
