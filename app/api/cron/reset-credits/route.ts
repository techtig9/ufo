import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Fail closed. Previously the comparison was against
  // `Bearer ${process.env.CRON_SECRET}`, so with the variable unset a request
  // sending the literal string "Bearer undefined" authenticated and could
  // reset every user's credit balance.
  if (!secret) {
    console.error('[cron] CRON_SECRET is not configured — refusing to run.');
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  // Constant-time compare so the secret cannot be recovered byte-by-byte from
  // response timing.
  const provided = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  const authorized =
    provided.length === expectedBuf.length && timingSafeEqual(provided, expectedBuf);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const { data: due, error } = await admin
    .from('subscriptions')
    .select('id, plan')
    .lte('credits_reset_at', cutoff)
    .limit(500); // one page per run; a daily cron catches up fine at this scale

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!due?.length) {
    return NextResponse.json({ reset: 0 });
  }

  let resetCount = 0;
  for (const sub of due) {
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({
        credits_remaining: PLAN_MONTHLY_CREDITS[sub.plan as keyof typeof PLAN_MONTHLY_CREDITS],
        credits_reset_at: new Date().toISOString(),
      })
      .eq('id', sub.id);
    if (!updateError) resetCount++;
  }

  return NextResponse.json({ reset: resetCount, checked: due.length });
}
