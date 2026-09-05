import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CREDIT_COSTS,
  PLAN_MONTHLY_CREDITS,
  PLAN_PRICE_USD,
  canUseFeature,
  fullProjectsPerMonth,
  planAtLeast,
  type CreditAction,
  type GatedFeature,
} from '../lib/credits.ts';
import { PLAN_CARDS } from '../lib/plan-features.ts';
import type { Plan } from '../lib/types.ts';

const PLANS: Plan[] = ['free', 'starter', 'pro', 'business'];
const user = (plan: Plan, creditsRemaining: number) =>
  ({ role: 'user' as const, plan, creditsRemaining });

// ---------------------------------------------------------------------------
// The numbers themselves. These are billing figures printed on the pricing
// page — a silent edit here changes what customers are charged for.
// ---------------------------------------------------------------------------

test('every plan has credits and a price', () => {
  for (const plan of PLANS) {
    assert.ok(Number.isInteger(PLAN_MONTHLY_CREDITS[plan]), plan);
    assert.ok(PLAN_MONTHLY_CREDITS[plan] > 0, plan);
    assert.ok(Number.isInteger(PLAN_PRICE_USD[plan]), plan);
  }
});

test('credits and price both increase with every tier', () => {
  for (let i = 1; i < PLANS.length; i++) {
    const [lower, higher] = [PLANS[i - 1], PLANS[i]];
    assert.ok(PLAN_MONTHLY_CREDITS[higher] > PLAN_MONTHLY_CREDITS[lower], `${higher} > ${lower}`);
    assert.ok(PLAN_PRICE_USD[higher] > PLAN_PRICE_USD[lower], `${higher} > ${lower}`);
  }
});

test('only the free plan is free', () => {
  assert.equal(PLAN_PRICE_USD.free, 0);
  for (const plan of PLANS.filter((p) => p !== 'free')) {
    assert.ok(PLAN_PRICE_USD[plan] > 0, plan);
  }
});

test('every credit cost is a positive integer', () => {
  for (const [action, cost] of Object.entries(CREDIT_COSTS)) {
    assert.ok(Number.isInteger(cost) && cost > 0, `${action} = ${cost}`);
  }
});

test('the free plan can afford at least one full project', () => {
  // Otherwise the free tier cannot demonstrate the product at all.
  assert.ok(PLAN_MONTHLY_CREDITS.free >= CREDIT_COSTS.generate_full_project);
  assert.ok(fullProjectsPerMonth('free') >= 1);
});

test('read-only analyses cost less than the rewrites they inform', () => {
  // The pricing rationale in lib/credits.ts: an analysis returns findings, a
  // rewrite returns a regenerated screen and burns far more output tokens.
  assert.ok(CREDIT_COSTS.audit_accessibility < CREDIT_COSTS.improve_accessibility);
  assert.ok(CREDIT_COSTS.check_consistency < CREDIT_COSTS.improve_ux);
});

test('the pricing page quotes the same numbers the gate enforces', () => {
  // A pricing card that disagrees with CREDIT_COSTS is a false advertisement.
  for (const card of PLAN_CARDS) {
    assert.equal(card.credits, PLAN_MONTHLY_CREDITS[card.plan], `${card.plan} credits`);
    assert.equal(card.price, PLAN_PRICE_USD[card.plan], `${card.plan} price`);
    assert.equal(card.fullProjects, fullProjectsPerMonth(card.plan), `${card.plan} projects`);
  }
});

test('every plan has exactly one pricing card', () => {
  assert.deepEqual(PLAN_CARDS.map((c) => c.plan).sort(), [...PLANS].sort());
});

// ---------------------------------------------------------------------------
// Plan ordering.
// ---------------------------------------------------------------------------

test('planAtLeast orders the tiers correctly', () => {
  assert.ok(planAtLeast('business', 'free'));
  assert.ok(planAtLeast('pro', 'starter'));
  assert.ok(planAtLeast('starter', 'starter'));
  assert.equal(planAtLeast('free', 'starter'), false);
  assert.equal(planAtLeast('starter', 'pro'), false);
  assert.equal(planAtLeast('pro', 'business'), false);
});

// ---------------------------------------------------------------------------
// The gate. This is what stands between a free account and paid features.
// ---------------------------------------------------------------------------

