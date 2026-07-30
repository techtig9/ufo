/**
 * Validates required environment variables at startup. Import this once
 * from a server-only entry point (instrumentation.ts) so a missing key
 * fails the deploy immediately with a clear message, instead of surfacing
 * as a cryptic 500 the first time a user hits the affected route.
 */
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
] as const;

// Required only once you actually enable the feature — checked separately
// so a fresh dev setup isn't forced to configure billing/email/captcha
// just to run the generator.
const RECOMMENDED = [
  'PADDLE_API_KEY',
  'PADDLE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'CRON_SECRET',
] as const;

export function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to .env.local and fill them in.`
    );
  }

  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);
  if (missingRecommended.length) {
    console.warn(
      `[ufo] Running without: ${missingRecommended.join(', ')} \u2014 the features that depend on them (billing, email, cron) will no-op rather than error. Fine for local dev, not for production.`
    );
  }
}
