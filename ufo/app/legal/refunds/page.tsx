import { LegalPage } from '@/components/legal/legal-page';

export const metadata = { title: 'Refund Policy' };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" updated="[date]">
      <h2>Subscriptions</h2>
      <p>
        We offer a [7-day] money-back guarantee on a customer&rsquo;s first paid subscription
        payment on any plan — email [your contact email] within that window and we&rsquo;ll
        refund it in full, no questions asked. After that window, subscription payments are
        non-refundable for the current billing period, but you can cancel anytime to stop future
        renewals — you keep access through the end of the period you&rsquo;ve already paid for.
      </p>

      <h2>Credit top-ups</h2>
      <p>
        Credit top-up packs are non-refundable once purchased, since credits are typically spent
        immediately. If a generation fails on our end, credits for that failed request are
        refunded automatically (see Credit Rules in our build documentation) — that&rsquo;s
        separate from a cash refund.
      </p>

      <h2>Failed or duplicate charges</h2>
      <p>
        If you&rsquo;re charged in error — a duplicate charge, a charge after cancellation, or a
        processing mistake — contact us at [your contact email] and we&rsquo;ll correct it.
      </p>

      <h2>How refunds are processed</h2>
      <p>
        Refunds are issued through Paddle, our Merchant of Record, back to your original payment
        method. Processing typically takes 5&ndash;10 business days depending on your bank or
        card issuer.
      </p>

      <h2>Chargebacks</h2>
      <p>
        Please contact us before filing a chargeback with your bank — we can usually resolve
        billing issues faster directly, and chargebacks may result in account suspension while
        the dispute is reviewed.
      </p>
    </LegalPage>
  );
}
