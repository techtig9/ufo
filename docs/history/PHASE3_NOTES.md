# UFO Upgrade — Phase 3 Notes (AI Designer, Editor, Templates)

Implements spec Sections 11 (AI Designer), 12 (Visual Editor), 13 (Responsive Preview), 14
(Page Management), 15 (Component Library), 16 (Template System), 17 (Asset Management — gap
re-flagged, not built). No existing route, table row, or working feature was reset or removed.

## Migration `004_ai_history_and_templates.sql`

- `screen_versions.instruction` / `.source` (`'manual'|'ai'`) — additive. Lets a version record
  *why* it was created instead of just what changed.
- `templates.description` / `.screens` (jsonb) — additive. The table previously had nowhere to
  put actual template content (category/name/thumbnail only), so "Use this template" had
  nothing to copy.
- Seeds **3 real, working templates** (SaaS Landing, Personal Portfolio, Small Business — 2
  screens each, real HTML/Tailwind, hotspot-linked). This is a starting set, not the full
  ten-category gallery the spec lists — the rest is content-authoring (writing real per-category
  HTML), not an engineering blocker, and I didn't want to ship 7 more categories of thin
  placeholder content just to hit a number.

## AI Designer (Section 11) — persistent AI memory (Section 36)

- The Design Copilot's edit history was session-only before (lost on reload). It now loads real
  history from `screen_versions` where `source='ai'` on screen change, and both the proposal-
  apply step and the version list use the new columns — so "AI Memory" is now backed by data
  that survives a reload, using the versioning system that already existed instead of a new
  parallel chat-log table.
- Added a live "credits remaining" readout next to the per-edit cost badge (real number from
  `/api/account/plan`, refreshed after each generation).
- **Found and fixed two real rendering bugs** while in this file: a placeholder and a checkmark
  used `\u2026`-style JS escapes directly inside bare JSX attribute/text literals, which don't
  interpret escapes (same bug class the repo's own changelog says it scanned for and fixed 10
  instances of — these two just weren't caught). Replaced with literal characters.
- **Did not** add a "Stop" control on the AI edit call, same reasoning as Phase 2's generation
  screen: `/api/projects/:id/ai-edit` has no server-side abort wiring, so a button couldn't
  honestly stop it.

## Visual Editor & Responsive Preview (Sections 12, 13)

- Important architecture note: screens are complete, raw HTML/Tailwind strings rendered in a
  sandboxed iframe — there's no component tree or structured style model. A real property
  inspector (text/font/color/spacing controls that write back to specific elements) would need
  either a structured design-token-driven renderer or a DOM-diffing visual editor — both are
  significant new architecture, not a frontend pass. I didn't fabricate sliders that don't
  persist anywhere real; the Monaco code editor plus the AI Copilot are the two things that
  actually persist changes today, per Section 12's "only expose controls that can actually be
  persisted."
- **Found and fixed a real UI bug**: the device-mode switcher and the fullscreen button were
  both rendered twice — once by `CanvasToolbar`, once by `DeviceFrame`'s own built-in pills
  (and `PrototypeViewer`'s own fullscreen button). `DeviceFrame` now hides its internal switcher
  whenever a parent controls the device mode, so the standalone public prototype viewer (which
  has no external toolbar) is unaffected.
- Added a **real Zoom control** (50/75/100/125%) in the canvas toolbar for mobile/tablet frames
  — genuine CSS-transform scaling of the actual frame, not decorative. Left at a fixed 100% for
  desktop, since desktop's frame is fluid-width and there's no honest fixed base to scale from
  without more plumbing than this warranted.

## Page Management (Section 14)

- This was already fully built (add/rename/duplicate/delete/reorder). Replaced the native
  `window.prompt`/`window.confirm` dialogs with the Phase 1 `Modal`/`Input` components, so
  screen rename/delete match the same styled, accessible pattern as project rename/delete from
  Phase 2 (delete now names exactly what's being removed, per Section 29).
- **Found and fixed a real bug**: screen delete had the same missing-cascade problem project
  delete had in Phase 2 — no `ON DELETE CASCADE`, no owner-delete policy on `comments` — so
  deleting any screen with existing version history or comments would have failed with a
  foreign-key error. Fixed with the same verify-ownership-then-admin-cascade pattern.

## Component Library (Section 15)

- Added a real 14-snippet library (`lib/component-snippets.ts`: Navbar, Hero, Features,
  Testimonials, Pricing, FAQ, CTA, Contact form, Gallery, Team, Stats, Logo cloud, Cards,
  Footer) and an "Insert component" control in the Code Editor toolbar. Insertion uses Monaco's
  real cursor position and goes through the exact same Save path as any hand-edit — genuinely
  persisted, not a decorative palette.

## Template System (Section 16)

- Built the missing backend: `POST /api/templates/:id/use` copies a template's screens into a
  new project (same create-project-and-share pattern `/api/generate` uses, minus the AI call —
  so **no credits are charged**, which the template cards now say explicitly). Rate-limited the
  same way other project-creation routes are.
- Templates page now renders real cards with descriptions and a working "Use this template"
  button that creates the project and opens it.

## Asset Management (Section 17) — still a gap, not built

- Restating from Phase 2: no Supabase Storage bucket or asset table exists anywhere in this
  codebase. Nothing added here either — still needs real backend work before a frontend page
  can honestly exist.

## Test results after this phase

- `tsc --noEmit`: clean, 0 errors.
- `next lint`: 0 errors. 6 warnings (was 5) — one new `exhaustive-deps` warning on the AI-history
  effect in `ai-design-copilot.tsx`, same intentional pattern as the pre-existing warning in
  `version-history-panel.tsx` (depending on `screen?.id` rather than the whole `screen` object
  is deliberate — including the full object would refetch history on every keystroke, not just
  on switching screens).
- `next build`: webpack/TS compile succeeds, all 45 routes generate; the static-export failures
  are the exact same set as the Phase 1 baseline (missing Supabase env in this sandbox) —
  confirmed identical before/after, no regressions.
- Verified the 3 seeded templates' JSON payloads parse correctly (structural check on the
  migration SQL, since this sandbox has no live Postgres to apply it against).
