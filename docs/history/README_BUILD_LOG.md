# ufo — MVP build

Generated from `ufo-ai-one-day-build-command.md`, rebranded from ufo.ai to **ufo**, and
re-themed to **Studio Grid**. Real, complete source — written in an environment with **no
network access**, so `npm install` / `next build` have never actually been run against it.
Run the verification steps below before trusting it in production.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in every key
```

You need:
- A Supabase project — run `supabase/schema.sql` in order (Section 1 required, Section 2
  optional add-ons, Section 3 launch hardening — apply all three before going live).
- Google OAuth enabled in Supabase Auth, for "Continue with Google".
- A Gemini API key.
- A Paddle Billing account — create the Starter/Pro/Business + top-up prices, copy the price
  IDs into `.env.local`, point a webhook at `/api/webhooks/paddle`.
- A Resend account (or swap `lib/email.ts` for your own provider) for transactional email.
- A `CRON_SECRET` value (any random string) — set the same value in Vercel's project env vars;
  Vercel Cron sends it automatically as a Bearer token to `/api/cron/reset-credits` (schedule
  is in `vercel.json`). Without it, Free-tier credits will never reset after the first cycle.

```bash
npm run dev
```

## About the screenshots

If you received `ufo-landing-page.png`, `ufo-dashboard.png`, and `ufo-ai-designer.png`
alongside this build: those are real Chromium renders of the actual layout, spacing, and
color tokens, built as standalone HTML for an offline sandbox that can't run `next dev`. Two
approximations to know about: they use system font fallbacks (Liberation Sans / DejaVu Sans
Mono) instead of the real Space Grotesk/Inter/JetBrains Mono webfonts, and the data shown
(project names, credit counts) is illustrative, not from a running database. Run `npm run dev`
for the real thing.

## The Studio Grid theme

Replaced Aurora Glass. Grounded in the product itself — ufo is a design tool, so its own
chrome borrows a design tool's vocabulary instead of a generic gradient/glass look:

- **Palette**: graphite (`ink`), citron (`studio-citron`), coral (`studio-coral`), indigo
  (`studio-indigo`), one warm `paper` surface used sparingly.
- **Type**: Space Grotesk (display) + Inter (body) + JetBrains Mono (labels/data).
- **Signature motifs**: dot-grid "artboard" canvas, crop-mark registration corners, a
  marching-ants selection border, ruler ticks, figure-numbered spec cards.
- **Motion**: scroll reveal, pointer-tracked magnetic tilt (`TiltCard`), scroll-triggered
  count-up numbers (`CountUp`), a native View Transitions hook (progressive enhancement, no
  library) — all CSS/vanilla JS, no new dependency.

## What's built (Phases 1.1–1.9, plus this round's launch pass)

**Core product** — auth (email + Google OAuth), the AI Designer multi-step generator wired to
`/api/generate` (plan/credit gate, Intelligent AI Routing, rate limiting), the prototype viewer
with hotspot click-through, Monaco editor with autosave, Design Handoff panel, ZIP export,
shareable links with QR codes and comments, Paddle billing + webhooks, the admin panel.

**This round's additions:**
- **Legal**: real Terms, Privacy, Refunds, and Cookie Policy pages (drafted content — have a
  lawyer review before launch, especially jurisdiction and any region-specific requirements).
- **SEO**: `sitemap.ts`, `robots.ts`, `manifest.ts`, full OG/Twitter metadata, a dynamically
  rendered OG image (`next/og`, no external asset), file-convention favicon + apple-touch-icon.
- **Error handling**: `not-found.tsx`, `error.tsx`, `global-error.tsx`, a dashboard
  `loading.tsx` skeleton.
- **Security**: CSP + security headers in `next.config.js` scoped to the actual third parties
  this app calls; a DB-backed rate limiter (`lib/rate-limit.ts` — in-memory doesn't work
  across serverless instances, this does) wired into `/api/generate`.
- **Compliance**: a cookie consent banner; GDPR data export (`/api/account/export`) and
  account deletion (`/api/account/delete`, cancels Paddle first) from Settings.
- **Growth**: a referral system (code generation, `?ref=` capture through signup, tracked in
  `referrals` — rewards are non-credit by design, so it never touches the AI cost model); an
  onboarding checklist on dashboard home, derived from real account data, not fake tracking;
  an upgrade-nudge modal on 402s instead of a bare toast.
- **Lifecycle email** (`lib/email.ts`, via Resend): welcome, low-credit warning (fires once,
  on the cycle where a generation crosses the 10% line, respecting a per-user opt-out toggle
  in Settings), payment-failed dunning, subscription canceled, and a working contact form.
- **Ops**: `/api/health` for uptime monitoring, `/admin/activity` audit log (backed by the
  same `request_log` table as rate limiting), a GitHub Actions CI workflow
  (typecheck/lint/build on every push).
- **Launch audit pass** (this round): a required Terms/Privacy checkbox + Cloudflare Turnstile
  bot protection on signup; indexes on every foreign key the app actually queries by (Postgres
  doesn't add these automatically — only PKs and UNIQUE columns); a `/contact` support page
  wired to a real send function; JSON-LD structured data on the landing page for SEO.
- **Second audit pass** — one real bug fix and two explicit requirements from the standing
  instructions that hadn't been addressed yet:
  - **Fixed: Free-tier credits never refreshed.** Paid plans get their credits reset by the
    Paddle `subscription.updated` webhook on renewal — but Free-tier accounts have no billing
    event to trigger that, so their `credits_remaining` would have been permanently stuck at
    whatever was left after the first 150. `credits_reset_at` + `/api/cron/reset-credits` +
    `vercel.json` fix this with a daily cron that resets any subscription whose 30-day cycle
    has elapsed — Free-tier's only reset mechanism, and a safety net for paid plans too.
  - **Added: MFA/TOTP**, explicitly listed as a required SaaS standard — real enrollment via
    Supabase Auth's built-in MFA API (QR code, verify, unenroll) in Settings, and a genuine
    second-factor challenge step on login (checked via `getAuthenticatorAssuranceLevel()`) —
    enrolling without the login-side challenge would have made the feature decorative.
  - Turnstile added to login too, not just signup. Resend-verification-email link when login
    fails because the account isn't confirmed yet. Startup env validation
    (`instrumentation.ts` \u2192 `lib/validate-env.ts`) so a missing required key fails loudly
    at boot instead of as a confusing 500 on whatever route needed it first.

## Testing methodology (third audit pass)

"Tested" here means the most rigorous **static** verification possible in an environment with
no network access — `npm install` genuinely fails here (403 from the registry), so nothing in
this repo has been run. What was actually done instead, all passing clean on the final run:

- **Import resolution**: every `@/...` and relative import across all 104 TS/TSX files
  resolves to a real file on disk (311 specifiers checked, 0 broken) — this catches the class
  of bug that a `tsc` run without `node_modules` can't, since a missing internal file and a
  missing npm package produce the identical "cannot find module" error.
- **Client-directive coverage**: every file using a React hook or a JSX event handler has
  `'use client'` (0 missing) — these fail at build time in the real Next.js app, not at edit
  time, so this check earns its keep.
- **API route completeness**: all 14 `route.ts` files export a valid HTTP method handler.
- **Dynamic route params**: every `params.x` used in a route matches its `[x]` folder segment.
- **Schema \u2194 code cross-reference**: every table name queried via `.from()` exists in
  `schema.sql` and vice versa (the one exception, `folders`, is the documented-but-unwired
  Optional Add-On — expected, not a bug).
- **Pricing fidelity**: every number in `lib/credits.ts` (plan prices, monthly credits, all 9
  per-action credit costs) matches the Pricing Plans & Cost Optimisation Strategy section of
  the build doc, checked line by line, not spot-checked.
- **SQL structural validity**: no SQL parser was available offline, so this was checked by
  hand — balanced parens, even quote count, every statement-opening keyword has a matching
  semicolon (58/58), and every foreign key references a table already defined earlier in the
  file (Postgres requires this order; verified programmatically, not by eye).
- **RLS coverage**: every RLS-enabled table has at least one policy, except the two
  intentionally service-role-only tables (`request_log`, `generation_cache`), which are
  supposed to have zero.
- **Env var completeness**: every `process.env.X` referenced in code is now documented in
  `.env.example` (23/23) and vice versa, with the one exception (`TURNSTILE_SECRET_KEY`,
  consumed by Supabase itself, not app code) explained inline.
- **Found and fixed one real gap**: the pricing doc explicitly promises "duplicate requests
  return cached responses at no extra credit cost" (Credit Rules) and "cached responses \u2026
  never consume additional credits" (Fair Usage Policy) — but no caching existed anywhere in
  the code. Added `generation_cache` + `lib/generation-cache.ts`, wired into `/api/generate`:
  an identical request (same user, same inputs) within a 10-minute window now reuses the prior
  result instead of re-calling Gemini and re-charging credits.
- Also re-ran `tsc` in full `strict` mode (matching the real `tsconfig.json`, not just the
  relaxed settings used for the earlier passes) to see what it surfaces beyond missing
  modules: purely implicit-`any` noise from missing `@types/react`/`@types/node` — spot-checked
  several by hand (e.g. `Button`'s destructured props losing their interface without real
  React types resolved) and confirmed none are real logic bugs.
- **Found a real bug class `tsc` can't catch**: several files had `\u2014`/`\u00b7`/etc. sitting
  directly in JSX text instead of inside a string expression (`{'\u2014'}`) — syntactically
  valid TypeScript either way, so it compiles clean, but it renders as the literal text
  `\u2014` in the browser instead of an em dash. Wrote a targeted scanner (checks whether each
  `\u` escape's nearest preceding token is a JSX `>` with no quote in between) and found **10
  instances** across 8 files, all now fixed. This is the kind of bug that only shows up by
  actually looking at rendered output — worth knowing about if you write more JSX by hand.

## AI advisor ("Compass") and greetings

- **Compass** (`components/chat/chat-widget.tsx`) is a floating chat widget with its own
  symbol (`compass-chat-icon.tsx` — a speech-bubble/compass-needle mark, not a reuse of the
  main logo) available site-wide except the auth pages. It answers questions about plans,
  credits, and features — grounded in the real `PLAN_CARDS`/`CREDIT_COSTS` data
  (`lib/chatbot-knowledge.ts`) so it can't quote a stale number, and for signed-in users it's
  told their actual plan/credit balance for personalized advice. It does not generate designs
  itself — it's a decision-support assistant, not the product's core feature.
- **On the "sign up before using any feature" requirement**: `/api/chat` requires
  authentication, same as every other feature route — no exception carved out for the chatbot.
  A logged-out visitor still *sees* Compass (the symbol + a greeting bubble are part of the
  landing page's marketing surface, and discoverability matters for a feature meant to help
  people decide whether to sign up), but clicking it while logged out shows a sign-up/login
  prompt instead of a working chat. If you intended the chatbot to be fully hidden pre-signup
  rather than visible-but-locked, that's a one-line change in `chat-widget.tsx`
  (`authed === false` branch) and `chat-widget-gate.tsx`.
- **Greetings**: a time-of-day greeting ("Good morning/afternoon/evening") appears above the
  landing page hero (`hero-greeting.tsx`, computed client-side from the visitor's local time —
  deliberately not server-rendered, to avoid guessing a timezone and mismatching on hydration)
  and on the dashboard home page, personalized with the user's first name once loaded
  (`dashboard-greeting.tsx`). Compass also opens with a proactive greeting bubble a few
  seconds after page load.

## What's still stubbed or simplified, on purpose

- **Export to Figma** — fully wired (auth, gate, credit deduction, DB update), returns
  `status: "queued"` instead of calling Figma's API. Real integration is Phase 2.
- **Regenerate / edit-component / change-theme as separate routes** — credit costs and
  Gemini functions exist; only `/api/generate` (full generate + import-redesign) got a wired
  route. Same pattern, smaller job. (The new request-caching in `/api/generate` only covers
  what's actually wired, for the same reason.)
- **Team members / API access** — priced but not built; needs an orgs/invites model.
- **Comment pins** — land at a fixed position, not a precise click coordinate.
- **Analytics consent gating** — the cookie banner records a choice but isn't wired to an
  actual analytics tool's consent API yet (see the TODO in `cookie-consent.tsx`).
- **Bot protection (Turnstile)** — wired end to end (`turnstile-widget.tsx` \u2192 Supabase's
  `captchaToken`), but renders nothing until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, so it
  won't block local development. Also requires enabling Turnstile under Authentication > Bot
  and Abuse Protection in the Supabase dashboard with the matching secret key.

## Launch checklist — code-side (in this repo)

- [ ] `npm run typecheck && npm run lint && npm run build` — this was written without a
      compiler in the loop. A syntax-only pass with a global `tsc` came back clean, but a real
      typecheck against installed deps (especially Supabase's inferred types) will surface a
      handful of small fixes.
- [ ] Run `supabase gen types typescript` and wire it into `lib/supabase/*` instead of the
      current loose typing.
- [ ] Verify the Gemini model names in `lib/gemini.ts` against Google's current list/pricing.
- [ ] Seed 3–5 rows into `templates`.
- [ ] Replace every `[bracketed placeholder]` — company name, contact email, jurisdiction,
      refund window — in the legal pages, footer, and about section.
- [ ] Point the CSP in `next.config.js` at your real analytics/monitoring domains once chosen.
- [ ] Hook `app/error.tsx` / `global-error.tsx` up to real error monitoring (Sentry or similar)
      instead of `console.error`.

## Launch checklist — not code (business side)

- [ ] Legal review of the drafted Terms/Privacy/Refunds/Cookies pages.
- [ ] Business entity, bank account, and tax setup for accepting payments.
- [ ] Domain + DNS + production deploy target (Vercel is the natural fit for this stack).
- [ ] Uptime monitoring pointed at `/api/health` (UptimeRobot, Better Uptime, etc.).
- [ ] Error monitoring account (Sentry) and analytics account (PostHog/Plausible/GA).
- [ ] Customer support channel (email inbox at minimum; Intercom/Crisp if you want live chat).
- [ ] A status page (statuspage.io or similar) — link it from the footer once it exists.
- [ ] Load-test `/api/generate` before a launch spike — it's the one route that's slow and
      costs real money per call.
- [ ] Decide the actual money-back window for the Refund Policy (currently a placeholder).
