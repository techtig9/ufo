import Link from 'next/link';
import { Nav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';
import { GridField } from '@/components/ui/grid-field';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';

const FAQS = [
  {
    q: 'What does ufo actually generate?',
    a: 'A full, linked, multi-screen clickable prototype from a plain-language description — real HTML and Tailwind you can view, edit, and export. It\u2019s a prototype you share via a link, not a live website hosted on your own domain.',
  },
  {
    q: 'How do credits work?',
    a: 'Generating a new project and applying an AI edit both use credits from your plan\u2019s monthly allowance. Your current balance and this cycle\u2019s usage are always visible on your Dashboard and Billing page.',
  },
  {
    q: 'Can I edit what the AI generates?',
    a: 'Yes, two ways: ask the AI Designer to make a specific change, or edit the HTML directly in the built-in code editor. Every save creates a version you can restore later.',
  },
  {
    q: 'What does "Publish" do?',
    a: 'It turns on a shareable link (with its own QR code) that anyone with the URL can view and leave feedback on. Unpublishing takes the link down without deleting your project.',
  },
  {
    q: 'What\u2019s in the ZIP export?',
    a: 'Each screen as a standalone HTML file, a PNG snapshot of each screen, and a style-guide.md with your project\u2019s color and typography tokens. Available on Starter plans and above.',
  },
  {
    q: 'Is Figma export available?',
    a: 'No. It is marked \u201cnot available\u201d wherever it appears, and the button is disabled rather than failing when clicked. We don\u2019t enable controls for features that aren\u2019t built, and we won\u2019t promise a date we can\u2019t keep.',
  },
  {
    q: 'Can I use a starter template instead of describing my project?',
    a: 'Yes \u2014 Templates in the dashboard creates a new project from a ready-made starting point at no credit cost, which you can then edit like any generated project.',
  },
  {
    q: 'How do I delete my account or export my data?',
    a: 'Both are in Settings \u2192 Danger zone: a full data export, and account deletion (which also cancels any active subscription).',
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="relative mx-auto max-w-3xl px-6 py-16">
        <GridField strength="subtle" />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-wider text-brand-text">Support</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Help &amp; FAQs</h1>
          <p className="mt-3 text-fg-muted">Answers to the most common questions. Can&rsquo;t find what you need? Reach out directly.</p>

          <div className="mt-10 space-y-3">
            {FAQS.map((item) => (
              <Panel key={item.q} hover={false} className="p-0">
                <details className="group p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-fg-secondary marker:content-none">
                    {item.q}
                    <span className="shrink-0 text-fg-faint transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-fg-muted">{item.a}</p>
                </details>
              </Panel>
            ))}
          </div>

          <Panel hover={false} className="mt-10 text-center">
            <p className="text-sm text-fg-muted">Still stuck? We reply to every message.</p>
            <Link href="/contact" className="mt-4 inline-block">
              <Button variant="secondary">Contact support</Button>
            </Link>
          </Panel>
        </div>
      </main>
      <Footer />
    </div>
  );
}
