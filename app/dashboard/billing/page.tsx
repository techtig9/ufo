import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { PaddleCheckoutButton } from '@/components/dashboard/paddle-checkout-button';
import { PlanPicker } from '@/components/dashboard/plan-picker';
import type { BillingPeriod } from '@/lib/credits';
import type { Plan } from '@/lib/types';
import { CancelSubscriptionButton } from '@/components/dashboard/cancel-subscription-button';

// Read on the server, so one list decides what is configured and the picker
// can name the exact missing variable for the period being viewed.
const PLAN_PRICE_IDS: Record<BillingPeriod, Partial<Record<Plan, string>>> = {
  monthly: {
    starter: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER,
    pro: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO,
    business: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS,
  },
  yearly: {
    starter: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_YEARLY,
    pro: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_YEARLY,
    business: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS_YEARLY,
  },
};

const TOPUPS = [
  { label: '1,000 credits \u2014 $6', priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_TOPUP_1000 },
  { label: '5,000 credits \u2014 $27', priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_TOPUP_5000 },
  { label: '10,000 credits \u2014 $50', priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_TOPUP_10000 },
];

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, credits_remaining, renews_at, status')
    .eq('user_id', user!.id)
    .single();

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4">
      <h1 className="font-display text-2xl font-semibold">Billing</h1>

      <Panel hover={false}>
        <p className="text-sm text-fg-muted">Current plan</p>
        <p className="mt-1 text-xl font-medium capitalize">{subscription?.plan ?? 'free'}</p>
        <p className="mt-2 text-sm text-fg-faint">
          {subscription?.credits_remaining?.toLocaleString() ?? 0} credits remaining this cycle
          {subscription?.renews_at ? ` \u00b7 renews ${new Date(subscription.renews_at).toLocaleDateString()}` : ''}
        </p>
        {subscription?.plan && subscription.plan !== 'free' && (
          <div className="mt-4">
            <CancelSubscriptionButton />
          </div>
        )}
      </Panel>

      <div>
        <h2 className="mb-4 text-lg font-medium">Plans</h2>
        <PlanPicker
          priceIds={PLAN_PRICE_IDS}
          currentPlan={(subscription?.plan ?? null) as Plan | null}
          userId={user!.id}
          userEmail={user!.email!}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Credit top-ups</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TOPUPS.map((t) => (
            <Panel key={t.label} className="flex items-center justify-between">
              <span className="text-sm">{t.label}</span>
              {t.priceId ? (
                <PaddleCheckoutButton
                  priceId={t.priceId}
                  userId={user!.id}
                  userEmail={user!.email!}
                  label="Buy"
                  variant="secondary"
                />
              ) : (
                <span className="text-xs text-fg-faint">Not configured</span>
              )}
            </Panel>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium">Payment history</h2>
        {!payments?.length ? (
          <EmptyState title="No payments yet" description="Your payment history will show up here." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-edge bg-[#111218]">
            <div className="grid grid-cols-[1.2fr_.8fr_.8fr_.8fr] gap-4 border-b border-edge px-4 py-3 text-xs font-medium text-fg-faint">
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Transaction</span>
            </div>
            {payments.map((payment) => (
              <div key={payment.id} className="grid grid-cols-[1.2fr_.8fr_.8fr_.8fr] gap-4 border-b border-edge px-4 py-3 text-sm last:border-0">
                <span className="text-fg-secondary">{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</span>
                <span className="text-fg-secondary">
                  {payment.amount != null ? `$${Number(payment.amount).toFixed(2)}` : '—'}
                </span>
                <span className="capitalize text-fg-muted">{payment.status ?? '—'}</span>
                <span className="truncate text-fg-faint" title={payment.paddle_transaction_id ?? undefined}>
                  {payment.paddle_transaction_id ?? '—'}
                </span>
              </div>
            ))}
          </div>
        )}      </div>
    </div>
  );
}
