'use client';

import { useState } from 'react';
import { ANNUAL_SAVING_PCT, type BillingPeriod } from '@/lib/credits';

/**
 * Monthly / yearly switch for the pricing grid.
 *
 * Rendered as a radiogroup rather than a checkbox-styled-as-a-switch: there
 * are two named choices, both of which should be readable and selectable, and
 * a screen reader announcing "billing toggle, off" tells nobody which period
 * they are looking at.
 *
 * The saving is imported, not typed into the label. The copy here used to
 * claim "annual billing saves 10-15%" with nothing computing it — a number in
 * marketing copy that no code agrees with is a number that eventually becomes
 * false.
 */
export function PricingToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
}) {
  const options: { value: BillingPeriod; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="inline-flex rounded-full border border-edge bg-surface-subtle p-1"
      >
        {options.map((opt) => {
          const active = period === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-micro ${
                active
                  ? 'bg-brand font-semibold text-brand-ink'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-fg-faint">
        Yearly is {ANNUAL_SAVING_PCT}% cheaper — pay for ten months, get twelve.
      </p>
    </div>
  );
}