test('a plan-blocked feature is refused however many credits you hold', () => {
  // The block is categorical, not a pricing question — buying credits must not
  // unlock a tier feature.
  for (const feature of ['voice_input', 'import_design', 'code_export', 'design_handoff'] as GatedFeature[]) {
    const result = canUseFeature(user('free', 999_999), feature);
    assert.equal(result.allowed, false, feature);
    assert.match(result.reason ?? '', /Free plan/);
  }
});

test('Starter unlocks the free-tier blocks but not the Pro ones', () => {
  assert.ok(canUseFeature(user('starter', 10_000), 'code_export').allowed);
  assert.ok(canUseFeature(user('starter', 10_000), 'design_handoff').allowed);

  for (const feature of ['figma_export', 'api_access'] as GatedFeature[]) {
    const result = canUseFeature(user('starter', 999_999), feature);
    assert.equal(result.allowed, false, feature);
    assert.match(result.reason ?? '', /Pro or Business/);
  }
});

test('Pro and Business unlock everything that is plan-gated', () => {
  for (const plan of ['pro', 'business'] as Plan[]) {
    for (const feature of ['figma_export', 'api_access', 'code_export', 'voice_input'] as GatedFeature[]) {
      assert.ok(canUseFeature(user(plan, 999_999), feature).allowed, `${plan}/${feature}`);
    }
  }
});

test('insufficient credits refuse the action and say by how much', () => {
  const cost = CREDIT_COSTS.generate_full_project;
  const result = canUseFeature(user('pro', cost - 1), 'generate_full_project');
  assert.equal(result.allowed, false);
  assert.equal(result.creditsRequired, cost);
  assert.match(result.reason ?? '', new RegExp(cost.toLocaleString()));
});

test('exactly enough credits is allowed', () => {
  // An off-by-one here either blocks a paid-for action or gives one away.
  const cost = CREDIT_COSTS.generate_full_project;
  const result = canUseFeature(user('pro', cost), 'generate_full_project');
  assert.equal(result.allowed, true);
  assert.equal(result.creditsRequired, cost);
});

test('zero credits blocks every priced action', () => {
  for (const action of Object.keys(CREDIT_COSTS) as CreditAction[]) {
    const result = canUseFeature(user('business', 0), action);
    assert.equal(result.allowed, false, action);
  }
});

test('a negative balance cannot be spent from', () => {
  // Should be unreachable, but a corrupted row must fail closed, not open.
  assert.equal(canUseFeature(user('pro', -100), 'generate_screen').allowed, false);
});

test('an admin bypasses both plan gating and credits', () => {
  const admin = { role: 'admin' as const, plan: 'free' as Plan, creditsRemaining: 0 };
  for (const feature of ['figma_export', 'api_access', 'generate_full_project'] as GatedFeature[]) {
    const result = canUseFeature(admin, feature);
    assert.equal(result.allowed, true, feature);
    // And is charged nothing, so an admin action cannot draw down a balance.
    assert.equal(result.creditsRequired, undefined, feature);
  }
});

test('an unpriced gated feature passes once the plan allows it', () => {
  // code_export has no credit cost — it is a plan gate only.
  const result = canUseFeature(user('starter', 0), 'code_export');
  assert.equal(result.allowed, true);
  assert.equal(result.creditsRequired, undefined);
});

test('every priced action is reachable on the top plan with a full balance', () => {
  for (const action of Object.keys(CREDIT_COSTS) as CreditAction[]) {
    const result = canUseFeature(user('business', PLAN_MONTHLY_CREDITS.business), action);
    assert.ok(result.allowed, `${action} must be affordable on Business`);
  }
});

test('no single action costs more than a free month of credits without being plan-blocked', () => {
  // A free user who can reach an action must be able to afford it at least
  // once; otherwise the button is permanently dead for them.
  for (const action of Object.keys(CREDIT_COSTS) as CreditAction[]) {
    const result = canUseFeature(user('free', PLAN_MONTHLY_CREDITS.free), action);
    const planBlocked = !result.allowed && /plan/i.test(result.reason ?? '');
    assert.ok(
      result.allowed || planBlocked,
      `${action}: a free user can reach it but can never afford it (costs ${CREDIT_COSTS[action]}, free grant is ${PLAN_MONTHLY_CREDITS.free})`
    );
  }
});
