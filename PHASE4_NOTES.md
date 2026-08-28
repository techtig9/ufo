# UFO Upgrade — Phase 4 Notes (Preview, Publishing, Collaboration, Sharing, Export, Referrals)

Implements spec Sections 18 (Preview — already solid, see note), 19 (Version History —
completed in Phase 3), 20 (Publishing), 21 (Analytics — gap re-flagged, not built), 37
(Collaboration), 38 (Sharing), 39 (Export), 40 (Referrals). No existing route, table row, or
working feature was reset or removed.

## Migration `005_publishing_and_collaboration.sql`

- `shares.published_at` — additive. Tracks "last published" separately from the `is_public`
  toggle (unpublishing doesn't erase when it was last live).
- `comments.parent_id` — additive, self-referencing. One level of replies (a reply's parent
  can't itself have a parent), matching the spec's plain "replies" ask rather than deep threads.
- **New RLS policies for `comments`**: there was no UPDATE or DELETE policy on `comments` at
  all — only public read/insert. That meant even the project owner couldn't resolve or moderate
  a comment on their own prototype. Added owner-scoped update/delete policies (checked through
  `shares → projects.user_id`), so resolve/delete now work through the normal user-scoped
  client — no admin client needed for this one.

## Publishing (Section 20)

- `ProjectToolbar` now shows **"Last published Xh ago"** next to the Publish/Unpublish button,
  backed by the new `published_at` column (only set on publish, not on unpublish).
- Added an explicit **Copy link** action (was previously just a read-only code block with no
  copy button) and kept the existing QR code.

## Sharing (Section 38)

- Added `generateMetadata` to the public prototype page (`/proto/[slug]`) — real title/
  description/Open Graph/Twitter card tags, not decorative. Set `robots: noindex` deliberately:
  these are unlisted share links (like a Figma/Loom share URL), not pages meant to be
  search-indexed — happy to flip that if you'd rather they be crawlable.
- The Copy Link addition above also covers Section 38's "copy URL" ask.

## Collaboration (Section 37) — the biggest piece this phase

The comments system existed but was minimal: no resolve (despite the column already existing
in the schema since Phase-1-era migrations), no replies, no real pin position (every comment
was hardcoded to the center, per a comment in the code flagging it as a placeholder), and no way
for the owner to moderate anything.

- **Real click-to-pin**: an "📍 Add pin" toggle turns the live preview into a click target —
  clicking captures the click position as a percentage of the frame (not the fake 50/50
  default), and existing comments render as real position-accurate markers on the screen they
  belong to (green if resolved, coral if not). This works without reaching into the sandboxed
  iframe's contents — it's a transparent overlay over the frame, so it doesn't fight the
  existing `sandbox="allow-scripts"` isolation.
- **Resolve / reopen**: real toggle, owner-only (enforced by the new RLS policy, not just
  hidden in the UI), with a green "Resolved" badge and All/Unresolved/Resolved filter tabs
  (reused the Phase 1 `Tabs` component).
- **Replies**: one level, threaded visually under the parent comment.
- **Owner moderation**: delete on any comment or reply, owner-only.
- **Found and fixed a real bug** while in this file: a placeholder string used a `\u2026`
  JS-style escape directly inside a bare JSX attribute (same bug class as the two I fixed in
  Phase 3's AI Copilot) — replaced with the literal character.
- Ownership is determined server-side in the page (comparing the visitor's session, if any, to
  `projects.user_id`) — a random visitor to your published link never sees resolve/delete
  controls, only the visiting owner does.

## Analytics (Section 21) — still a gap, not built

No page-view/analytics tracking exists anywhere in this codebase (restating from Phases 2-3).
Still nothing to wire a real dashboard to.

## Export (Section 39)

- Export ZIP and Figma export were already honestly built/labeled (ZIP is real and functional;
  Figma is clearly marked "coming soon"). Added a tooltip on the ZIP button explaining exactly
  what's inside (HTML + PNG snapshot per screen + a style-guide.md) — Section 39 asks exports be
  "clearly labeled" with what they contain, and the button alone didn't say that.

## Referrals (Section 40)

- Settings page now shows a real **"N successful referrals so far"** count, queried from the
  existing `referrals` table (was previously invite-link-only, no visibility into results).

## Test results after this phase

- `tsc --noEmit`: clean, 0 errors.
- `next lint`: 0 errors, same 6 warnings as the end of Phase 3 (no new ones).
- `next build`: webpack/TS compile succeeds, all 45 routes generate; static-export failures are
  the exact same set as the Phase 1 baseline — confirmed identical, no regressions. `/proto/[slug]`
  isn't in that list either way (it's a dynamic route with no static params, so it isn't part of
  the static-export attempt).
- Validated the new migration's SQL structurally (balanced quotes/parens/`$$` blocks) since this
  sandbox has no live Postgres to apply it against directly.
