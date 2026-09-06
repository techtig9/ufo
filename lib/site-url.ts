/**
 * The public origin of this deployment.
 *
 * WHY THIS IS NOT JUST `process.env.NEXT_PUBLIC_SITE_URL`
 * ------------------------------------------------------
 * Five call sites used to fall back to `http://localhost:3000`, and the
 * fallback is what a fresh deployment actually gets — the variable is optional
 * and easy to forget. Each of them is broken by that fallback in a way nobody
 * notices until it is in front of a customer:
 *
 *   app/layout.tsx      metadataBase, so `og:url` on every shared link reads
 *                       http://localhost:3000 (verified on a real preview
 *                       deployment before this existed)
 *   app/robots.ts       points crawlers at a sitemap on localhost
 *   app/sitemap.ts      every URL in the sitemap is localhost
 *   workspace invites   the accept link in the invitation email is localhost,
 *                       so the invitation cannot be accepted at all
 *   mention emails      same, for the "view this comment" link
 *
 * Vercel exports the deployment's own host, so the correct origin is knowable
 * without configuration. VERCEL_PROJECT_PRODUCTION_URL is preferred over
 * VERCEL_URL because it is stable: VERCEL_URL is unique per deployment, and an
 * invite link that outlives its deployment should still resolve. Neither is
 * NEXT_PUBLIC_, so this is server-only — which every call site above is.
 *
 * An explicit NEXT_PUBLIC_SITE_URL always wins: a custom domain is the real
 * answer, and only the operator knows it.
 */
function normalise(value: string): string {
  const trimmed = value.trim();
  // Vercel's variables carry a bare host ("ufo.vercel.app"), not a URL.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, '');
}

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured?.trim()) return normalise(configured);

  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel?.trim()) return normalise(vercel);

  return 'http://localhost:3000';
}
