# Phase 1 — Foundation, Security, Authentication

Executed against `UFO_TechTig_Master_Command_v2.md`, Phase 1 (A: framework,
B: authentication, C: authentication email, D: security).

> The older `PHASE1_NOTES.md` … `PHASE5_NOTES.md`, `ROUND2/3_FIXES.md` and
> `FIXES_APPLIED.md` in this repo describe an **earlier, differently-numbered**
> effort. They are historical. This file is the record for the Master Command's
> Phase 1.

---

## How to re-run everything

```bash
npm install
npm audit                # expect: found 0 vulnerabilities
npm run typecheck        # app + tests
npm run lint             # expect: 0 errors
npm run build            # production build

npm test                 # 19 unit tests (node --test, native TS stripping)
npm run test:db          # 13 RLS tests against a throwaway local Postgres
npm run test:db -- --before   # reproduces the templates hole (should FAIL)

# browser suites need a running server:
npm run build && npm run start &
BASE=http://localhost:3000 npm run test:browser
```

`test:db` provisions its own Postgres in `/var/tmp/ufopg`. It never touches a
remote Supabase project.

---

## What changed and why

### A. Framework upgrade

`next` 14.2.35 → **16.3.4**, `react`/`react-dom` 18.3.1 → 19, `eslint` 8 → 9,
`eslint-config-next` → 16, React types → 19.

**`npm audit`: 11 vulnerabilities (7 high) → 0.** The high-severity set was all
in Next 14.2.35 — SSRF in Server Actions and in rewrites, cache confusion on
request bodies, unauthenticated disclosure of internal Server Function
endpoints, App Router Server Action DoS — plus four high PostCSS advisories via
its bundled copy. `npm audit fix` could not resolve them.

Two transitive advisories are pinned by their parents and were resolved with
npm `overrides` rather than risky major bumps:

| Package | Pinned by | Was | Now |
|---|---|---|---|
| `cookie` | `@supabase/ssr@0.4.1` | 0.6.0 | 0.7.2 |
| `dompurify` | `monaco-editor@0.56.0` | 3.4.8 | 3.4.14 |

An override was chosen over upgrading `@supabase/ssr` to 0.12.x because that is
the auth cookie layer and this environment has no credentials to runtime-test
a sign-in against it. **Deferred to Phase 2** — see Remaining Risks.

Breaking-change migrations performed:

- `cookies()` is async → `lib/supabase/server.ts` `createClient()` is now
  async; **38 call sites** await it; three `ReturnType<typeof createClient>`
  helper signatures became `Awaited<…>`.
- `params` is a `Promise` → **16 handler/page signatures across 11 files**.
- `experimental.instrumentationHook` removed from `next.config.js`.
- **`next lint` was removed in Next 16** → `npm run lint` calls the ESLint CLI;
  `.eslintrc.json` replaced by `eslint.config.mjs` (flat config).
- React 19 narrowed `ReactElement`'s props generic from `any` to `unknown`,
  breaking `cloneElement` in `components/ui/tooltip.tsx`.

### B. Authentication — the Google white page

**Root cause** (`app/auth/callback/route.ts`): the redirect ran
unconditionally, outside both the `if (code)` and `if (!error && data.user)`
blocks. When the code exchange failed, the route swallowed the error and
redirected to `/dashboard` anyway; middleware found no session and bounced to
`/login`. The user saw a flash and landed back where they started — no error
shown, nothing logged.

Now every failure path redirects to `/login?error=<code>&ref=<requestId>`:

| Code | Meaning |
|---|---|
| `oauth_provider_error` | Google itself refused (consent denied, misconfigured client) |
| `missing_code` | Callback arrived with no authorization code |
| `exchange_failed` | `exchangeCodeForSession` failed |
| `provisioning_failed` | Session created but the account could not be built |

Both Google buttons previously discarded `signInWithOAuth`'s error; they now
surface it and show a redirecting state.

`lib/auth-log.ts` instruments every step the Master Command lists (§7). Fields
are **allow-listed, not filtered** — a value can only be logged if deliberately
named safe, so the authorization code, tokens and sessions cannot leak through a
future edit. Allow-listed strings are additionally scrubbed for secret-shaped
content, because the Supabase error message is the one field whose content we
do not control.

### C. Authentication emails

All seven required event types: `SIGNUP`, `EMAIL_VERIFIED`, `PASSWORD_LOGIN`,
`GOOGLE_SIGN_IN`, `MFA_LOGIN_SUCCESS`, `PASSWORD_RESET_REQUESTED`,
`PASSWORD_CHANGED`.

The hard requirement was *"do NOT send duplicate emails when one authentication
flow triggers multiple callbacks"*. One sign-in legitimately produces several
signals (password resolve → MFA resolve → session refresh → remount). Rather
than suppressing at each call site, every event is written to `auth_events`
first and the email is sent **only when that write created the row**. Dedup uses
a `UNIQUE` time-bucketed `dedup_key`, so concurrent reports collide in the
database instead of both passing a read-then-write check; a look-back query
covers the bucket-boundary case.

