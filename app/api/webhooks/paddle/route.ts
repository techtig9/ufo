import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPaddleSignature, PADDLE_PRICE_TO_PLAN } from '@/lib/paddle';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import { sendPaymentFailedEmail, sendSubscriptionCanceledEmail } from '@/lib/email';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('Paddle-Signature');

  if (!verifyPaddleSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const admin = createAdminClient();

  switch (event.event_type) {
    case 'subscription.created':
    case 'subscription.updated': {
      const data = event.data;
      const priceId: string | undefined = data.items?.[0]?.price?.id;
      const plan = priceId ? PADDLE_PRICE_TO_PLAN[priceId] : undefined;
      const userId: string | undefined = data.custom_data?.user_id;

      if (userId && plan) {
        await admin
          .from('subscriptions')
          .update({
            plan,
            status: data.status,
            paddle_subscription_id: data.id,
            paddle_customer_id: data.customer_id,
            credits_remaining: PLAN_MONTHLY_CREDITS[plan],
            credits_reset_at: new Date().toISOString(),
            renews_at: data.next_billed_at ?? null,
          })
          .eq('user_id', userId);
        await admin.from('request_log').insert({ user_id: userId, route: 'paddle.subscription_updated', meta: { plan } });
      }
      break;
    }

    case 'subscription.canceled': {
      const userId: string | undefined = event.data.custom_data?.user_id;
      if (userId) {
        await admin
          .from('subscriptions')
          .update({ status: 'canceled', plan: 'free', credits_remaining: PLAN_MONTHLY_CREDITS.free })
          .eq('user_id', userId);

        const { data: userRow } = await admin.from('users').select('email').eq('id', userId).single();
        if (userRow?.email) await sendSubscriptionCanceledEmail(userRow.email);
        await admin.from('request_log').insert({ user_id: userId, route: 'paddle.subscription_canceled' });
      }
      break;
    }

    case 'transaction.completed': {
      const data = event.data;
      const userId: string | undefined = data.custom_data?.user_id;
      if (userId) {
        await admin.from('payments').insert({
          user_id: userId,
          paddle_transaction_id: data.id,
          amount: Number(data.details?.totals?.total ?? 0) / 100,
          status: 'completed',
        });
      }
      break;
    }

    case 'transaction.payment_failed': {
      const data = event.data;
      const userId: string | undefined = data.custom_data?.user_id;
      if (userId) {
        await admin.from('payments').insert({
          user_id: userId,
          paddle_transaction_id: data.id,
          amount: Number(data.details?.totals?.total ?? 0) / 100,
          status: 'failed',
        });

        const { data: userRow } = await admin.from('users').select('email').eq('id', userId).single();
        if (userRow?.email) await sendPaymentFailedEmail(userRow.email);
        await admin.from('request_log').insert({ user_id: userId, route: 'paddle.payment_failed' });
      }
      break;
    }

    default:
      break; // ignore events we don't act on
  }

  return NextResponse.json({ received: true });
}
