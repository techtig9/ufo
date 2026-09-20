# UFO Upgrade — Phase 2 Notes (Dashboard + Project Management)

Implements Section 45/Phase 5 area plus spec Sections 7 (AI generation experience), 8
(Dashboard), 9 (Project Management), 24 (Notifications). No existing route, table row, user,
or working feature was reset or removed — only additive changes.

## Backend work identified and built (per Section 47: identify → build → then wire UI)

The spec asks for full project management (rename/duplicate/archive/delete) but the codebase
only had `duplicate` wired. Rename/archive/delete had no API route at all, and delete wasn't
even safely possible — the schema has no `ON DELETE CASCADE` and `comments` has no owner-delete
RLS policy, so a naive delete would have thrown a foreign-key error. Built:

- **Migration `003_project_management.sql`** — adds `projects.archived_at` (additive only).
- **`app/api/projects/[id]/route.ts`** (new) — `PATCH` for rename / favorite toggle / archive
  toggle (ordinary user-scoped client, existing RLS policies cover it); `DELETE` does a real
  cascade (comments → screen_versions → screens → shares → project) using the admin client,
  but only *after* verifying ownership with the caller's own session first — same
  verify-then-admin-write pattern already used by `lib/rate-limit.ts`.

## Dashboard Overview (Section 8)

- Added real stat cards: **Projects**, **Published**, **AI generations this cycle**, **Credits
  remaining**. The generations count is exact, not estimated — every `/api/generate` call
  already writes a `request_log` row (`route: 'generate'`), so this counts real rows since
  `credits_reset_at`, read via the admin client (that table has no user RLS policy) but scoped
  to the signed-in user only.
- Added a quick-actions row (Browse templates / + New Project) alongside the existing
  onboarding checklist and credit bar.
- Recent projects and the project count now exclude archived projects.
- Replaced the ad-hoc empty-project text with the Phase 1 `EmptyState` component.
- `loading.tsx` skeleton updated to match the new layout, using the Phase 1 `Skeleton`
  primitives instead of raw `shimmer` divs.

## Project Management (Section 9)

- **Project cards** now have a real actions menu (Phase 1 `Dropdown`): Rename (Modal + Input),
  Duplicate (existing route), Favorite/unfavorite, Archive/Restore, Delete — delete requires
  confirmation in a Modal naming exactly what gets removed, per Section 29.
- **Projects page**: added sort (Newest / Oldest / Name A–Z) and an **Archived** tab (with a
  live count) alongside All/Favorites — archived projects are hidden from the default view, not
  deleted, and can be restored any time. Search/filter empty states now use `EmptyState`.

## AI Generation Experience (Section 7)

- The existing loading screen already followed the spec's honesty rule (single accurate
  message, no fabricated stage checkmarks). Added a **real elapsed-seconds counter** (ticking
  off actual `Date.now()`, not a fake progress bar) — genuine information, not a new claim.
- **Did not** add a "Cancel generation" control: `/api/generate` is a single request/response
  with no server-side abort wiring, so a client-side cancel button couldn't actually stop the
  AI call or guarantee credits aren't charged — building that button would have been the kind
  of overstated claim Section 34 explicitly warns against. Flagging real cancellation as backend
  work for a future pass (would need a streaming/abortable generation endpoint).

## Notifications (Section 24)

- Rebuilt as a proper menu: `role="menu"`, closes on outside-click/Escape (previously neither),
  `aria-haspopup`/`aria-expanded`/`aria-controls` on the trigger.
- Added **Mark all read** (new `markAll` branch on the existing `PATCH /api/notifications`,
  same ownership-scoped update it already did per-notification).
- Added category badges (Phase 1 `Badge`) driven by the real `type` column already on the
  `notifications` table — no new schema needed.
- Empty state now uses the Phase 1 `EmptyState` component.

## Topnav / Sidebar chrome

- The `⌘K` hint next to the project search shortcut was decorative — clicking it worked but the
  keyboard shortcut didn't exist. Wired a real `Cmd/Ctrl+K` listener so the hint is no longer
  misleading.
- Replaced the hover-only account menu (inaccessible via keyboard) with the Phase 1 `Dropdown` —
  same content (name, Settings, logout) plus a new Help & Support entry, fully keyboard-operable.
- Sidebar: added a **Help & Support** link (→ `/contact`, which already exists and works).

## Known backend gaps flagged, not built (per Section 47 — no invented features)

- **Assets** and **Analytics** sidebar items from Section 8's list were *not* added — there's no
  Supabase Storage asset library or page-view/analytics tracking anywhere in this codebase.
  Adding nav items pointing at nonexistent features would violate Section 44 ("do not fake
  analytics"). These need real backend work (a storage bucket + asset table; an analytics
  events table + collector) before a frontend page can honestly exist.
- Real mid-flight generation cancellation (see above).

## Test results after this phase

- `tsc --noEmit`: clean, 0 errors (unchanged from baseline).
- `next lint`: 0 errors, same 5 pre-existing unrelated warnings as Phase 1 baseline.
- `next build`: webpack/TS compile succeeds, all 45 routes generate; static-export step fails
  on the *same* set of pages as the Phase 1 baseline (auth/legal/admin/contact/home — all
  because this sandbox has no real Supabase project configured), confirmed identical
  before/after this phase's changes — no regressions introduced.
