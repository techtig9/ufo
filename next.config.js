/** @type {import('next').NextConfig} */

// CSP is scoped to exactly what ufo calls: Supabase (DB/auth/storage),
// Paddle (checkout overlay + billing.js), Google Fonts, and the Tailwind
// CDN script used *inside* the sandboxed prototype iframe only (that
// iframe has its own document, so it isn't covered by this page-level CSP
// at all — worth knowing if you tighten this further later).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co https://api.paddle.com",
  "frame-src 'self' https://checkout.paddle.com https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
].join('; ');

// frame-ancestors is the CSP equivalent of X-Frame-Options, and it is the one
// that modern browsers actually honour. The /proto route strips
// X-Frame-Options so prototypes can be embedded — but it was still being served
// this CSP with `frame-ancestors 'none'`, so embedding was blocked anyway and
// the feature never worked as its own comment described. The two variants below
// keep everything else identical.
const cspAllowingEmbedding = csp.replace(
  "frame-ancestors 'none'",
  'frame-ancestors *'
);

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `experimental.instrumentationHook` was removed in Next 15 — instrumentation.ts
  // is picked up automatically now, so the flag is both unnecessary and rejected.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  async headers() {
    return [
      {
        // Everything except the public prototype route — /proto/[slug] is
        // meant to be embedded/shared, so it skips X-Frame-Options and
        // gets its own relaxed frame-ancestors instead.
        source: '/((?!proto).*)',
        headers: securityHeaders,
      },
      {
        // Shared prototypes are meant to be embedded, so this route drops
        // X-Frame-Options *and* relaxes frame-ancestors to match. Safe because
        // the prototype page renders generated HTML inside a sandboxed iframe
        // and exposes no authenticated action of its own.
        source: '/proto/:path*',
        headers: [
          ...securityHeaders.filter(
            (h) => h.key !== 'X-Frame-Options' && h.key !== 'Content-Security-Policy'
          ),
          { key: 'Content-Security-Policy', value: cspAllowingEmbedding },
        ],
      },
    ];
  },
  // Generated screens are static HTML+Tailwind strings rendered inside a
  // sandboxed iframe (see components/prototype-viewer) — no MDX/remote
  // component execution here, so no special webpack config is needed.
};


module.exports = nextConfig;
