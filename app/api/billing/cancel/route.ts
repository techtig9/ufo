import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelPaddleSubscription } from '@/lib/paddle-api';

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('paddle_subscription_id, plan')
    .eq('user_id', user.id)
    .single();

  if (!subscription?.paddle_subscription_id || subscription.plan === 'free') {
    return NextResponse.json({ error: 'No active paid subscription to cancel' }, { status: 400 });
  }

  const ok = await cancelPaddleSubscription(subscription.paddle_subscription_id);
  if (!ok) {
    return NextResponse.json(
      { error: 'Could not reach the billing provider — please try again or contact support.' },
      { status: 502 }
    );
  }

  // Paddle's `subscription.canceled` webhook (already handled in
  // app/api/webhooks/paddle/route.ts) flips plan/credits to free — don't
  // duplicate that write here, or the two can race.
  return NextResponse.json({ ok: true });
}
