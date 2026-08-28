# UFO Upgrade — Phase 5 Notes (Billing, Settings, Help, Reliability, Accessibility, Performance, Security)

Implements spec Sections 22 (Billing), 23 (Usage limits — already solid, no change needed), 25
(Settings), 26 (Help/Support), 27 (error/loading/empty states), 28 (toasts — already solid), 29
(confirmations), 30 (Accessibility), 31 (Performance), 32 (SEO — mostly already solid), 33
(Security), 43 (production quality bar). No existing route, table row, or working feature was
reset or removed. No new migration was needed this phase.

## Found and fixed a real bug: Cancel Subscription was invisible

`CancelSubscriptionButton` was imported into the billing page but **never rendered anywhere in
the JSX**. The free-plan card's own copy says "Cancel above to move to Free" — but there was no
"above." Paid users had no way to cancel from the billing page at all. Now rendered on the
current-plan panel (only shown when the user is actually on a paid plan), and upgraded to use
the Phase 1 `Modal` for the confirmation instead of an inline two-step toggle, matching every
other destructive-action confirmation built in Phases 2-4.

## Security (Section 33)

- Bumped `next` (and `eslint-config-next`) `14.2.5 → 14.2.35` — a patch-level release within the
  same minor version, zero breaking changes, confirmed via a clean `tsc`/lint/build afterward.
  This resolves the **critical**-severity advisory from the Phase 1 baseline audit and several
  highs.
- **Did not** force-upgrade to Next 16 (what `npm audit fix --force` offers for the remaining
  handful of lower-severity advisories) — that's a major version jump with real breaking-change
  risk across the App Router, well outside what an automated pass should do without a dedicated
  QA cycle. Documenting this as a deliberate, known residual: `npm audit` will still show a
  handful of moderate/high advisories tied to Next 14's line itself and a couple of transitive
  deps (`dompurify` via `monaco-editor`, `nanoid`) that only resolve via breaking upgrades.

## Accessibility (Section 30) — the light-mode contrast gap flagged since Phase 1

Most components set explicit `text-white/NN` utility classes rather than inheriting the page's
text color, so the `html.light body { color: ink }` rule from the original theme toggle never
reached them — light mode was rendering white-on-paper text across most of the dashboard,
functionally invisible. Editing the ~270 call sites individually across dozens of files would've
been slow and error-prone, so this fixes it once at the CSS layer: every `text-white` variant
actually used in the codebase (13 distinct opacity levels, enumerated by grepping the whole
tree) is remapped to the same opacity against ink instead of white, scoped entirely to
`html.light` — dark mode (the default) is untouched.

- Two places legitimately need to **stay** white regardless of theme — a status pin marker and
  the account-menu avatar initial, both solid-colored circles where white text is the contrast
  choice, not a page-text inheritance — protected with `!text-white`, the same pattern the
  existing toast styling already used for the same reason.
- **Known scope boundary**: this fix covers the dashboard and everywhere else `text-white` is
  used (which is where light mode is actually reachable — the toggle only lives in Settings).
  The public marketing pages weren't individually audited for the same issue since they're
  outside where the toggle lives in practice; flagging rather than silently leaving unstated.

## Help & Support (Section 26)

- Built a real `/help` page: 8 genuine FAQ entries (accurate to what the product does today —
  e.g. explicitly says prototypes are shared via link, not hosted on your own domain, and that
  Figma export is "coming soon," not glossed over) using native `<details>/<summary>` disclosures
  — real keyboard/screen-reader accessibility for free, no custom accordion component needed.
  Links through to `/contact` for anything not covered.
- Sidebar and account-menu "Help & Support" links now point to `/help` instead of straight to
  `/contact`, added to the sitemap.

## Error / Loading / Empty States (Section 27)

- Added missing `loading.tsx` for the Projects list and Settings pages (Skeleton-based, matching
  the pattern already used for the Dashboard, AI Designer, Billing, and the project editor).
- Root-level `error.tsx`, `global-error.tsx`, and `not-found.tsx` already existed and were solid
  — no change needed there.
- Billing's "No payments yet" plain text swapped for the Phase 1 `EmptyState` component, for the
  same visual consistency reason as everywhere else this phase.

## Performance (Section 31)

- Monaco (`@monaco-editor/react`) is one of the largest dependencies in this project and was
  statically imported into the project editor, meaning its JS loaded on every editor page visit
  even if you never opened the Code tab. Code-split it with `next/dynamic` (`ssr: false`, with a
  Skeleton placeholder) — it now only loads when the Code tab is actually opened.
- Left the two remaining `<img>` lint warnings (QR code, screen thumbnail) as plain `<img>`
  deliberately: both are small, one is a client-generated data URL and the other is a nullable
  dynamic source — `next/image` needs known dimensions or a configured remote pattern to do
  anything useful, and forcing it here would trade a soft lint suggestion for real risk of
  broken rendering, for negligible benefit on these particular images.

## Referrals / Confirmations consistency pass

