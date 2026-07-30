import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { AIDemo } from '@/components/landing/ai-demo';
import { Templates } from '@/components/landing/templates';
import { PricingSection } from '@/components/landing/pricing-section';
import { FAQ } from '@/components/landing/faq';
import { Help } from '@/components/landing/help';
import { About } from '@/components/landing/about';
import { Footer } from '@/components/landing/footer';
import { PLAN_CARDS } from '@/lib/plan-features';

function StructuredData() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ufo',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    description:
      'ufo turns a plain-language description into a complete, clickable multi-screen UI/UX prototype in minutes.',
    offers: PLAN_CARDS.filter((c) => c.plan !== 'free').map((c) => ({
      '@type': 'Offer',
      name: c.label,
      price: c.price,
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: c.price,
        priceCurrency: 'USD',
        billingDuration: 'P1M',
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
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
