import type { Plan } from './types';

/**
 * Source of truth for Phase 1.6 ("Credits, Plans & Feature Gating").
 * Keep this in lockstep with the Pricing Plans & Cost Optimisation Strategy
 * section of ufo-ai-one-day-build-command.md — the Final Instruction in that
 * doc explicitly calls out checking these numbers match before shipping.
 */

export const PLAN_MONTHLY_CREDITS: Record<Plan, number> = {
  free: 150,
  starter: 5000,
  pro: 13000,
  business: 26000,
};

export const PLAN_PRICE_USD: Record<Plan, number> = {
  free: 0,
  starter: 15,
  pro: 29,
  business: 59,
};

export type CreditAction =
  | 'generate_full_project'
  | 'import_redesign'
  | 'regenerate_project'
  | 'generate_screen'
  | 'generate_component'
  | 'change_theme'
  | 'update_screen'
  | 'voice_transcription'
  | 'export_figma';

export const CREDIT_COSTS: Record<CreditAction, number> = {
  generate_full_project: 1500,
  import_redesign: 1900,
  regenerate_project: 400,
  generate_screen: 250,
  generate_component: 100,
  change_theme: 40,
  update_screen: 90,
  voice_transcription: 50,
  export_figma: 150,
};

// Actions below are always free regardless of plan — never call
// canUseFeature/deductCredits for these, they don't touch the credits column.
// export_code, export_assets, publish_share_link, duplicate_project,
// restore_version, all Optional Zero-Cost Add-Ons.

export type GatedFeature =
  | 'voice_input'
  | 'import_design'
  | 'code_export'
  | 'design_handoff'
  | 'figma_export'
  | 'api_access'
  | CreditAction;

const PLAN_ORDER: Plan[] = ['free', 'starter', 'pro', 'business'];

/** Free-tier gates: features that are entirely unavailable, not just credit-limited. */
const FREE_TIER_BLOCKED: GatedFeature[] = [
  'voice_input',
  'import_design',
  'code_export',
  'design_handoff',
  'figma_export',
  'api_access',
  'import_redesign',
  'voice_transcription',
];

const STARTER_BLOCKED: GatedFeature[] = ['figma_export', 'api_access'];

interface GateSubject {
  role: 'user' | 'admin';
  plan: Plan;
  creditsRemaining: number;
}

interface GateResult {
  allowed: boolean;
  reason?: string;
  creditsRequired?: number;
}

/**
 * Single shared feature/credit gate used by every AI-generation route.
 * Admins always bypass — no credit deduction, no plan restriction.
 */
export function canUseFeature(user: GateSubject, feature: GatedFeature): GateResult {
  if (user.role === 'admin') return { allowed: true };

  if (user.plan === 'free' && FREE_TIER_BLOCKED.includes(feature)) {
    return {
      allowed: false,
      reason: 'This feature isn\u2019t available on the Free plan. Upgrade to Starter to unlock it.',
    };
  }
  if (user.plan === 'starter' && STARTER_BLOCKED.includes(feature)) {
    return {
      allowed: false,
      reason: 'This feature needs Pro or Business. Upgrade to unlock it.',
    };
  }

  const cost = CREDIT_COSTS[feature as CreditAction];
  if (cost === undefined) {
    // Feature has no credit cost (e.g. code_export as a gate check only) —
    // plan gating above already covers it.
    return { allowed: true };
  }

  if (user.creditsRemaining < cost) {
    return {
      allowed: false,
      reason: `You need ${cost.toLocaleString()} credits for this and have ${user.creditsRemaining.toLocaleString()} left this cycle.`,
      creditsRequired: cost,
    };
  }

  return { allowed: true, creditsRequired: cost };
}

export function planAtLeast(plan: Plan, minimum: Plan): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(minimum);
}

export function fullProjectsPerMonth(plan: Plan): number {
  return Math.floor(PLAN_MONTHLY_CREDITS[plan] / CREDIT_COSTS.generate_full_project);
}
