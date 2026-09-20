import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAdminConfigured } from '@/lib/supabase/config';
import { readJson } from '@/lib/api/read-json';
import { log, reportError, withObservability } from '@/lib/observability';

/**
 * Operator credit grants.
 *
 * Granting credits is the one place in this product where an employee can
 * create value from nothing, so the controls are deliberately tighter than
 * elsewhere:
 *
 *  - the caller's admin role is re-checked HERE, from their own session, not
 *    inherited from the middleware. Middleware protects the /admin pages; an
 *    API route must not assume a request reached it through one.
 *  - a reason is REQUIRED. An audit trail of grants with no reasons answers
 *    "what happened" and not "why", which is the question actually asked later.
 *  - the amount is bounded. A slipped keystroke should not be able to mint a
 *    million credits, and a genuinely larger grant is rare enough to be worth
 *    two requests.
 *  - the grant and the audit row are written before the response returns, so a
 *    grant cannot succeed while its record quietly fails.
 */
const MAX_GRANT = 100_000;

const grantSchema = z.object({
  userId: z.string().uuid(),
  // Negative is allowed on purpose: correcting an over-grant is the same kind
  // of action and should leave the same trail, not be done by hand in SQL.
  amount: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= MAX_GRANT, {
    message: `amount must be non-zero and at most ${MAX_GRANT}`,
  }),
  reason: z.string().trim().min(3).max(500),
});

async function handler(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ error: 'Not configured on this deployment.' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data: actor } = await admin.from('users').select('role').eq('id', user.id).maybeSingle();
  if (actor?.role !== 'admin') {
    // Logged: a non-admin reaching an admin endpoint is worth seeing, whether
    // it is a bug or someone probing.
    log('warn', 'admin', { outcome: 'failed', reason: 'not_admin', userId: user.id });
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  }

  const parsed = await readJson(request, grantSchema);
  if (!parsed.ok) return parsed.response;
  const { userId, amount, reason } = parsed.data;

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('credits_remaining')
    .eq('user_id', userId)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ error: 'That user has no subscription row.' }, { status: 404 });
  }

  // Clamped at zero: a correction larger than the balance should empty it, not
  // leave a negative balance that every downstream check has to special-case.
  const next = Math.max(0, (subscription.credits_remaining ?? 0) + amount);

  const { error: updateError } = await admin
    .from('subscriptions')
    .update({ credits_remaining: next })
    .eq('user_id', userId);

  if (updateError) {
    reportError(updateError, 'admin', { actorId: user.id, targetUserId: userId });
    return NextResponse.json({ error: 'Could not apply the grant.' }, { status: 500 });
  }

  const { error: auditError } = await admin.from('admin_actions').insert({
    actor_id: user.id,
    action: 'grant_credits',
    target_user_id: userId,
    detail: { amount, balanceAfter: next },
    reason,
  });

  if (auditError) {
    // The grant already landed. Rolling it back could fail too, and a silent
    // rollback is its own surprise — so this is loud instead: the operator is
    // told the trail is incomplete and can record it deliberately.
    reportError(auditError, 'admin', { actorId: user.id, targetUserId: userId, amount });
    return NextResponse.json(
      {
        error:
          'The credits were granted, but the audit record failed to save. Note this manually.',
        balanceAfter: next,
      },
      { status: 500 }
    );
  }

  log('info', 'admin', { outcome: 'ok', action: 'grant_credits', actorId: user.id, targetUserId: userId, amount });
  return NextResponse.json({ ok: true, balanceAfter: next });
}

export const POST = withObservability('admin-credits', handler);
