import { PLAN_CARDS } from './plan-features';
import { CREDIT_COSTS } from './credits';

/**
 * The assistant's product knowledge is grounded here — built from the same
 * PLAN_CARDS/CREDIT_COSTS constants the pricing page renders from, so it
 * can never quote a stale number. This is what "trained on data" means in
 * practice for a support/decision assistant: real product data injected
 * into the system prompt (grounded context), not a separately fine-tuned
 * model — fine-tuning a model on a pricing table would be the wrong tool
 * for data that changes when you edit one file.
 */
export function buildKnowledgeBase(): string {
  const planLines = PLAN_CARDS.map(
    (p) =>
      `- ${p.label}: $${p.price}/mo, ${p.credits.toLocaleString()} credits (~${p.fullProjects} full projects/mo). ${p.tagline}. Includes: ${p.features.join('; ')}.`
  ).join('\n');

  const costLines = Object.entries(CREDIT_COSTS)
    .map(([action, cost]) => `- ${action.replace(/_/g, ' ')}: ${cost} credits`)
    .join('\n');

  return `PLANS:
${planLines}

CREDIT COSTS PER ACTION:
${costLines}
Exports, sharing links, duplicating projects, and restoring versions are always free.

PRODUCT: ufo generates a complete, clickable multi-screen UI/UX prototype from a plain-language
description. The flow: describe the project, answer a short multiple-choice sequence (project
type, target devices, design style, core screens, navigation pattern, color theme, font
pairing), then ufo generates linked screens sharing one design system. Users can click through
the prototype like a real product, edit the underlying code in a built-in editor, pull a Design
Handoff spec sheet (colors/fonts/spacing), export a ZIP, or publish a shareable link with a QR
code that stakeholders can comment on without an account.

Import & redesign (paid plans only) lets a user bring an existing design in via a URL,
screenshot, or Figma link and have ufo redesign or extend it.

Export to Figma is wired up but returns "queued" \u2014 the real Figma API integration is
planned for a future release.`;
}

export const CHAT_SYSTEM_INSTRUCTION = `You are ufo's in-app advisor. You help people decide
things \u2014 which plan fits their usage, whether a feature covers their use case, how credits
work, what project type or design style suits what they're building. You are NOT the design
generator itself \u2014 you don't generate screens or prototypes; if someone wants that, point
them to the AI Designer.

Ground every factual claim (prices, credits, features) in the PRODUCT KNOWLEDGE below \u2014
never invent a number. If something isn't covered there, say you're not sure and suggest
contacting support at /contact rather than guessing.

Keep answers short \u2014 2\u20134 sentences, conversational, no headers or bullet-point walls
unless comparing options. If comparing plans, a short list is fine.`;
