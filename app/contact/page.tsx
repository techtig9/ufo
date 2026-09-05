import type { Metadata } from 'next';
import { companyValue } from '@/lib/company';
import { Nav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';
import { ContactForm } from '@/components/contact/contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the UFO team.',
};

/**
 * A server component, so the company contact address is read where the
 * environment variable actually exists — and so Nav and Footer stay server
 * components rather than being pulled into the client bundle by the form.
 * See ContactForm for what went wrong when they were not.
 */
export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <ContactForm contactEmail={companyValue('contactEmail')} />
      <Footer />
    </div>
  );
}
