import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { AIDemo } from '@/components/landing/ai-demo';
import { Templates } from '@/components/landing/templates';
import { PricingSection } from '@/components/landing/pricing-section';
import { FAQ } from '@/components/landing/faq';
import { FAQS } from '@/lib/faq';
import { Help } from '@/components/landing/help';
import { About } from '@/components/landing/about';
import { Footer } from '@/components/landing/footer';
import { PLAN_CARDS } from '@/lib/plan-features';
import { ANNUAL_MONTHS_CHARGED, PLAN_PRICE_USD_YEARLY } from '@/lib/credits';
import type { Metadata } from 'next';

// Title and description are inherited from app/layout.tsx; only the
// canonical is page-specific.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};


function StructuredData() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ufo',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    description:
      'ufo turns a plain-language description into a complete, clickable multi-screen UI/UX prototype in minutes.',
    // Both billing periods, because both are purchasable. Listing only the
    // monthly price while the page offers a cheaper annual one understates the
    // product in every rich result that quotes a "from" price.
    offers: PLAN_CARDS.filter((c) => c.plan !== 'free').flatMap((c) => [
      {
        '@type': 'Offer',
        name: `${c.label} (monthly)`,
        price: c.price,
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: c.price,
          priceCurrency: 'USD',
          billingDuration: 'P1M',
        },
      },
      {
        '@type': 'Offer',
        name: `${c.label} (yearly — ${ANNUAL_MONTHS_CHARGED} months charged)`,
        price: PLAN_PRICE_USD_YEARLY[c.plan],
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: PLAN_PRICE_USD_YEARLY[c.plan],
          priceCurrency: 'USD',
          billingDuration: 'P1Y',
        },
      },
    ]),
  };

  // FAQPage, built from the same FAQS array the page renders. Structured data
  // that does not match the visible page is a manual-action risk, so there is
  // deliberately no second copy of these answers.
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify of an object we construct ourselves — no user input
        // reaches this, and JSON-LD has to be injected as raw script content.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
    </>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <StructuredData />
      <Nav />
      <main>
        <Hero />
        <Features />
        <AIDemo />
        <Templates />
        <PricingSection />
        <FAQ />
        <Help />
        <About />
      </main>
      <Footer />
    </div>
  );
}
