import { createAdminClient } from './supabase/admin';
import type { CreditAction } from './credits';

/**
 * Server-side credit movement.
 *
 * Both AI routes previously did a read-modify-write:
 *
 *     const newBalance = subscription.credits_remaining - cost;
 *     await admin.from('subscriptions').update({ credits_remaining: newBalance })
 *
 * Two concurrent generations read the same balance and both write
 * `balance - cost`, so the user is charged once for two generations. A
 * concurrency test (supabase/tests/concurrency_test.sh) reproduces it: ten
 * simultaneous charges of 100 against a balance of 1000 leave 900, not 0.
 *
 * These wrap the Postgres functions from migration 008, where the guard lives
 * in the UPDATE itself and concurrent callers serialise on the row lock.
 *
 * Order matters: reserve BEFORE the work, refund if the work fails. Charging
 * only on success looks simpler, but under concurrency two requests can both
 * pass the affordability check and both generate before either writes, so one
 * generation is free.
 */

export interface CreditResult {
  ok: boolean;
  creditsRemaining: number;
}

/** Atomically charges `amount`. Returns ok:false if the balance cannot cover it. */
export async function reserveCredits(
  userId: string,
  amount: number,
  action: CreditAction,
  requestId: string
): Promise<CreditResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('reserve_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_action: action,
    p_request_id: requestId,
  });

  if (error) {
    console.error('[credits] reserve failed', error.message);
    return { ok: false, creditsRemaining: 0 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: !!row?.out_success,
    creditsRemaining: row?.out_credits_remaining ?? 0,
  };
}

/**
 * Returns credits reserved for work that then failed.
 *
 * Idempotent per (requestId, action) in SQL, so a caller that retries a refund
 * — or a route that hits two failure paths — cannot hand back credits twice.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  action: CreditAction,
  requestId: string,
  reason: string
): Promise<CreditResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('refund_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_action: action,
    p_request_id: requestId,
    p_reason: reason,
  });

  if (error) {
    // A failed refund must be loud: the user has been charged for work they
    // did not receive, and only the ledger will show it.
    console.error('[credits] REFUND FAILED — user was charged for failed work', {
      userId,
      amount,
      action,
      requestId,
      error: error.message,
    });
    return { ok: false, creditsRemaining: 0 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: !!row?.out_success,
    creditsRemaining: row?.out_credits_remaining ?? 0,
  };
}
