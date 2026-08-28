# UFO Upgrade — Phase 1 Notes (Audit + Design System)

Implements Section 45/Phase 1-2 and Section 42 of `UFO_Complete_AI_SaaS_Upgrade_Specification.docx`.
No existing route, API, database table, or working feature was touched, removed, or reset.

## Repository audit (summary)

- Next.js 14 (App Router) + React 18 + TypeScript, Supabase (DB/Auth), Gemini/Claude for
  generation, Paddle Billing, Monaco editor. ~250 files, 104+ TS/TSX.
- The product's actual mechanism is: describe an idea → AI generates a multi-screen **clickable
  prototype** (`app/proto/[slug]`, `components/prototype-viewer/*`) → visual/code edit in the
  workspace (`components/editor/*`) → share a public preview link (with comments, QR code) →
  export code/ZIP. There is no live "publish to a hosted website/your own domain" pipeline in
  the backend today.
- The spec document frames the product as an "AI website generator ... Publish ... published
  site." I'm treating "website" / "publish" in the spec as this app's existing
  generate → edit → share-a-public-link model, per the spec's own Section 1 rule (don't rebuild
  from scratch) and Section 47 (don't invent backend features that don't exist). **Flagging this
  explicitly as an assumption** — if you actually want real hosting/publishing to a custom
  domain, that's net-new backend infrastructure and should be scoped separately before I build
  frontend around it.
- Baseline test results before any changes: `tsc --noEmit` clean; `next lint` — 1 error
  (unescaped apostrophe in `notification-center.tsx`), 5 pre-existing warnings (exhaustive-deps
  x3, no-img-element x2); `next build` — compiles cleanly, only fails at the font-fetch and
  static-prerender steps in this sandbox because it has no access to `fonts.googleapis.com` and
  no real Supabase project configured. Neither is a code defect (confirmed by temporarily
  stubbing both and re-running the build).
- `next@14.2.5` has a known security advisory (flagged by `npm audit`) — carrying this into the
  Security phase (Phase 5 of this rollout) rather than bumping it mid-design-system-work.

## What changed in this phase

**Design tokens** (`tailwind.config.ts`, `app/globals.css`)
- Added semantic `status.success` / `status.warning` / `status.error` / `status.info` colors.
  `error` intentionally reuses the existing `studio.coral` value — one canonical "this is bad"
  color, not a second red.
- Added `drawer-surface` / `dropdown-surface` CSS classes (with light-mode variants, same
  pattern as the existing `.panel`) and three small keyframes (`fade-in`, `scale-in`,
  `slide-in-right`) for the new overlay components below — all respect the existing global
  `prefers-reduced-motion` rule.

**New reusable components** (`components/ui/`) — the primitives Section 42 calls for that
didn't exist yet (`Button`, `Panel`/Card, and toasts via `react-hot-toast` already did):
- `input.tsx`, `select.tsx` — labeled, with hint/error text, `aria-invalid` +
  `aria-describedby` wiring, matching the exact input styling already used on the login/signup
  pages.
- `badge.tsx` — status pills (neutral/primary/success/warning/error/info).
- `skeleton.tsx` — `Skeleton`, `SkeletonText`, `SkeletonCard`, built on the existing `.shimmer`
  treatment rather than a new loading style.
- `empty-state.tsx`, `error-state.tsx` — for the "every page: Loading, Empty, Normal, Error"
  requirement (Section 27); not yet wired into existing pages — that's Phase 2+ as each page
  gets its pass.
- `modal.tsx`, `drawer.tsx` — focus-trapped, Escape-to-close, scroll-locked, `role="dialog"`
  `aria-modal`, restores focus to the trigger on close.
- `tabs.tsx` — roving-tabindex keyboard nav (arrow keys/Home/End), `role="tablist"`.
- `dropdown.tsx` — `role="menu"`, closes on outside click/Escape/selection.
- `tooltip.tsx` — hover + focus triggered (not hover-only), `role="tooltip"`.

**Fixed:** the one pre-existing lint error (`components/notifications/notification-center.tsx`)
so `next lint` is clean.

## Known follow-up (not done in this phase, on purpose)

- These primitives aren't wired into existing pages/forms yet — that happens as each area gets
  its pass in Phases 2-5, so existing screens are untouched for now (lower risk, easier to
  review this diff on its own).
- Several existing components hardcode `text-white` regardless of light/dark mode (pre-existing
  pattern — I matched it in the new components for consistency rather than introducing a second
  convention). Full light-mode contrast audit is tracked for the Accessibility pass (Phase 5).
- The 5 pre-existing lint warnings (missing hook deps, `<img>` vs `next/image`) are left as-is —
  unrelated to this phase, will fold into the Performance/Reliability phase.

## Test results after this phase

- `tsc --noEmit`: clean, 0 errors.
- `next lint`: 0 errors, 5 pre-existing warnings (unchanged, unrelated files).
- `next build`: webpack/TS compile step succeeds cleanly with the new files included (verified
  by temporarily stubbing the Google Fonts network call, which this sandbox can't reach — this
  is reverted, not a real change). Static-page prerender still needs real `.env.local` values
  (Supabase URL/key at minimum) to complete — same as before this phase, not a regression.
