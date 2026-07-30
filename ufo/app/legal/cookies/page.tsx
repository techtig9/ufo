import { LegalPage } from '@/components/legal/legal-page';

export const metadata = { title: 'Cookie Policy' };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updated="[date]">
      <p>ufo uses a small number of cookies and similar local storage:</p>

      <h2>Essential (always on)</h2>
      <ul>
        <li><strong>Supabase session cookies</strong> — keep you logged in.</li>
        <li><strong>Cookie consent choice</strong> — remembers your Accept/Reject decision so we don&rsquo;t ask every visit.</li>
      </ul>

      <h2>Optional (only if you accept)</h2>
      <ul>
        <li><strong>Analytics</strong> — anonymous usage data (pages viewed, feature usage) to help us improve the product. Configure your analytics provider&rsquo;s consent mode to actually gate these on the banner choice before launch.</li>
      </ul>

      <h2>Your choice</h2>
      <p>
        You can accept or reject optional cookies from the banner shown on your first visit, or
        clear your browser&rsquo;s local storage to reset that choice and see the banner again.
        Rejecting optional cookies doesn&rsquo;t affect core functionality — you can still sign
        up, generate designs, and use every feature.
      </p>
    </LegalPage>
  );
}
