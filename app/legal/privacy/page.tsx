import { LegalPage } from '@/components/legal/legal-page';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="[date]">
      <p>
        This explains what data ufo collects, why, and who it&rsquo;s shared with. We collect the
        minimum needed to run the Service.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, hashed password (or OAuth identity) via Supabase Auth.</li>
        <li><strong>Project data:</strong> project names, descriptions, generated screens/code, and any URL, screenshot, or Figma link you submit for import &amp; redesign.</li>
        <li><strong>Billing data:</strong> plan, credit usage, and payment status. Card details are handled entirely by Paddle — we never see or store them.</li>
        <li><strong>Usage data:</strong> basic analytics (pages viewed, feature usage) to improve the product.</li>
      </ul>

      <h2>2. Who we share it with</h2>
      <ul>
        <li><strong>Google Gemini</strong> — receives your project description and any imported design source to generate screens. Subject to Google&rsquo;s API data-handling terms.</li>
        <li><strong>Supabase</strong> — hosts our database, authentication, and file storage.</li>
        <li><strong>Paddle</strong> — our Merchant of Record for billing; handles your payment details directly.</li>
        <li>We don&rsquo;t sell your data, and we don&rsquo;t share it with advertisers.</li>
      </ul>

      <h2>3. Public prototype links</h2>
      <p>
        If you publish a shareable prototype link, anyone with that link can view the screens and
        leave comments — that content is intentionally public once published. Unpublish it any
        time from the project page to make it private again.
      </p>

      <h2>4. Cookies</h2>
      <p>
        We use essential cookies for login sessions and optional analytics cookies — see our{' '}
        <a href="/legal/cookies">Cookie Policy</a> for details and how to opt out.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We keep your data while your account is active. If you delete your account (available
        from Settings), we delete your projects, screens, and personal data within 30 days,
        except where we&rsquo;re required to retain billing records for legal/tax purposes.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You can export a copy of your data or delete your account at any time from Settings. If
        you&rsquo;re in the EU/UK, you have rights under GDPR (access, correction, deletion,
        portability, objection) — contact us at [your contact email] for anything Settings
        doesn&rsquo;t cover directly.
      </p>

      <h2>7. Security</h2>
      <p>
        Data is encrypted in transit (TLS) and at rest (Supabase-managed encryption). Access to
        production data is limited to what&rsquo;s needed to operate the Service.
      </p>

      <h2>8. Changes</h2>
      <p>We&rsquo;ll post updates here and, for material changes, notify you by email.</p>
    </LegalPage>
  );
}
