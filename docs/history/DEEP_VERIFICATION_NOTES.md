# UFO Upgrade — Deep Verification Pass (real database testing, not just static analysis)

Every prior phase was tested with `tsc` + `next lint` + `next build`. That's static analysis —
it can't catch bugs that only appear when SQL actually runs against a real database under real
Row-Level-Security enforcement. This pass installed PostgreSQL 16 locally and did that.

## Critical bug found: pre-existing infinite RLS recursion — breaks every published prototype view

**This bug predates all 5 phases.** It was already in the original `schema.sql` from the
uploaded zip, before any change in this upgrade. It surfaced only now because this is the first
time policies were tested with RLS actually *enforced* (as a real non-superuser Postgres role)
instead of checked by reading their definitions or running queries as a superuser, which bypasses
RLS entirely and would never hit this.

**The bug:** `projects` has a policy ("public project via public share") that queries `shares`
to check visibility. `shares` has a policy ("owners manage their shares", covering all commands
including SELECT) that queries `projects` back. Postgres detects this as a genuine circular
dependency and refuses the query outright:

```
ERROR: infinite recursion detected in policy for relation "projects"
```

**Impact:** this fires for *any* visitor to a published prototype link who isn't its owner —
which includes every anonymous visitor and every other logged-in user. That's the primary way
`/proto/[slug]` is meant to be used. Verified with a real non-superuser role and RLS enforced:
the query failed before the fix and succeeded after, for both anonymous and logged-in-but-
different-user visitors — while still correctly hiding non-public projects from strangers
(privacy wasn't accidentally loosened by the fix).

**Fix (`supabase/migrations/006_fix_rls_recursion.sql`):** a `SECURITY DEFINER` helper function
(`is_project_publicly_shared`) that queries `shares` bypassing RLS internally, breaking the
cycle — the standard, Supabase-documented pattern for exactly this situation. Only the
`projects` side needed the fix; that's sufficient to break the cycle for every path through it
(`screens`, `screen_versions`, and `comments` all transitively depend on `projects`'s policy and
were re-tested individually below).

## Second bug found via the same testing, in this upgrade's own Phase 4 work

Deleting a top-level comment that has a reply violated the `comments_parent_id_fkey` foreign
key — real error, reproduced against real data:

```
ERROR: update or delete on table "comments" violates foreign key constraint
"comments_parent_id_fkey" on table "comments"
DETAIL: Key is still referenced from table "comments".
```

`DELETE /api/comments/[id]` deleted only the target row; if a reply pointed at it, the delete
failed. Fixed by deleting replies (`WHERE parent_id = :id`) before the parent, in the same
route. Re-verified against real data: parent+reply now both delete cleanly.

Checked whether the *other* two cascading-delete routes built in Phases 2-3 (project delete,
screen delete) have the same problem — they don't, and here's why: those delete every comment
for a screen/project in a **single bulk `DELETE ... WHERE screen_id = X`** statement, which
matches a parent and its reply together in one command. Tested that pattern directly against
real data too — Postgres handles same-statement self-referential deletes correctly, no fix
needed there. Only the single-comment delete route (which targets one specific row, leaving a
possible reply outside that command) had the bug.

## Full verification methodology

1. Installed PostgreSQL 16 locally, applied `schema.sql` then all 6 migrations in order —
   all succeeded cleanly against a real database (this alone is stronger than the earlier
   phases' SQL-structure-only checks for migrations 004 and 005).
2. Queried the resulting table structures directly — confirmed every column, constraint, and
   RLS policy this upgrade added actually exists with the right shape.
3. Verified the 3 seeded templates' JSON content is valid and query-able (`jsonb_array_length`,
   extracting screen names) — not just "the INSERT didn't error."
4. Ran a full realistic lifecycle through real SQL matching exactly what the API routes do: user
   → project → screens → a version with the new `instruction`/`source` columns → a comment → a
   reply with the new `parent_id` column → the "use template" project-creation flow. All
   succeeded.
5. Tested every cascading-delete route's exact SQL sequence (screen delete, project delete) —
   confirmed no foreign-key violations, including the harder case (deleting a screen that has
   both version history and a comment+reply).
6. **Created real non-superuser Postgres roles and re-ran the security-sensitive checks with
   Row-Level Security actually enforced** — not just "the policy exists," but "the policy
   correctly allows the owner and denies everyone else." This is what caught both bugs above;
   neither would show up in `tsc`, lint, a production build, or a superuser-run SQL check.
7. Swept the whole codebase (not just files touched by a given phase) once more for the
   `\u2026`-in-bare-JSX-literal bug pattern from earlier phases — no further instances found
   this time (the sweep in the prior response already caught the last one, in `chat-widget.tsx`).
8. Re-ran `tsc` + `next lint` + `next build` after the two fixes above — clean: 0 type errors,
   0 lint errors (same 6 pre-existing warnings, unchanged), all 46 routes compile, and the
   static-export failure list is still byte-for-byte the sandbox's Supabase-env baseline.

## What this means for you

Run migrations `001` through `006` in order against your real Supabase project (not just
`001`-`005` as noted previously — `006` is new and critical). Everything from `schema.sql`
through `006` has now been verified by actually executing it against a real PostgreSQL database
with realistic data and, for the security-sensitive parts, real non-superuser role enforcement —
not only read for syntax.
