# UFO — audit and remediation log

Resume point for a fresh session. Phases come from the three command files:
`/fix-all` (1–5), `/grow-harden` (6–7), `/advantage-trust` (8–9).

**Constraint in force from 2026-09-20:** no deploys, no dashboard changes, no
applying migrations to a live database. New migrations are files only.

## Baseline measured at the start of Phase 1

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm test` | 253 passed, 0 failed |
| `npm run build` with **zero** env vars | compiled successfully |
| Public pages with zero env vars | render; `/dashboard` and `/admin` show a setup notice; `/api/health` returns an honest 503 |

Phases 1–5 of an earlier Master Command are already done, so the P0 class is
empty: there is no build failure, crash or login blocker to fix. The findings
below are what is left.

## Findings

Priority: P0 build/crash/login · P1 core feature broken · P2 buttons/UX/layout · P3 polish.

| # | Issue | File | Pri | Status |
|---|---|---|---|---|
| 1 | `Paddle.Initialize({token: undefined!})` when the token is unset; click does nothing, no error shown | `components/dashboard/paddle-checkout-button.tsx:36` | P1 | fixed |
| 2 | `if (!window.Paddle) return;` — silent no-op when an ad blocker blocks paddle.com; button looks enabled | `components/dashboard/paddle-checkout-button.tsx:34` | P1 | fixed |
| 3 | `<Script>` has no `onError`; a blocked CDN leaves the button disabled forever with no explanation | `components/dashboard/paddle-checkout-button.tsx:47` | P1 | fixed |
| 4 | CI never runs the 253-test suite, so no test gates a PR | `.github/workflows/ci.yml` | P1 | fixed |
| 5 | CI builds *with* dummy env vars, so the "builds with no env vars" guarantee is not enforced anywhere | `.github/workflows/ci.yml` | P1 | fixed |
| 6 | `engines.node: >=18.18.0`, but Next 16 requires Node 20.9+; install succeeds then the build fails | `package.json` | P1 | fixed |
| 7 | 7 stray `console.log` calls in app/lib/components | various | P2 | fixed |
| 8 | 21 status-report markdown files at the repo root | repo root | P2 | fixed |
| 9 | No `docs/`, no `docs/DEPLOY_VERCEL.md` | repo root | P2 | fixed |
| 10 | No canonical URLs on any page | `app/**/page.tsx` | P2 | fixed |
| 11 | Pricing has no monthly/yearly toggle although annual discounts are advertised in copy | `components/landing/pricing-section.tsx:89` | P2 | fixed |
| 12 | No usage meters or near-limit upgrade prompts | dashboard | P2 | fixed |
| 13 | No in-app feedback widget | app | P2 | fixed |
| 14 | No Dependabot, no PR template | `.github/` | P2 | fixed |
| 15 | `/api/chat` read its body with a cast, not a check: `text` could be any type, and had no length cap — twelve multi-megabyte messages were a rate-limit-compliant way to run up an AI bill | `app/api/chat/route.ts:29` | P1 | fixed |
| 16 | `/api/chat` returned 500 on a malformed JSON body instead of 400 | `app/api/chat/route.ts` | P2 | fixed |
| 17 | 16 write routes have hand-rolled validation rather than zod. Reviewed: the ones that write user input use explicit allow-lists and are correct. Converting them is Phase 7's "zod on every route" item, via a shared `readJson(request, schema)` helper — not a Phase 2 bug fix | `app/api/**` | P3 | deferred to Phase 7 |

## Design direction

Product type from the README: **ufo.ai — AI UI/UX design**. Its assigned
direction is *dark with neon lime/violet, dot-grid canvas, cursor-follow glow*.

Already implemented in a previous phase: the `studio-citron` (#D4FF4F) neon
lime, the violet accent, the `dot-canvas` background, semantic CSS-variable
tokens with light and dark mode and a persisted toggle, two fonts via
`next/font` (Space Grotesk display + Inter body), scroll-reveal, tilt cards and
an animated hero. Phase 3 verifies this against the quality bar and fills the
component gaps (no Table, Avatar, Progress or Toast primitive in
`components/ui/`) rather than restyling what already works.

## Phase status

- [x] Phase 1 — audit
- [x] Phase 2 — fix
- [x] Phase 3 — design
- [x] Phase 4 — clean repo
- [x] Phase 5 — verify and package
- [x] Phase 6 — growth and conversion
- [x] Phase 7 — backend, security, reliability
- [x] Phase 8 — product advantage
- [x] Phase 9 — trust and operations

### Checked and found already correct (no change made)

- `/api/chat` cannot be used to inject a `system` turn: `chatWithAssistant`
  maps any role that is not `'model'` to `'user'`. The role is constrained by
  the new schema anyway, so that stays true if the mapping is rewritten.
- `.env.example` already lists every variable the code reads, each marked
  required or optional with its purpose. Verified by diffing the file against
  every `process.env.*` in `app`, `lib`, `components`, `middleware.ts` and
  `instrumentation.ts`: nothing missing.
- No Supabase or API client is constructed at import or build time
  (`lib/supabase/config.ts` supplies placeholders).
- The remaining `console.log` calls are the logger's own sink in
  `lib/observability.ts` and `lib/auth-log.ts`, not debug leftovers.

### Phase 3 result

The design direction, semantic token layer, light/dark themes, persisted
toggle, two-font pairing, motion tiers and component state matrix were built in
an earlier phase and verified rather than rebuilt. Four spec items were
genuinely missing and were added:

| Added | Why |
|---|---|
| 9-step neutral ramp `--n0..--n8`, inverting between themes | The semantic tokens name a role and cannot answer "a grey between surface and border" — table striping, chart series, skeleton gradients and the generated prototype markup all needed one |
| `--shadow-sm/md/lg`, theme-aware | Every shadow was written inline, so "a card shadow" meant four different values |
| `--space-1..9` + matching Tailwind scale | So raw stylesheets and generated CSS land on the same rhythm as the utilities |
| `text-display-xs..xl` with `clamp()` | Headings stepped at breakpoints; they now scale with the viewport, so there is no reflow jump at 767/768px |
| `components/ui/table.tsx` | Six screens had each grown their own `<table>`. Owns its scroll container, because a data table is the top cause of horizontal page scroll on a phone |
| `components/ui/avatar.tsx` | Initials only — there is no avatar upload, so an `<img>` was a network request and a broken-image state for nothing. Colour is hashed from the name, so a person is the same colour everywhere |
| `components/ui/progress.tsx` | Needed by the Phase 6 usage meters. Reports its own numbers through ARIA, animates `scaleX` not `width`, and never uses colour as the only signal |

Toast was already covered by `react-hot-toast` plus the configured `<Toaster>`
in `app/layout.tsx` — one animation library, as the spec requires.

Measured after the change, against a production build on localhost:

```
contrast    22 theme x route combinations — ALL TEXT MEETS WCAG AA IN BOTH THEMES
a11y        ALL ACCESSIBILITY CHECKS PASSED (incl. prefers-reduced-motion: 0 still animating)
responsive  180 theme x breakpoint x route combinations — NO OVERFLOW, THEME OR CONSOLE FAILURES
palette     ALL COMMAND PALETTE CHECKS PASSED
```

### Phase 5 — fresh-clone verification

Run in a temp directory from a clean clone of `release/clean`, with
`env -i` so **no** environment variable was inherited:

```
npm ci          ok
typecheck       clean
lint            clean
test            262 passed, 0 failed
build           Compiled successfully   <- with zero env vars
```

Archive: `../ufo-clean.zip` (654 KB), verified to contain no `node_modules`,
no `.next` and no `.env`.

### Phase 6 result

Branched `release/growth` from `release/clean`, not from `main`: the
prerequisite is a clean base, and `main` is still the pre-audit code.

Built:

| Item | Note |
|---|---|
| Annual billing, end to end | Was advertised and not implemented. One constant (`ANNUAL_MONTHS_CHARGED = 10`) drives the saving, both price grids and the Paddle price map — without the yearly ids in that map an annual customer is charged and not upgraded |
| Usage meter with a near-limit prompt | Quiet until 75%, states a checkable fact, offers a top-up rather than a dead Upgrade link on Business |
| Canonical URLs | On the 8 public marketing/legal pages. The 3 auth pages are client components, where Next forbids a metadata export |
| FAQPage + both-period offers in JSON-LD | Built from the same array the page renders |
| MDX blog scaffold, 3 draft posts | Drafts 404 in production and never reach the sitemap; verified in both directions |
| In-app feedback (migration 016) | Insert-only, no select policy at all — feedback quotes private work |
| "Made with ufo" badge on Free shares | Replaces a plain-text line that branded paid customers' client work and was not a link |

Measured against a production build:

```
PERFORMANCE BUDGET MET
  landing JS 221.8 KB compressed · CLS 0 on every route · LCP 160-292ms
  no source maps served · Monaco absent from public pages
```

Four Phase 6 items were deliberately not built and are ranked in `ROADMAP.md`
with the reason — chiefly the try-before-signup demo, which needs a cost
ceiling and an abuse model decided before an anonymous visitor can spend AI
budget.

### Phase 7 result

Most of this phase's checklist was already built and was verified rather than
rebuilt. What the audit found genuinely missing, and what was done:

| Finding | Action |
|---|---|
| **No AI spend ceiling of any kind** | `AI_DISABLED` kill switch + `AI_MONTHLY_BUDGET_USD` cap, checked inside `route()` so all eleven entry points are covered. A block refunds credits and returns 503 with the operator's message |
| Nine routes turned a malformed body into a 500 | `lib/api/read-json.ts`; all now 400 with the field named and the value never echoed |
| Token cost was logged but never priced | `lib/ai/cost.ts`, erring high by construction — unknown model → most expensive known rate, missing usage → a floor, not free |

Verified as already correct, no change made:

- **No SSRF surface.** Every server-side `fetch` targets a fixed provider
  endpoint. `import_redesign` takes pasted markup, not a URL the server
  retrieves.
- Security headers (CSP, HSTS, frame, referrer) are set in `next.config.js`.
- RLS with policies on every table; `EXECUTE` revoked from `anon` on the
  server-only SECURITY DEFINER helpers (migration 014).
- Email verification, password reset, rate-limited auth, account deletion and
  data export all exist and are wired.
- Entitlements have one source (`lib/credits.ts` + `lib/plan-features.ts`) and
  are enforced server-side.
- Paddle webhooks verify HMAC in constant time and dedupe on `event_id`.
- Foreign keys are indexed (migration 015); every list query is bounded.
- CI now runs typecheck, lint, tests and a no-env-var build, plus an advisory
  dependency audit.

Deferred to `ROADMAP.md` with reasons: the public `/api/v1` with scoped keys
and OpenAPI, outbound webhooks, the background job queue, and streaming
responses. Each is a real feature rather than a gap — none is load-bearing at
current scale, and the versioning commitment of a public API in particular
should not be taken on speculatively.

### Phase 8 result

Of the six ufo.ai advantage items, four already existed (shareable links with
comments, device frames, version history, handoff specs). The two genuinely
missing were built — both, rather than padding to the allowed three:

- **React export.** A `.tsx` component per screen, beside the HTML. Written as
  a scanner rather than a regex, because `html.replace(/class=/g, …)` also
  rewrites prose — a screen whose copy mentions `class="btn"` would be
  silently corrupted. Its limits are stated in the export README rather than
  hidden: inline handlers dropped, no component extraction.
- **Design-system generation.** `tokens.css`, a Tailwind preset and
  `tokens.json` from one source. The preset points at the CSS variables rather
  than inlining hex, so a theme change is made once. A project with no theme
  gets empty files that say so.

**A production bug surfaced as a 1-in-6 flaky test** and was fixed at the
cause: `recordAttempt`'s lazy import was documented as failing harmlessly
without Supabase, which stopped being true when `lib/supabase/config.ts`
introduced placeholder values for deploy-before-keys. Every AI attempt was
firing a doomed connection to `not-configured.invalid` and swallowing it.
`lib/email.ts` had the same bug per email. Both guarded; eight consecutive
clean suite runs.

### Phase 9 result

| Item | State |
|---|---|
| Legal pages, subprocessors, AI-use disclosure | Already existed |
| Data-deletion and export flows | Already existed |
| Contact form with spam protection, transactional templates | Already existed |
| Admin: users, subscriptions, payments, activity, AI cost, email, system | Already existed |
| **Credit grants** | Built — mandatory reason, bounded amount, re-checked admin role, audit row |
| **Feature flags** | Built — a missing flag is OFF, and they are explicitly not a permission system |
| **`docs/UNIT_ECONOMICS.md`** | Built, as a runnable script so the numbers come from the code |

The economics script found a real inconsistency: `generate_component` charges
100 credits for the same 8,000-token ceiling `import_redesign` charges 1,900
for — **19× cheaper per credit** for comparable work. Deliberately not changed:
credit pricing is a product decision with customer impact, not something to
alter inside a refactor. Three options are written up with a recommendation.

No paid plan has a negative worst-case margin (52% / 35% / 37%). Free costs
about $2.16 per user per month at worst.

### Final verification

From a clean clone in a temp directory under `env -i`, nothing inherited:

```
npm ci          ok
typecheck       clean
lint            clean
test            343 passed, 0 failed
build           Compiled successfully   <- zero env vars
```

## Status

All nine phases complete. Three branches, three PRs, stacked in order:
`release/clean` → `release/growth` → `release/advantage`.
