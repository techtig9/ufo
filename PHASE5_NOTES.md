# Phase 5 — QA, performance, observability, final release

Executed against `UFO_TechTig_Master_Command_v2.md` Phase 5.

Phase records: `PHASE1_UPGRADE_NOTES.md`, `PHASE2_NOTES_V2.md`,
`PHASE3_NOTES_V2.md`, `PHASE4_NOTES.md`, this file.

---

## How to re-run

```bash
npm audit && npm run typecheck && npm run lint && npm run build
npm test              # 246 unit
npm run test:db       # 83 database assertions
./supabase/tests/concurrency_test.sh
npm run preflight

npm run build && npm run start &
BASE=http://localhost:3000 npm run test:browser   # 7 suites incl. the UX audit
BASE=http://localhost:3000 npm run test:perf
npx playwright test
```

Authenticated E2E is written and committed but skips unless credentials exist:

```bash
UFO_E2E_EMAIL='you@example.com' UFO_E2E_PASSWORD='...' npm run test:e2e
```

---

## A. Playwright

`@playwright/test` with a config and 56 specs, split by what they need.

**`e2e/public` — 50 tests, no credentials required.** Every header, nav and
footer link is fetched and must not 4xx/5xx. The callback error banner is
checked for all four failure codes. The invitation token is followed through
login and signup. A missing and a malformed prototype slug must answer
identically, and the unlock endpoint must return one byte-identical response
to every failure so it cannot be used as a slug oracle. 22 authenticated
endpoints are called with no session and must 401/403 — RLS would still refuse
the query, but a route that returns 200 with an empty body hides the mistake
from everything except a test like this.

**`e2e/authenticated` — 6 tests that skip with a stated reason.** They sign in
through the real form rather than injecting a cookie. Stubbing a session and
asserting against the stub would produce a suite that passes while proving
nothing about whether sign-in works — worse than no suite, because it looks
like coverage.

`retries: 0` deliberately: a test that only passes on a retry reports
something other than the truth.

## B. The eight areas

Existing coverage was audited first. The AI provider router was covered;
project authorization and RLS were covered **for reads**.

| Area | Added |
|---|---|
| Credits, plan gating | `tests/credits.test.ts` — 20 tests |
| AI provider router | already covered |
| Webhook signature validation | `tests/paddle-webhook.test.ts` — 13 tests |
| Auth callback | `tests/auth-callback.test.ts` — 13 tests |
| Project authorization | `rls_tests.sql` TESTS 14–18 — cross-user **writes** |
| RLS-sensitive operations | 83 assertions total |
| Email event deduplication | `tests/auth-events.test.ts` +8 |

Things worth calling out:

- **Plan gating is asserted to be categorical.** A blocked feature stays
  blocked however many credits are held — buying credits must not unlock a
  tier. Exactly-enough credits is allowed, because an off-by-one either blocks
  a paid-for action or gives one away.
- **The pricing cards are asserted against the enforced constants**, so the
  page cannot advertise a number the code does not honour.
- **Webhook verification is asserted to fail closed** when the secret is unset.
  A missing secret must never mean "accept everything".
- **Different auth event types must never share a dedup key** — otherwise a
  sign-in would suppress the password-changed warning that follows it, the one
  email a victim most needs to see.
- **Write authorization**, not just read. A read leak is serious; a write leak
  is unrecoverable.

## C. Performance

`npm run test:perf` measures, then checks a budget.

```
35 client chunks, 1315.8 KB on disk uncompressed
Public routes: 216–218 KB of JS over the wire (741.8 KB parsed)
TTFB 4–6 ms · FCP/LCP 144–208 ms · CLS 0
```

Lighthouse is deliberately not used: it is a large extra dependency, and on a
single unthrottled container its composite score mostly measures the
container. LCP and CLS are read from the browser's own `PerformanceObserver`
rather than a hand-rolled proxy, which is not the same measurement.

The budget checks what a regression looks like — total JS, JS per route,
CLS ≤ 0.1, LCP ≤ 2.5 s, **Monaco not loaded on a public page**, and no source
maps served. Thresholds are generous on purpose: a budget tight enough to fail
on noise is a budget that gets deleted.

> A bug in the first version of this file: it summed `Content-Length` and
> reported **1.9 KB** of JavaScript for a page loading over a megabyte. Next
> serves chunked, compressed responses with no `Content-Length`, so the check
> was passing because it measured nothing. It now reads `encodedBodySize` and
> fails explicitly on a zero measurement.

## C2. Observability

- **`lib/redact.ts`** — the credential scrubber, extracted so one definition
  covers every log line. Now also catches Groq, Paddle and Resend key shapes.
- **`lib/observability.ts`** — `log()` (one JSON line, scrubbed),
  `reportError()`, `timed()`, and `withObservability()` for route handlers.
- **Request correlation** — one id per request, honouring an upstream
  `x-request-id`, accepted only if it matches `[A-Za-z0-9_-]{6,64}`: it ends up
  in a log line, so an unbounded value from the internet is a log-injection
  vector. Verified live for all three cases.
