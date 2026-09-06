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
  'GROQ_API_KEY',
] as const;

// Required only once you actually enable the feature — checked separately
// so a fresh dev setup isn't forced to configure billing/email/captcha/AI
// fallbacks just to run the generator.
const RECOMMENDED = [
  'ANTHROPIC_API_KEY',
  'PADDLE_API_KEY',
  'PADDLE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'CEREBRAS_API_KEY',
  'OPENROUTER_API_KEY',
] as const;

/**
 * Reports what is missing. Loudly — but it does NOT throw.
 *
 * It used to throw, which killed the process. That is the right instinct for a
 * server that is meant to be configured, but it made the failure mode worse in
 * the one case that matters most: a first deploy. `register()` runs during
 * `next build` too, so a missing key failed the BUILD, and a build that never
 * produces a deployment leaves nowhere to add the keys. "Deploy first,
 * configure after" was impossible.
 *
 * The app now boots into an explicit setup state instead — see
 * lib/supabase/config.ts and components/ui/setup-notice.tsx. The guarantee that
 * an unconfigured build cannot ship to production quietly is kept where it
 * belongs and where it can actually stop a release: `npm run preflight`, which
 * still FAILS under CI and NODE_ENV=production.
 */
export function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(
      `[ufo] NOT CONFIGURED — missing: ${missing.join(', ')}. ` +
        'The app will boot and serve its public pages, but anything needing the ' +
        'database (sign-in, the dashboard, generation) will show a setup notice ' +
        'until these are set. Add them to your host\u2019s environment variables and ' +
        'redeploy \u2014 NEXT_PUBLIC_* values are compiled into the client bundle, so a ' +
        'redeploy is required, not just a restart.'
    );
  }

  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);
  if (missingRecommended.length) {
    console.warn(
      `[ufo] Running without: ${missingRecommended.join(', ')} \u2014 the features that depend on them degrade rather than crash the app. Specifically: billing and email no-op, the AI cascade loses its fallback providers, and /api/cron/reset-credits returns 503 (it fails closed without CRON_SECRET, so Free-tier credits never reset). Fine for local dev, not for production.`
    );
  }
}
