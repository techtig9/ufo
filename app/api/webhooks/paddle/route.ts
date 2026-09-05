import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPaddleSignature, PADDLE_PRICE_TO_PLAN } from '@/lib/paddle';
import { PLAN_MONTHLY_CREDITS } from '@/lib/credits';
import { sendPaymentFailedEmail, sendSubscriptionCanceledEmail } from '@/lib/email';
import { withObservability } from '@/lib/observability';

/**
 * Paddle Billing webhook.
 *
 * Idempotency (Master Command 2.E) is the substantive change here. Paddle
 * retries webhooks on any non-2xx and on timeouts, and
 * `subscription.created`/`updated` unconditionally reset credits_remaining to
 * the plan total — so a retry part-way through a billing cycle silently
 * refilled a user's credits for free. Every event id is now claimed in
 * webhook_events (UNIQUE on provider+event_id, migration 007) before it is
 * acted on; a replay loses the race to insert and is skipped.
 *
 * The claim happens BEFORE processing rather than after, so a duplicate
 * delivered while the first is still in flight is also rejected. The trade-off
 * is that a crash mid-processing leaves the event claimed but unapplied; that
 * is the safer direction for money (a missed credit top-up is visible and
 * fixable, a doubled one is not), and the row is there to reconcile from.
 */
async function handlePOST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('Paddle-Signature');

  if (!verifyPaddleSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: {
    event_id?: string;
    event_type?: string;
    data?: Record<string, unknown>;
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    // Signature verified but body unparseable: do not ask Paddle to retry, it
    // will only fail identically.
    console.error('[paddle] signature valid but body was not JSON');
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  const admin = createAdminClient();
  const eventId = event.event_id;
  const eventType = event.event_type;

  if (!eventId) {
    console.error('[paddle] event has no event_id — cannot deduplicate', { eventType });
    return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });
  }

  // Claim the event. A duplicate delivery collides on the UNIQUE constraint.
  const { error: claimError } = await admin
    .from('webhook_events')
    .insert({ provider: 'paddle', event_id: eventId, event_type: eventType ?? null });

  if (claimError) {
    if (claimError.code === '23505') {
      // Already processed. 200 so Paddle stops retrying.
      console.log(JSON.stringify({ scope: 'paddle', eventId, eventType, outcome: 'duplicate_skipped' }));
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Could not record the claim — fail loudly so Paddle retries rather than
    // processing an event we cannot deduplicate.
    console.error('[paddle] could not claim event', claimError.message);
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  }

  const data = (event.data ?? {}) as Record<string, never>;
  const customData = (data as { custom_data?: { user_id?: string } }).custom_data;
  const userId = customData?.user_id;

  switch (eventType) {
    case 'subscription.created':
    case 'subscription.updated': {
      const d = data as unknown as {
        id?: string;
        status?: string;
        customer_id?: string;
        next_billed_at?: string;
        items?: { price?: { id?: string } }[];
      };
      const priceId = d.items?.[0]?.price?.id;
      const plan = priceId ? PADDLE_PRICE_TO_PLAN[priceId] : undefined;

      if (!userId || !plan) {
        // Never trust the client to grant a paid plan: without a user id from
        // custom_data and a price id we recognise, there is nothing safe to do.
        console.error('[paddle] subscription event missing user_id or unknown price', {
          eventId,
          hasUserId: !!userId,
          priceId,
        });
        break;
      }

      await admin
        .from('subscriptions')
        .update({
          plan,
          status: d.status,
          paddle_subscription_id: d.id,
          paddle_customer_id: d.customer_id,
          credits_remaining: PLAN_MONTHLY_CREDITS[plan],
          credits_reset_at: new Date().toISOString(),
          renews_at: d.next_billed_at ?? null,
        })
        .eq('user_id', userId);

      await admin.from('request_log').insert({
        user_id: userId,
        route: 'paddle.subscription_updated',
        meta: { plan, eventId },
      });
      break;
    }

    case 'subscription.canceled': {
      if (!userId) break;
      await admin
        .from('subscriptions')
        .update({
          status: 'canceled',
          plan: 'free',
          credits_remaining: PLAN_MONTHLY_CREDITS.free,
        })
        .eq('user_id', userId);

      const { data: userRow } = await admin.from('users').select('email').eq('id', userId).maybeSingle();
      if (userRow?.email) await sendSubscriptionCanceledEmail(userRow.email, userId);

      await admin.from('request_log').insert({
        user_id: userId,
        route: 'paddle.subscription_canceled',
        meta: { eventId },
      });
      break;
    }

    case 'transaction.completed': {
      if (!userId) break;
      const d = data as unknown as { id?: string; details?: { totals?: { total?: string } } };
      await admin.from('payments').insert({
        user_id: userId,
        paddle_transaction_id: d.id,
        amount: Number(d.details?.totals?.total ?? 0) / 100,
        status: 'completed',
      });
      break;
    }

    case 'transaction.payment_failed': {
      if (!userId) break;
      const d = data as unknown as { id?: string; details?: { totals?: { total?: string } } };
      await admin.from('payments').insert({
        user_id: userId,
        paddle_transaction_id: d.id,
        amount: Number(d.details?.totals?.total ?? 0) / 100,
        status: 'failed',
      });

      const { data: userRow } = await admin.from('users').select('email').eq('id', userId).maybeSingle();
      if (userRow?.email) await sendPaymentFailedEmail(userRow.email, userId);

      await admin.from('request_log').insert({
        user_id: userId,
        route: 'paddle.payment_failed',
        meta: { eventId },
      });
      break;
    }

    default:
      break; // events we deliberately do not act on
  }

  console.log(JSON.stringify({ scope: 'paddle', eventId, eventType, outcome: 'processed' }));
  return NextResponse.json({ received: true });
}

/**
 * Wrapped for observability: each request gets a correlation id (honouring an
 * upstream `x-request-id`), is timed and logged with its status, and a thrown
 * error becomes a 500 carrying only that id — never the exception's message,
 * which can contain a connection string or schema detail.
 */
export const POST = withObservability('webhook.paddle', handlePOST);
