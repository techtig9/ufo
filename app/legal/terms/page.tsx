import { LegalPage } from '@/components/legal/legal-page';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="[date]">
      <p>
        These Terms govern your use of ufo (&ldquo;the Service&rdquo;), operated by [Your Name /
        Company Legal Name] (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account, you agree
        to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        ufo generates UI/UX designs and clickable prototypes from a description you provide,
        using AI models (currently Google Gemini) to do so. You&rsquo;re responsible for the
        descriptions and content you submit, and for reviewing generated output before relying
        on it commercially.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must provide a valid email and keep your credentials secure. You&rsquo;re
        responsible for all activity under your account. Tell us immediately at [your contact
        email] if you suspect unauthorized access.
      </p>

      <h2>3. Plans, credits &amp; billing</h2>
      <ul>
        <li>Subscriptions renew automatically each billing cycle until canceled.</li>
        <li>Credits included with your plan reset each cycle and don&rsquo;t roll over.</li>
        <li>Prices and credit costs may change; we&rsquo;ll give notice before a change affects an active subscription.</li>
        <li>Payment is processed by Paddle, our Merchant of Record — see their terms for payment-processing specifics.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>
        Don&rsquo;t use ufo to generate content that&rsquo;s illegal, infringing, or intended to
        deceive; don&rsquo;t attempt to bypass credit limits, rate limits, or abuse the generation
        API programmatically; don&rsquo;t reverse-engineer or resell access to the Service without
        our written consent.
      </p>

      <h2>5. Your content &amp; our output</h2>
      <p>
        You own the projects, descriptions, and screens you create. We don&rsquo;t claim
        ownership of your generated designs. You grant us a limited license to store and process
        your content solely to provide the Service.
      </p>

      <h2>6. Third-party AI processing</h2>
      <p>
        Generating a design sends your description and any imported design source to Google
        Gemini for processing. Don&rsquo;t submit content you don&rsquo;t have the right to share
        with a third-party AI provider.
      </p>

      <h2>7. Termination</h2>
      <p>
        You can cancel anytime from Billing. We may suspend or terminate accounts that violate
        these Terms, engage in abuse, or fail payment after reasonable notice.
      </p>

      <h2>8. Disclaimers &amp; liability</h2>
      <p>
        The Service is provided &ldquo;as is.&rdquo; AI-generated output may contain errors —
        review it before shipping to production or clients. To the extent permitted by law, our
        liability is limited to the amount you paid us in the 12 months before a claim.
      </p>

      <h2>9. Changes</h2>
      <p>We may update these Terms; continued use after a change means you accept the update.</p>

      <h2>10. Governing law</h2>
      <p>These Terms are governed by the laws of [your jurisdiction].</p>
    </LegalPage>
  );
}
