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
- [ ] Phase 6 — growth and conversion
- [ ] Phase 7 — backend, security, reliability
- [ ] Phase 8 — product advantage
- [ ] Phase 9 — trust and operations

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

## Next step

Phase 6: growth and conversion.