`/api/auth/event` never trusts the caller's claim about who signed in — it
re-reads the session server-side. `PASSWORD_RESET_REQUESTED` is the one event
whose caller is by definition unauthenticated, so it always returns 202 with an
identical body whether or not the address exists (no user enumeration) and is
IP rate limited.

Security emails deliberately contain **no sign-in or reset link** — training
users to click login links in email is itself a phishing vector. Request
context is coarse by construction: IPs truncated to /24 or /48, User-Agent
reduced to `"Chrome on macOS"`.

New preference `users.notify_security_emails`, **default true**, in Settings →
Notifications.

**Fixed:** the welcome email said *"150 free credits"* while the Free plan
grants **1,500** — wrong by 10× in the first email a user ever receives. It now
reads `PLAN_MONTHLY_CREDITS`.

### D. Security

**The `templates` table had RLS disabled entirely.** `schema.sql` creates it,
but the `enable row level security` block covers only six other tables, and
migrations 001–006 never added it. Supabase grants `anon`/`authenticated` full
DML on public tables by default; RLS is the only revocation. Anyone with the
public anon key — which ships in the browser bundle — could INSERT, UPDATE or
DELETE templates. Because `/api/templates/[id]/use` copies `templates.screens`
verbatim into a new project, a planted row becomes a stored payload delivered
to every user who clicks "Use this template".

Proven, not asserted: `npm run test:db -- --before` reproduces it (anon plants a
row containing `<script>`, then deletes the entire catalogue).

Also closed:

| Finding | Fix |
|---|---|
| Open redirect via `next` | `lib/safe-redirect.ts` — same-origin paths only |
| Contact form HTML injection | `lib/escape-html.ts`, applied to all interpolation |
| `/api/contact` unmetered | IP rate limit (5/hr); honest 502/503 instead of a false success |
| `/api/comments` unmetered + IDOR | IP rate limit (20/10min); screen must belong to the share; reply parent must be same-share and top-level |
| `/proto` CSP contradiction | `frame-ancestors *` on that route only — embedding previously never worked |
| `CRON_SECRET` fail-open | Fails closed (503) when unset; constant-time compare |
| `/api/health` leaked DB errors | Logged, not returned |
| `postMessage` unvalidated | Origin and payload shape checked |

---

## Verification results

Every number below was produced by running the command, not by inspection.

| Gate | Result |
|---|---|
| `npm audit` | **0 vulnerabilities** (from 11, incl. 7 high) |
| `npm run typecheck` | **0 errors** (app + tests) |
| `npm run lint` | **0 errors**, 14 warnings |
| `npm run build` | **passes**, 46 routes |
| `npm test` | **19/19** |
| `npm run test:db` | **13/13**, 14/14 value assertions |
| `tests/browser/phase1.mjs` | **13/13** in real Chromium |
| `tests/browser/responsive.mjs` | **126 combinations**, 0 failures |
| `tests/browser/a11y.mjs` | **12/12** |
| Route smoke | **19/19** |
| API authorization matrix | **18/18** reject unauthenticated |

Responsive sweep covers 320/375/390/430/768/1024/1280/1440/1920 px × light and
dark × 7 routes, asserting no horizontal overflow, correct theme application
and no console errors.

---

## Remaining risks

1. **No live-credential verification.** This environment has no Supabase,
   Paddle, Resend, Groq or Google OAuth credentials, and the connected Supabase
   account contains two unrelated projects — UFO's database is not reachable.
   A real Google sign-in, a real Resend delivery and live RLS enforcement are
   **not** verified. The RLS work is verified against a local Postgres
   reproducing Supabase's roles and default privileges, which is strong but not
   the same as the production project.

2. **Migration 007 has not been applied anywhere.** It must be run before the
   `templates` hole is actually closed in production, and before any auth email
   can send (`auth_events` and `notify_security_emails` are required).

3. **`@supabase/ssr` is still 0.4.1.** The `cookie` advisory is neutralised by
   an override, but the package is from the Next 14 era. Upgrading to 0.12.x
   (which replaces `get`/`set`/`remove` with `getAll`/`setAll`) is Phase 2 work
   that should be done where a sign-in can actually be exercised.

4. **Six components carry a scoped lint relaxation.** `eslint.config.mjs`
   downgrades `react-hooks/set-state-in-effect` and `react-hooks/refs` to
   `warn` for six editor/generator components — pre-existing patterns surfaced
   by the plugin's v7 rules, not behaviour changes. The rules remain errors
   everywhere else. Removal is tracked for Phase 3, which owns those files.

5. **Not in Phase 1, still open** (carried from the audit): non-atomic credit
   deduction and missing Paddle webhook idempotency (Phase 2 — the
   `webhook_events` table is already in place), the dead `⌘K` control in the
   top nav, the hardcoded dark chrome in sidebar/topnav, and the Figma-export
   plan-copy honesty question (Phase 3/4).
