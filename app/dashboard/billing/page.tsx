import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { PLAN_CARDS } from '@/lib/plan-features';
import { PaddleCheckoutButton } from '@/components/dashboard/paddle-checkout-button';
import { CancelSubscriptionButton } from '@/components/dashboard/cancel-subscription-button';

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER,
  pro: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO,
  business: process.env.NEXT_PUBLIC_PADDLE_PRICE_BUSINESS,
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
        <p className="text-sm text-white/60">Current plan</p>
        <p className="mt-1 text-xl font-medium capitalize">{subscription?.plan ?? 'free'}</p>
        <p className="mt-2 text-sm text-white/40">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_CARDS.map((card) => {
            const isCurrent = subscription?.plan === card.plan;
            const priceId = PLAN_PRICE_IDS[card.plan];
            return (
              <Panel key={card.plan}>
                <h3 className="font-medium">{card.label}</h3>
                <p className="mt-1 text-2xl font-semibold">${card.price}<span className="text-sm text-white/40">/mo</span></p>
                <p className="mt-1 text-xs text-white/40">{card.credits.toLocaleString()} credits</p>
                <div className="mt-4">
                  {isCurrent ? (
                    <span className="text-xs text-studio-coral">Current plan</span>
                  ) : card.plan === 'free' ? (
                    <span className="text-xs text-white/30">Cancel above to move to Free</span>
                  ) : priceId ? (
                    <PaddleCheckoutButton
                      priceId={priceId}
                      userId={user!.id}
                      userEmail={user!.email!}
                      label={`Choose ${card.label}`}
                    />
                  ) : (
                    <span className="text-xs text-white/30">Set NEXT_PUBLIC_PADDLE_PRICE_{card.plan.toUpperCase()}</span>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
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
                <span className="text-xs text-white/30">Not configured</span>
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
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111218]">
            <div className="grid grid-cols-[1.2fr_.8fr_.8fr_.8fr] gap-4 border-b border-white/[0.08] px-4 py-3 text-xs font-medium text-white/40">
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Transaction</span>
            </div>
            {payments.map((payment) => (
              <div key={payment.id} className="grid grid-cols-[1.2fr_.8fr_.8fr_.8fr] gap-4 border-b border-white/[0.06] px-4 py-3 text-sm last:border-0">
                <span className="text-white/70">{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</span>
                <span className="text-white/70">
                  {payment.amount != null ? `$${Number(payment.amount).toFixed(2)}` : '—'}
                </span>
                <span className="capitalize text-white/60">{payment.status ?? '—'}</span>
                <span className="truncate text-white/40" title={payment.paddle_transaction_id ?? undefined}>
                  {payment.paddle_transaction_id ?? '—'}
                </span>
              </div>
            ))}
          </div>
        )}      </div>
    </div>
  );
}
