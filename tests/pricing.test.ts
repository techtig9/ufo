import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_PRICE_USD,
  PLAN_PRICE_USD_YEARLY,
  PLAN_MONTHLY_CREDITS,
  ANNUAL_MONTHS_CHARGED,
  ANNUAL_SAVING_PCT,
  monthlyEquivalent,
} from '../lib/credits.ts';
import { PLAN_CARDS } from '../lib/plan-features.ts';
import type { Plan } from '../lib/types.ts';

const PAID: Plan[] = ['starter', 'pro', 'business'];

/**
 * The pricing page used to carry the sentence "Annual billing saves 10–15%"
 * with nothing in the code computing it, alongside a launch discount that was
 * never implemented. A number in marketing copy that no code agrees with is a
 * number that eventually becomes false. These tests make the arithmetic the
 * source of truth.
 */

test('a year costs exactly ten months, on every paid plan', () => {
  for (const plan of PAID) {
    assert.equal(PLAN_PRICE_USD_YEARLY[plan], PLAN_PRICE_USD[plan] * ANNUAL_MONTHS_CHARGED);
  }
});

test('free stays free on both billing periods', () => {
  assert.equal(PLAN_PRICE_USD.free, 0);
  assert.equal(PLAN_PRICE_USD_YEARLY.free, 0);
  assert.equal(monthlyEquivalent('free'), 0);
});

test('the advertised saving matches the arithmetic', () => {
  // 2 free months out of 12 = 17%, rounded. If ANNUAL_MONTHS_CHARGED changes,
  // the label on the toggle changes with it.
  assert.equal(ANNUAL_SAVING_PCT, Math.round(((12 - ANNUAL_MONTHS_CHARGED) / 12) * 100));
  for (const plan of PAID) {
    const realSaving = 1 - PLAN_PRICE_USD_YEARLY[plan] / (PLAN_PRICE_USD[plan] * 12);
    assert.equal(Math.round(realSaving * 100), ANNUAL_SAVING_PCT);
  }
});

test('the monthly-equivalent price is always cheaper than paying monthly', () => {
  for (const plan of PAID) {
    assert.ok(
      monthlyEquivalent(plan) < PLAN_PRICE_USD[plan],
      `${plan}: yearly must be cheaper per month, or the toggle is selling a worse deal`
    );
  }
});

test('the monthly equivalent never claims more than the annual total charged', () => {
  // This caught a real defect: $290 / 12 rounds to $24.17, and $24.17 x 12 is
  // $290.04 — four cents more than the "billed yearly" figure printed directly
  // underneath. Flooring makes the per-month number a lower bound.
  for (const plan of PAID) {
    const v = monthlyEquivalent(plan);
    assert.equal(v, Math.round(v * 100) / 100, 'at most two decimal places');
    assert.ok(
      Math.round(v * 12 * 100) / 100 <= PLAN_PRICE_USD_YEARLY[plan],
      `${plan}: ${v} x 12 must not exceed the ${PLAN_PRICE_USD_YEARLY[plan]} we actually charge`
    );
    // …and must still be close enough to be honest, not a teaser price.
    assert.ok(PLAN_PRICE_USD_YEARLY[plan] - v * 12 < 0.12, `${plan}: understates by under 12c`);
  }
});

test('every plan card matches the credits and price constants', () => {
  // The cards are what a visitor reads; the constants are what the server
  // enforces. A divergence is a plan advertising a limit nobody applies.
  for (const card of PLAN_CARDS) {
    assert.equal(card.price, PLAN_PRICE_USD[card.plan], `${card.plan} price`);
    assert.equal(card.credits, PLAN_MONTHLY_CREDITS[card.plan], `${card.plan} credits`);
  }
});

test('plans get strictly more expensive and strictly more generous together', () => {
  const order: Plan[] = ['free', 'starter', 'pro', 'business'];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(
      PLAN_PRICE_USD[order[i]] > PLAN_PRICE_USD[order[i - 1]],
      `${order[i]} must cost more than ${order[i - 1]}`
    );
    assert.ok(
      PLAN_MONTHLY_CREDITS[order[i]] > PLAN_MONTHLY_CREDITS[order[i - 1]],
      `${order[i]} must give more credits than ${order[i - 1]} — otherwise upgrading is a downgrade`
    );
  }
});
