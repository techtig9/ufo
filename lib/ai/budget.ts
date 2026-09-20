import { createAdminClient } from '../supabase/admin';
import { isSupabaseAdminConfigured } from '../supabase/config';
import { log } from '../observability';
import { estimateCostUsd } from './cost';

/**
 * The AI spend cap, and the kill switch.
 *
 * An AI product's worst failure mode is not an outage — it is a bill. A loop
 * in a client, a leaked account, or simply more success than expected can run
 * up thousands of dollars against your provider keys before anyone looks at a
 * dashboard, and providers do not stop you.
 *
 * Two controls, deliberately separate:
 *
 *   AI_DISABLED=1          an immediate kill switch. No database round trip,
 *                          no way for it to fail open. This is what you set at
 *                          3am; it takes effect on the next request.
 *   AI_MONTHLY_BUDGET_USD  a soft ceiling on estimated spend for the current
 *                          calendar month, computed from the ai_requests log.
 *
 * Deliberate design decisions:
 *
 *   - **Unset budget means unlimited.** A default cap would silently break a
 *     working deployment on upgrade. The admin console says loudly when no cap
 *     is set, which is the honest way to handle it.
 *   - **The check fails OPEN when the database is unreachable.** This is the
 *     uncomfortable one. Failing closed would mean a Supabase blip takes the
 *     whole product down, and the exposure is bounded by the cache window
 *     below. The kill switch is the control that never fails open.
 *   - **Spend is cached for a minute.** Counting every request would add a
 *     database round trip to every generation to protect against an overspend
 *     that cannot move meaningfully in sixty seconds.
 *   - **Estimated, never billed.** These numbers come from token counts and a
 *     rate table, not from the provider's invoice. They are for stopping a
 *     runaway, not for accounting. Treat them as a smoke alarm.
 */
export const KILL_SWITCH_ENABLED = process.env.AI_DISABLED === '1';

export function monthlyBudgetUsd(): number | null {
  const raw = process.env.AI_MONTHLY_BUDGET_USD;
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface BudgetStatus {
  /** Estimated USD spent so far this calendar month. */
  spentUsd: number;
  /** The configured cap, or null when none is set. */
  budgetUsd: number | null;
  /** 0..1 of the cap consumed; 0 when there is no cap. */
  ratio: number;
  overBudget: boolean;
  killSwitch: boolean;
  /** True when the figure could not be computed (database unreachable). */
  unknown: boolean;
}

let cache: { at: number; spentUsd: number } | null = null;
const CACHE_MS = 60_000;

function startOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Estimated spend this calendar month, or null if it cannot be determined. */
export async function monthlySpendUsd(): Promise<number | null> {
  if (!isSupabaseAdminConfigured) return null;

  if (cache && Date.now() - cache.at < CACHE_MS) return cache.spentUsd;

  try {
    const { data, error } = await createAdminClient()
      .from('ai_requests')
      .select('model, prompt_tokens, completion_tokens')
      .gte('created_at', startOfMonth())
      // A cap on rows read, so one pathological month cannot turn this into a
      // full-table scan on every cache miss. At this ceiling the figure is an
      // under-count, which is why hitting it is logged: it means the cap can
      // no longer be trusted and the window needs shortening.
      .limit(50_000);

    if (error) return null;

    if (data && data.length >= 50_000) {
      log('warn', 'ai_budget', {
        outcome: 'failed',
        reason: 'row_cap_reached',
        note: 'monthly spend is an under-count; shorten the accounting window',
      });
    }

    const total = (data ?? []).reduce(
      (sum, row) =>
        sum +
        estimateCostUsd(
          row.model as string | null,
          row.prompt_tokens as number | null,
          row.completion_tokens as number | null
        ),
      0
    );

    cache = { at: Date.now(), spentUsd: total };
    return total;
  } catch {
    return null;
  }
}

export async function budgetStatus(): Promise<BudgetStatus> {
  const budgetUsd = monthlyBudgetUsd();
  const spent = await monthlySpendUsd();

  if (spent === null) {
    return {
      spentUsd: 0,
      budgetUsd,
      ratio: 0,
      // Fails open: an unreadable log must not take generation down. The kill
      // switch is the control that does not depend on the database.
      overBudget: false,
      killSwitch: KILL_SWITCH_ENABLED,
      unknown: true,
    };
  }

  return {
    spentUsd: spent,
    budgetUsd,
    ratio: budgetUsd ? spent / budgetUsd : 0,
    overBudget: budgetUsd !== null && spent >= budgetUsd,
    killSwitch: KILL_SWITCH_ENABLED,
    unknown: false,
  };
}

export interface BudgetBlock {
  blocked: true;
  reason: 'kill_switch' | 'over_budget';
  message: string;
}

/**
 * Called before dispatching an AI request. Returns null when the call may
 * proceed, or the reason it may not.
 */
export async function checkAiBudget(): Promise<BudgetBlock | null> {
  if (KILL_SWITCH_ENABLED) {
    log('warn', 'ai_budget', { outcome: 'failed', reason: 'kill_switch' });
    return {
      blocked: true,
      reason: 'kill_switch',
      message: 'AI generation is temporarily disabled. Please try again later.',
    };
  }

  const budgetUsd = monthlyBudgetUsd();
  if (budgetUsd === null) return null;

  const spent = await monthlySpendUsd();
  if (spent === null || spent < budgetUsd) return null;

  log('warn', 'ai_budget', {
    outcome: 'failed',
    reason: 'over_budget',
    spentUsd: Math.round(spent * 100) / 100,
    budgetUsd,
  });

  return {
    blocked: true,
    reason: 'over_budget',
    message: 'AI generation is paused for this month while we review capacity. Please try again later.',
  };
}

/** Test seam: clears the 60-second spend cache. */
export function resetBudgetCache(): void {
  cache = null;
}
