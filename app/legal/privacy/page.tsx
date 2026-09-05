import { aiProviderSentence, INFRASTRUCTURE_SUBPROCESSORS } from '@/lib/subprocessors';
import { LegalPage } from '@/components/legal/legal-page';
import { companyValue } from '@/lib/company';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={companyValue('legalEffectiveDate')}>
      <p>
        This explains what data ufo collects, why, and who it&rsquo;s shared with. We collect the
        minimum needed to run the Service.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, hashed password (or OAuth identity) via Supabase Auth.</li>
        <li><strong>Project data:</strong> project names, descriptions, generated screens/code, and any URL, screenshot, or Figma link you submit for import &amp; redesign.</li>
        <li><strong>Billing data:</strong> plan, credit usage, and payment status. Card details are handled entirely by Paddle — we never see or store them.</li>
        <li><strong>Prototype view counts:</strong> when someone opens a published prototype link we record the time, a coarse device type (mobile/tablet/desktop) and the referring site&rsquo;s hostname, so the project&rsquo;s owner can see whether it is being looked at. We do not store IP addresses, browser fingerprints, or any identifier that would let us tell one viewer from another, and this needs no cookie.</li>
      </ul>

      <h2>2. Who we share it with</h2>
      <ul>
        <li>
          <strong>AI model providers</strong> — your project description, and any design source
          you import, are sent to {aiProviderSentence()} to generate screens. A given request
          goes to one of them: the first that is available. Each is subject to its own API
          data-handling terms.
        </li>
        {INFRASTRUCTURE_SUBPROCESSORS.map((entry) => (
          <li key={entry.name}>
            <strong>{entry.name}</strong> — {entry.purpose}.
          </li>
        ))}
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
        We use cookies to keep you signed in, to remember your theme preference and cookie
        choice, and to remember that you have entered the password for a protected prototype
        link. We do not use advertising or third-party analytics cookies. See our{' '}
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
        portability, objection) — contact us at {companyValue('contactEmail')} for anything Settings
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
