# Go-live readiness — what's done, and what needs you

Phases 1–5 are complete and verified. The database migrations are now applied
and independently verified against the live Supabase project (section 1). Two
things remain that **only you can do**, because they need access or facts this
environment does not have — plus two one-click settings in the Supabase and
Vercel dashboards (section 4).

---

## 1. Database migrations — **DONE, applied and verified**

**Applied to the live Supabase project `ohottxdcwycrbrsenboh` on 2026-09-06.**
Migrations 006a through 015 all ran; `db:verify`'s checks were then re-run
against the live database and returned **0 failed, 29 passed**, and the
`project-assets` bucket was confirmed private, 25 MB-capped, with its three
`storage.objects` policies in place.

That database's schema had been applied by hand, so parts of 001–005 were
missing (`comments.resolved`, `comments.parent_id`, `shares.published_at`, the
`notifications` table) and migration 011 failed outright on it. Migration
**006a** backfills exactly those pieces and is a no-op where 001–005 really
ran. Migrations **014** and **015** came out of the Supabase advisors run after
the DDL landed — see the table below.

This section is kept because the same commands apply to any *other* environment
(staging, a fresh project) that is still on the old schema. What each migration
fixes:

| Migration | Fixes | If not applied |
|---|---|---|
| **006a** | Backfills the parts of 001–005 a hand-applied schema misses | Migration 011 fails outright (`column "resolved" of relation "comments" does not exist`), and `/api/shares/publish` and `/api/notifications` 500 |
| **007** | `public.templates` has **no RLS** | Anyone holding the public anon key — which ships in the browser bundle — can INSERT/UPDATE/DELETE templates, and `/api/templates/[id]/use` copies those rows into user projects |
| **008** | Credit deduction is **not atomic** | Two concurrent generations charge once for two. Also adds the AI provider, credit-ledger and email-delivery logs |
| **009** | Saved prompts | The saved-prompt endpoints 500 |
| **010** | Workspaces, roles, invitations; share expiry and passwords | Every workspace, member, invite and share-settings endpoint 500s, and share passwords are accepted by the UI but never enforced |
| **011** | Comment mentions and assignment | Mentions are parsed but never recorded or delivered. Also closes a hole where a workspace viewer could rewrite anyone's comment text through PostgREST |
| **012** | Project assets on Supabase Storage | The asset library 500s. Also creates the **private** `project-assets` bucket and its object policies — without them, files would be unreachable, and a misconfigured public bucket would be readable by URL forever |
| **013** | Publish log and prototype view analytics | The publishing panel shows nothing |
| **014** | Closes five server-only helpers to the public API | Any signed-in user could call `/rest/v1/rpc/refund_credits` and top up their own credit balance for free; `project_storage_used` leaked another tenant's storage total |
| **015** | RLS evaluates `auth.uid()` once per statement, not once per row; covering indexes for 12 foreign keys | Every policy check re-runs `auth.uid()` for each candidate row — fine at 100 rows, not at 100,000 |

### Run it

```bash
# Supabase → Project Settings → Database → Connection string → URI
# Use the SESSION pooler or a direct connection (the transaction pooler
# does not support all DDL).
export DATABASE_URL='postgresql://...'

npm run db:apply -- --dry-run   # shows exactly what will run
npm run db:apply                # applies 006a through 015
npm run db:verify               # confirms the fixes are actually in effect
```

For a brand-new database, `npm run db:apply -- --all` applies `schema.sql`
plus all fifteen migrations.

**Take a backup first** (Supabase → Database → Backups). The migrations are
written to be re-runnable, and a repeat run was verified to be a clean no-op,
but that is not a substitute for a backup.

### What `db:verify` checks

It checks the **result**, not that a file ran — whether `templates` is
genuinely RLS-protected, whether `reserve_credits()` exists, whether webhook
replays can be deduplicated. It only reads catalog metadata, so it is safe
against production, and it exits non-zero so it can gate a deploy.

It now covers Phase 4 too — whether the asset bucket is private and
size-capped, whether `comment_mentions` is client-writable, whether a comment
body can be rewritten by a client.

Verified against a database in the pre-migration production state (schema + 001–006):

```
RESULT: 24 failed, 5 passed        ← before      BUCKET: 2 failed, 0 passed
RESULT:  0 failed, 29 passed       ← after       BUCKET: 0 failed, 2 passed
```

That is **26 failing checks before, 0 after**, measured by applying the real
`scripts/apply-migrations.sh` to a fresh database built from `schema.sql` plus
migrations 001–006 — your current production state. A second run of the script
against the same database was verified to be a clean no-op.

---

## 2. Configure company details — **required before launch**

Nine files shipped placeholder copy to production pages, including the **Terms
and Privacy** pages: `[Your Name / Agency Name]`, `[your contact email]`,
`[date]`, `[your jurisdiction]`.

These are now read from the environment. They were **not invented** — a legal
entity name, governing jurisdiction and contact address are facts about your
business, and fabricating them on legal documents would be worse than an
obvious gap.

Set these six variables in your deployment environment:

