import { LegalPage } from '@/components/legal/legal-page';
import { companyValue } from '@/lib/company';

export const metadata = { title: 'Cookie Policy' };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated={companyValue('legalEffectiveDate')}>
      <p>ufo uses a small number of cookies and similar local storage:</p>

      <h2>Essential (always on)</h2>
      <ul>
        <li><strong>Supabase session cookies</strong> — keep you logged in.</li>
        <li><strong>Cookie consent choice</strong> — remembers your Accept/Reject decision so we don&rsquo;t ask every visit.</li>
      </ul>

      <ul>
        <li><strong>Theme preference</strong> — remembers light or dark mode.</li>
        <li><strong>Prototype link access</strong> — after you enter the password for a protected prototype, a short-lived cookie remembers that for six hours so you are not asked again on every screen.</li>
      </ul>

      <h2>Optional cookies</h2>
      <p>
        We do not currently set any. UFO uses no advertising cookies and no third-party
        analytics. Prototype view counts are recorded on our own servers and store nothing that
        identifies a viewer, so they need no cookie and are unaffected by your choice below. If
        that ever changes, this page and the banner will say so first.
      </p>

      <h2>Your choice</h2>
      <p>
        The banner on your first visit records your decision about optional cookies. Since there
        are none today, rejecting changes nothing about how UFO behaves — the choice is stored so
        that it already applies if optional cookies are ever introduced. Clear your
        browser&rsquo;s local storage to reset it and see the banner again.
      </p>
    </LegalPage>
  );
}
