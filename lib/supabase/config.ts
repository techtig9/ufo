/**
 * Supabase connection settings, and whether they are actually present.
 *
 * Why this exists: without it, a deployment with no Supabase keys failed at
 * BUILD time — `createBrowserClient` throws when constructed with undefined,
 * and Next constructs one while prerendering the auth pages. That made
 * "deploy first, add the keys afterwards" impossible: there was nothing to
 * add them to, because the build never produced a deployment.
 *
 * Now an unconfigured build succeeds and the app boots into an explicit
 * SETUP state: public pages work, and anything needing the database says so
 * plainly instead of throwing a 500 the visitor cannot interpret. Adding the
 * real values and redeploying is all that is then required.
 *
 * This is deliberately NOT a silent fallback. The placeholder host is a
 * `.invalid` domain — reserved by RFC 2606 and guaranteed never to resolve —
 * so an unconfigured deployment cannot accidentally talk to anything, and
 * `npm run preflight` still fails under CI, so a production build cannot ship
 * unconfigured without someone choosing to.
 */

/** Reserved by RFC 2606: guaranteed not to resolve, so it cannot reach a real host. */
const PLACEHOLDER_URL = 'https://not-configured.invalid';
const PLACEHOLDER_KEY = 'not-configured';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || PLACEHOLDER_KEY;

/**
 * True when real credentials are present.
 *
 * Checked against the placeholders rather than for emptiness, so a value that
 * came from this file can never be mistaken for a configured one.
 */
export const isSupabaseConfigured =
  SUPABASE_URL !== PLACEHOLDER_URL && SUPABASE_ANON_KEY !== PLACEHOLDER_KEY;

/** True when server-side code can also act with the service role. */
export const isSupabaseAdminConfigured =
  isSupabaseConfigured && SUPABASE_SERVICE_ROLE_KEY !== PLACEHOLDER_KEY;