```bash
UFO_COMPANY_LEGAL_NAME=        # e.g. "TechTig Ltd" — appears in the Terms
UFO_COMPANY_DISPLAY_NAME=      # e.g. "TechTig" — footer and About
UFO_COMPANY_CONTACT_EMAIL=     # support and legal notices
UFO_COMPANY_JURISDICTION=      # governing law, e.g. "England and Wales"
UFO_LEGAL_EFFECTIVE_DATE=      # "Last updated" on the legal pages
UFO_LAUNCH_DATE=               # shown on the changelog
```

`npm run preflight` **warns locally and fails under CI or
`NODE_ENV=production`** while any is empty, so a build cannot ship placeholder
legal copy unnoticed. An unset value renders as `— not set —` rather than an
empty string, so a gap reads as a gap.

Verified end to end: with the variables set, all six pages render the real
values and no placeholder text remains anywhere.

---

## 3. Figma design files — **optional, gates a Phase 3 redo only**

I have checked the connector every session. It exposes **93 resources, all of
them Figma's own skills and docs — no design files**, and every read tool
(`get_design_context`, `get_metadata`, `get_variable_defs`, `get_libraries`,
`search_design_system`) requires a `fileKey`. There is no file-enumeration
tool, and the account seat is **View** on a **starter** tier, which does not
carry shared-library access.

Phases 3 and 4 therefore proceeded from the code-side token foundation proposed
in the audit and approved. That work stands on its own — 602 utilities migrated onto
semantic tokens, and contrast measured from 181 failures to 0.

If you want it re-derived from a real design system, paste one Figma **file
URL** per candidate (`https://figma.com/design/<fileKey>/...`) and I will do
the comparison the spec asks for, then map that file's variables into the same
token contract. Only the values would change, not the architecture.

---

## 4. Two dashboard settings — **one click each**

Neither can be changed from here: there is no API in the tooling this
environment has for either one.

**Supabase → Authentication → Policies → enable leaked password protection.**
The security advisor reports it as off. With it on, Supabase checks new and
changed passwords against HaveIBeenPwned's k-anonymity API and rejects the ones
that appear in a known breach. It is the single highest-value auth setting UFO
is not using, and it costs nothing.

**Vercel → the project → Settings → Environment Variables.** The four the
build needs are listed in `.env.example.vercel`; `npm run preflight` fails a
production build without them, deliberately, so the app can never ship pointing
at a placeholder database.

---

## Also worth knowing before launch

These are documented in the phase records rather than blocking:

- **`@supabase/ssr` is still 0.4.1.** Its `cookie` advisory is neutralised by
  an npm override, so `npm audit` is clean. Upgrading to 0.12.x replaces the
  whole cookie API in the auth layer and should be done where a real sign-in
  can be exercised.
- **Two editor components keep a scoped lint relaxation** — the editor cannot
  be exercised without credentials here, and refactoring it blind would risk
  working functionality.
- **Authenticated routes are not visually measured.** The contrast, responsive
  and accessibility sweeps cover the 10 public routes. Dashboard, editor,
  workspaces, billing, settings and admin use the same tokens, but that is
  inference.
- **The authenticated E2E suite is written and waiting.** `e2e/authenticated`
  skips with a stated reason until `UFO_E2E_EMAIL` and `UFO_E2E_PASSWORD` name
  a real account. Run it as soon as they do — it signs in through the real
  form and covers the dashboard, command palette, workspace creation, the
  settings toggles, and console errors across every authenticated route.
- **No error-tracking vendor is wired.** `reportError()` in
  `lib/observability.ts` forwards to a Sentry-compatible global at call time,
  so installing `@sentry/nextjs` and initialising it is all that is needed. No
  SDK was added blind: a half-wired one that silently drops events looks like
  error tracking is working.
- **Nothing has been verified against a live provider.** No Groq, Cerebras,
  OpenRouter, Anthropic, Paddle, Resend or Google OAuth credentials exist in
  this environment. A real generation, payment, email send, Google sign-in,
  file upload, signed download and recorded prototype view remain unverified
  and are not claimed anywhere in these notes.
- **Supabase Storage policies are proven against a stand-in.** The test
  harness gained a minimal `storage` schema so migration 012's policy block
  actually runs and is exercised as the real anon/authenticated roles. That
  proves the SQL and its authorisation logic; only a real project can show
  that Supabase's Storage API enforces them identically.
- **Legal copy was corrected in Phase 4** — Privacy and Terms named "Google
  Gemini" as the model provider long after the code moved to the four-provider
  cascade, and the Cookie Policy advertised an analytics category that does
  not exist. Please read the three legal pages before launch; they now
  describe what UFO actually does, but the company facts are still yours.

---

## Current verification state

| Gate | Result |
|---|---|
| `npm audit` | 0 vulnerabilities |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 11 warnings |
| `npm run build` | passes |
| `npm test` | 246 / 246 |
| `npm run test:db` | 83 assertions |
| `supabase/tests/concurrency_test.sh` | credit race reproduced on old path, absent on new |
| `npm run test:browser` | 13/13 behaviour · 180 responsive · 12/12 a11y · contrast AA both themes · 7/7 palette · 17/17 inspector · 9/9 UX audit |
| `npx playwright test` | 50 passed, 6 skipped (authenticated suite, no credentials) |
| `npm run test:perf` | 7/7 budget checks |
