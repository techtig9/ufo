/**
 * The third parties that receive customer data, for the Privacy Policy and
 * Terms to name accurately.
 *
 * This exists because the legal pages named "Google Gemini" as the model
 * provider long after the code had moved to a Groq → Cerebras → OpenRouter →
 * Anthropic cascade. Naming who receives user data is a core disclosure, not a
 * marketing detail, so it is derived from one list here and asserted against
 * the real cascade in the tests rather than typed into three pages.
 */

export interface Subprocessor {
  name: string;
  purpose: string;
  /** The identifier used in lib/ai/providers.ts, for AI providers. */
  providerName?: string;
}

/**
 * AI providers, in the order they are tried. A given request goes to ONE of
 * them — the first that is configured and succeeds — not to all four.
 */
export const AI_SUBPROCESSORS: Subprocessor[] = [
  { name: 'Groq', providerName: 'groq', purpose: 'generates screens from your description' },
  { name: 'Cerebras', providerName: 'cerebras', purpose: 'generates screens from your description' },
  { name: 'OpenRouter', providerName: 'openrouter', purpose: 'generates screens from your description' },
  { name: 'Anthropic', providerName: 'anthropic', purpose: 'generates screens from your description' },
];

export const INFRASTRUCTURE_SUBPROCESSORS: Subprocessor[] = [
  { name: 'Supabase', purpose: 'hosts the database, authentication and file storage' },
  { name: 'Paddle', purpose: 'Merchant of Record for billing; handles payment details directly' },
  { name: 'Resend', purpose: 'delivers account, security and collaboration email' },
  { name: 'Cloudflare Turnstile', purpose: 'bot protection on sign-up and contact forms' },
];

/** "Groq, Cerebras, OpenRouter or Anthropic" — for prose. */
export function aiProviderSentence(): string {
  const names = AI_SUBPROCESSORS.map((p) => p.name);
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}