- No new functionality here — confirmed the account-deletion flow (`DangerZone`, "type DELETE to
  confirm") was already a stronger pattern than a modal for the highest-stakes destructive
  action in the app and left it as-is.

## Test results after this phase

- `tsc --noEmit`: clean, 0 errors.
- `next lint`: 0 errors, same 6 pre-existing warnings as Phases 3-4 (no new ones).
- `next build`: webpack/TS compile succeeds, all **46** routes generate (was 45 — the new `/help`
  page). Static-export failures are the same pre-existing set as every prior phase's baseline,
  plus `/help` failing for the identical reason `/contact` already did (same Nav/Footer chrome,
  same missing-Supabase-env cause in this sandbox) — not a new problem.
- Re-ran `npm audit` after the Next.js bump: critical-severity advisory is gone; documented the
  remaining ones above rather than force-upgrading past them.

---

# All 5 phases — summary

| Phase | Focus | Zip |
|---|---|---|
| 1 | Audit + centralized design system (Input, Select, Badge, Modal, Drawer, Tabs, Tooltip, Dropdown, Skeleton, EmptyState, ErrorState, semantic colors) | UFO-PHASE1-design-system.zip |
| 2 | Dashboard real stats, full project management (rename/duplicate/favorite/archive/delete), AI generation honesty pass, accessible notifications | UFO-PHASE2-dashboard-projects.zip |
| 3 | Persistent AI edit history, editor cohesion fixes, component library, working template system | UFO-PHASE3-ai-designer-editor.zip |
| 4 | Real publishing metadata, full collaboration (click-to-pin, resolve, replies), sharing metadata, export clarity, referral stats | UFO-PHASE4-publish-collab-sharing.zip |
| 5 | Fixed invisible Cancel Subscription bug, security patch, site-wide light-mode contrast fix, Help Center, missing loading states, editor bundle-splitting | UFO-PHASE5-final.zip (this one) |

**Real bugs found and fixed along the way** (beyond the spec's planned feature list): missing
cascade-delete on both projects and screens (would throw a hard 500 on delete), a duplicated
device-switcher/fullscreen control in the editor, three separate instances of a `\u2026`-style
JS escape sitting inside bare JSX literals (silently rendering literal backslash-text instead of
the intended character), and the invisible Cancel Subscription button above.

**Real gaps identified and explicitly not built**, because building them would have meant
inventing backend that doesn't exist or fabricating controls that don't persist anywhere (per
the spec's own Section 47 rule): Asset management (no storage backend), Analytics (no tracking
backend), a true visual style-property inspector (screens are raw HTML strings, not a component
tree), real mid-generation cancellation (no server-side abort wiring), and the full ten-category
template gallery (3 real ones were built; the rest is content-authoring, not engineering).

Every phase was independently tested (`tsc` + `next lint` + `next build`) before moving to the
next, with each phase's build confirmed against the same pre-existing baseline failures (missing
Supabase credentials and blocked Google Fonts access — both sandbox-only, unrelated to the code)
so real regressions would have been caught if introduced.

## Final integrity pass (after all 5 phases were reported done)

Doing a full sweep before calling this final confirmed a few more things worth fixing rather
than leaving quietly:

- **Swept the entire codebase** (not just files touched this project) for the `\u2026`-in-bare-
  JSX-literal bug found three times across Phases 3-4. Found a **fourth instance** in
  `chat-widget.tsx` (a file never touched in any phase) — fixed.
- **Every Phase 1 design-system component now has a real caller.** Two were built but never
  wired in anywhere: `ErrorState` and `Drawer`. Rather than ship unused files:
  - **Found a real, serious gap while investigating `Drawer`'s absence**: the dashboard sidebar
    is `hidden md:flex` — below that breakpoint there was **no navigation at all**. No hamburger
    menu, no bottom bar, nothing. A mobile visitor had no way to reach Projects, Templates,
    Billing, or Settings except typing the URL directly. Built `MobileNav` (using `Drawer`) and
    wired a hamburger button into `Topnav`, mobile-only (`md:hidden`), containing the same nav
    structure as the desktop sidebar.
  - **Wired `ErrorState` into a new `app/dashboard/error.tsx`.** Previously, an error anywhere
    under `/dashboard` bubbled all the way to the root `app/error.tsx`, which replaces the whole
    screen — including the sidebar and topnav, so the only way out was a full reload. The new
    dashboard-scoped boundary renders inside `DashboardLayout`, so the sidebar stays usable while
    the broken page shows a real retry option.
- Re-ran the full `tsc` + `next lint` + `next build` pass after these additions: still clean, 0
  lint errors, same 6 pre-existing warnings, all 46 routes generate, and the static-export
  failure list is byte-for-byte identical to every prior phase's baseline.

**Before deploying**: run all 5 migrations in order (`001` through `005`) against your real
Supabase project — none of them were applied here since this sandbox has no live database, only
validated for correct SQL structure and, where checkable, JSON payload correctness.
