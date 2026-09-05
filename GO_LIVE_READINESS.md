# Go-live readiness — what's done, and what needs you

Phases 1–4 are complete and verified. Three things remain that **only you can
do**, because they need access or facts this environment does not have. Each
now has tooling so it is one command and independently verifiable.

---

## 1. Apply the pending database migrations — **required, P0**

Migrations **007 through 013** are written, tested and committed, but have
**not been applied anywhere**. Until they run, these problems remain live:

| Migration | Fixes | If not applied |
|---|---|---|
| **007** | `public.templates` has **no RLS** | Anyone holding the public anon key — which ships in the browser bundle — can INSERT/UPDATE/DELETE templates, and `/api/templates/[id]/use` copies those rows into user projects |
| **008** | Credit deduction is **not atomic** | Two concurrent generations charge once for two. Also adds the AI provider, credit-ledger and email-delivery logs |
| **009** | Saved prompts | The saved-prompt endpoints 500 |
| **010** | Workspaces, roles, invitations; share expiry and passwords | Every workspace, member, invite and share-settings endpoint 500s, and share passwords are accepted by the UI but never enforced |
| **011** | Comment mentions and assignment | Mentions are parsed but never recorded or delivered. Also closes a hole where a workspace viewer could rewrite anyone's comment text through PostgREST |
| **012** | Project assets on Supabase Storage | The asset library 500s. Also creates the **private** `project-assets` bucket and its object policies — without them, files would be unreachable, and a misconfigured public bucket would be readable by URL forever |
| **013** | Publish log and prototype view analytics | The publishing panel shows nothing |

### Run it

```bash
# Supabase → Project Settings → Database → Connection string → URI
# Use the SESSION pooler or a direct connection (the transaction pooler
# does not support all DDL).
export DATABASE_URL='postgresql://...'

npm run db:apply -- --dry-run   # shows exactly what will run
npm run db:apply                # applies 007 through 013
npm run db:verify               # confirms the fixes are actually in effect
```

For a brand-new database, `npm run db:apply -- --all` applies `schema.sql`
plus all thirteen migrations.

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

Verified against a database in your current production state (schema + 001–006):

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
| `npm test` | 170 / 170 |
| `npm run test:db` | 78 assertions |
| `supabase/tests/concurrency_test.sh` | credit race reproduced on old path, absent on new |
| `npm run test:browser` | 13/13 behaviour · 180 responsive · 12/12 a11y · contrast AA both themes · 7/7 palette · 17/17 inspector |
