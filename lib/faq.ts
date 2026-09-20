/**
 * The FAQ content, in a plain module rather than inside the client component
 * that renders it.
 *
 * app/page.tsx emits FAQPage structured data from this same array, and a
 * server component importing from a 'use client' module gets the client
 * reference, not the value — the build caught it as "FAQS.map is not a
 * function" during prerender. Two copies of the answers would also drift, and
 * structured data that does not match the visible page is a manual-action
 * risk with Google.
 */
export interface FaqEntry {
  q: string;
  a: string;
}

export const FAQS: FaqEntry[] = [
  {
    q: 'Does it export real code, or just images?',
    a: 'Real HTML + Tailwind CSS per screen, plus PNG snapshots and a generated style guide — the ZIP export opens directly in a browser with no missing assets.',
  },
  {
    q: 'What happens to unused credits?',
    a: 'They expire at the end of each billing cycle and don\u2019t roll over. You can buy top-up packs any time if you run out mid-cycle.',
  },
  {
    q: 'Can I bring an existing design in?',
    a: 'On paid plans, yes — paste a live URL, upload a screenshot, or drop a Figma link, describe what you want changed, and ufo redesigns or extends it.',
  },
  {
    q: 'Is Figma export real today?',
    a: 'The button is wired up, but the real Figma REST API integration ships in Phase 2 once OAuth app review is complete — today it queues the request.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, from Billing in your dashboard. You keep access through the end of the current billing period.',
  },
];