- **`/api/health`** is now a real system check — database with latency, AI
  providers, email, billing — reporting **status only**, because it is
  unauthenticated by design. The detail goes to the log line.

**On Sentry:** no SDK is added as a dependency. It needs a DSN and runtime
config that cannot be tested here, and a half-wired SDK that silently drops
events is worse than an honest console line because it looks like error
tracking is working. `reportError()` forwards to a Sentry-compatible global at
call time — install `@sentry/nextjs`, initialise it, and every call starts
flowing with no change to this code.

Two things measurement changed: the database health check took **7.05 s**
against an unreachable host, past most uptime monitors' own timeout, and is
now bounded at 3 s; and the route wrapper rebuilds the `Response`, which would
have dropped `Set-Cookie` and silently broken password-protected prototypes.

## D. Admin

Every table Phases 2–4 wrote to now has somewhere to be read.

- **`/admin/ai`** — usage and provider health computed from `ai_requests`.
  Measured, not probed: probing four paid APIs per page load would cost money
  and describe only one moment.
- **`/admin/email`** — delivery per template, plus failure reasons. Recipients
  are a salted hash shown truncated, so the page answers "is a template
  failing?" without becoming a list of everyone's address.
- **`/admin/system`** — database probe, webhooks, and the credit audit log with
  the request id that lets a disputed charge be traced end to end.
  Configuration reports **presence only, never a value**.
- **`/admin` overview** — MRR and money collected computed and labelled
  separately. They differ legitimately through refunds, part-months and failed
  renewals, and a single "revenue" number hides which.

> Bug found here: `/admin/activity`, `/admin/payments`, `/admin/subscriptions`
> and `/admin/users` were being **statically prerendered** — they would have
> served whatever the numbers were when the build ran, for the life of the
> deployment.

## E. Security audit

`npm audit` — **0 vulnerabilities**. `@supabase/ssr` remains 0.4.1; its
`cookie` advisory is neutralised by an npm override, and upgrading to 0.12.x
replaces the whole cookie API in the auth layer, which should be done where a
real sign-in can be exercised. `@google/generative-ai` was removed in Phase 4
as an unused dependency.

## F. Final UX audit

`npm run test:ux` automates the honesty list. **Two real bugs:**

1. **The landing page advertised $0/mo for every paid plan.** `CountUp`
   initialised to 0 and only animated on intersection, so the server-rendered
   HTML — what a crawler indexes and a no-JS visitor sees — said "$0 /mo" and
   "0 credits", and it stayed 0 for anyone who had not scrolled the section
   into view. Since `CountUp` was used for nothing except the price and the
   credit count, the animation was removed and the component deleted. A
   count-up is decoration; a price is a claim.
2. **A focusable dead control in the decorative hero mockup.** The mockup is
   `aria-hidden`, but that does not remove an element from the tab order — a
   keyboard user could Tab to a button a screen reader would not announce and
   that did nothing. Now a `span`.

"Coming soon" was replaced with "not available" everywhere and added to the
forbidden-copy list. Figma export is not built and has no date; the Master
Command asks for unavailable, not deferred.

---

## Verification results

| Gate | Result |
|---|---|
| `npm audit` | **0 vulnerabilities** |
| `npm run typecheck` | **0 errors** (both tsconfigs) |
| `npm run lint` | **0 errors**, 11 warnings |
| `npm run build` | **passes** |
| `npm test` | **246 / 246** (68 at end of Phase 3) |
| `npm run test:db` | **83 assertions** (31 at end of Phase 3) |
| `concurrency_test.sh` | passes |
| `npm run db:verify` | 0 failed / 29 passed + 2 bucket checks |
| `npm run preflight` | passes |
| Behaviour · responsive · a11y | 13/13 · **180 combinations** · 12/12 |
| Contrast | **22 combinations**, WCAG AA both themes |
| Palette · inspector | 7/7 · 17/17 |
| **UX audit** | **9/9 clean** — 12 routes, 217 files, 16 links |
| **Playwright** | **50 passed**, 6 skipped (no credentials) |
| **Performance** | **7/7 budget checks** |

---

## Remaining risks

1. **Migrations 007–013 are still unapplied.** Nothing database-dependent from
   Phases 1–5 is live until `npm run db:apply` runs.
2. **Nothing has been exercised against a live service.** No Supabase, Resend,
   Paddle, Google OAuth or AI provider credentials exist here. A real
   generation, payment, email send, Google sign-in, file upload, signed
   download, recorded view and publish-log write are **unverified and not
   claimed**. The authenticated E2E suite exists to be run the moment
   credentials do.
3. **Authenticated routes are not visually measured.** The sweeps cover 12
   public routes.
4. **Storage policies are proven against a harness stand-in**, not Supabase's
   own Storage API.
5. **No error-tracking vendor is wired.** `reportError()` is ready for one; the
   structured log line is the record until then.
6. **Company details are unset** in any real environment. CI fails until they
   are filled — deliberately.
7. **Carried:** `@supabase/ssr` 0.4.1; two editor components keep a scoped
   `react-hooks` lint relaxation; no Figma-derived design foundation, because
   the connector still exposes only Figma's own skills and docs.
