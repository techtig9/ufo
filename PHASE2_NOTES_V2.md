# Phase 2 — AI Engine, Backend, Database, Billing, Email

Executed against `UFO_TechTig_Master_Command_v2.md`, Phase 2 (A: AI provider
architecture, B: AI reliability, C: AI features, D: Supabase, E: Paddle,
F: Resend).

> The older `PHASE2_NOTES.md` in this repo belongs to an earlier,
> differently-numbered effort and is historical. This file is the record for
> the Master Command's Phase 2. Phase 1's record is `PHASE1_UPGRADE_NOTES.md`.

---

## How to re-run everything

```bash
npm audit                       # 0 vulnerabilities
npm run typecheck               # app + tests
npm run lint                    # 0 errors
npm run build                   # production build

npm test                        # 68 unit tests
npm run test:db                 # 13 Phase 1 + 18 Phase 2 DB assertions
./supabase/tests/concurrency_test.sh   # proves the credit race, and its fix

npm run build && npm run start &
BASE=http://localhost:3000 npm run test:browser
```

---

## A. AI provider router

**Required cascade: Groq → Cerebras → OpenRouter → Claude.**

The previous code had two disconnected paths. `callSimple` cascaded the first
three and fell back on HTTP 429 alone; `callComplex` went straight to Claude
whenever `ANTHROPIC_API_KEY` was set and otherwise delegated to `callSimple`.
So **Claude was never a fallback** — it was either first or absent — and a
provider outage or an expired key was fatal rather than failing over.

`lib/ai/` is now one router with typed error classification:

| Condition | Behaviour | Why |
|---|---|---|
| 429, quota | fall back | the next provider may have capacity |
| 5xx, transport | fall back | provider-side or network, not our request |
| timeout | fall back | one slow provider must not pin the cascade |
| 401 / 403 | **fall back** | a bad Groq key says nothing about the Cerebras key |
| 400 / 422 | **STOP** | every provider rejects an invalid request identically |
| caller aborted | **STOP** | the caller has gone away |

Unconfigured providers are **skipped, not counted as failures** — an unset key
is a deployment choice, not an outage, and conflating them would make the logs
useless for spotting real problems.

`preferHighQuality` puts Claude first for generation work but still degrades to
the cheaper providers if Claude is unconfigured or failing: a preference, not a
bypass, as the Master Command requires.

**Observability:** one `ai_requests` row per *attempt* (not per request),
sharing a `request_id`, carrying provider, model, outcome, HTTP status, latency,
fallback reason and token usage. That is what makes *"how often is Groq rate
limiting us"* and *"p95 latency per provider"* answerable. No prompt or
completion text is stored.

## B. AI reliability

Every AI JSON response is schema-validated with zod at the boundary. Previously
a model returning valid JSON of the wrong shape produced a project whose
`screens` was `undefined`, surfacing much later as a confusing database or
render error rather than *"the generator returned something unusable"*.
Malformed JSON gets a conservative repair pass (trailing commas, prose
prefixes) before being rejected. Per-attempt timeouts and `AbortSignal`
propagation mean a hung provider cannot pin the cascade and a closed tab stops
the work.

## C. AI features

Ten actions added as one data-driven catalogue (`lib/ai/actions.ts`) rather
than ten near-identical endpoints:

| Kind | Actions |
|---|---|
| Rewrite this screen | `regenerate_screen`, `improve_ux`, `improve_copy`, `make_responsive`, `improve_accessibility` |
| Review — changes nothing | `audit_accessibility`, `check_consistency`, `extract_design_system` |
| Create | `generate_screen`, `change_theme` |

Two of these were **half-built before**: `changeTheme()` and
`generateNewScreen()` existed in `lib/ai.ts` with credit costs defined, but no
route ever called them — dead paths that looked like features.

- **Analyses never mutate.** An "audit" that silently rewrote your screens
  would not be an audit.
- **Rewrites are proposed, never auto-applied.** Applying goes through the
  existing `PATCH /api/screens/[id]`, which records the version snapshot, so an
  AI change stays undoable.
- **The UI fetches the catalogue from the server**, so a button cannot exist
  for something the backend does not implement.

Saved prompts (migration 009) complete the pair with the prompt history that
already existed via `screen_versions.source='ai'`.

## D. Atomic credits — a P0 money bug

Both AI routes did a read-modify-write:

```ts
const newBalance = subscription.credits_remaining - cost;
await admin.from('subscriptions').update({ credits_remaining: newBalance })
```

Two concurrent generations read the same balance and both wrote `balance - cost`,
so **the user was charged once for two generations**.

`supabase/tests/concurrency_test.sh` proves it with genuinely concurrent psql
clients:

```
10 concurrent charges of 100 credits, starting balance 1000

  OLD read-modify-write : final balance 900   -> RACE: 9 of 10 charges lost
  NEW reserve_credits   : final balance 0     -> correct
  NEW successful charges: 10 / 10
  NEW ledger rows       : 10 / 10
```

Migration 008 adds `reserve_credits()` and `refund_credits()`. The guard lives
in the `UPDATE` itself (`where credits_remaining >= p_amount`), so concurrent
callers serialise on the row lock and the balance cannot go negative.

**Order is reserve-before-work, refund-on-failure.** Charging only after success
looks simpler but has its own race: two requests can both pass the affordability
check and both generate before either writes, making one generation free.
Reserving first makes the charge authoritative; refunds on every failure path
keep *"a failed generation costs nothing"* true. Refunds are idempotent per
`(request_id, action)`.

Three persistence failure paths in `/api/generate` already claimed *"No credits
were charged"* — with reserve-first that would have been a lie, so each now
refunds before returning.

`credit_ledger` records every movement, append-only, making a double-charge
detectable after the fact and giving Phase 5's admin cost view its data source.

## E. Paddle webhook idempotency

`subscription.created`/`updated` unconditionally reset `credits_remaining` to
the plan total, and **Paddle retries webhooks** — so a retry mid-cycle silently
refilled a user's credits for free.

Each event id is now claimed in `webhook_events` (UNIQUE on
`provider + event_id`) *before* being acted on; a replay loses the insert and is
skipped with a 200 so Paddle stops retrying. The claim happens before
processing, not after, so a duplicate delivered while the first is still in
flight is also rejected. A crash mid-processing then leaves the event claimed
but unapplied — the safer direction for money, since a missed top-up is visible
and fixable while a doubled one is not, and the row remains to reconcile from.

## F. Email delivery log

`email_events` records template, status, provider message id and a coarse error
class, keyed by a **salted hash of the recipient rather than the address** —
enough to answer *"are welcome emails bouncing"* without turning the table into
a mailing list or a copy of the message bodies.

---

## Verification results

| Gate | Result |
|---|---|
| `npm audit` | **0 vulnerabilities** |
| `npm run typecheck` | **0 errors** |
| `npm run lint` | **0 errors**, 14 warnings |
| `npm run build` | **passes** |
| `npm test` | **68 / 68** (was 19 at the start of Phase 1) |
| `npm run test:db` | **13 Phase 1 + 18 Phase 2** assertions |
| `concurrency_test.sh` | race reproduced on old path, **absent on new** |
| `test:browser` | 13/13 + 126 responsive combos + 12/12 a11y |
| API authorization matrix | 0 failures; new routes 401 on every method |

## Bugs found by writing the tests

1. **`reserve_credits` had an ambiguous column reference.** A `RETURNS TABLE`
   column named `credits_remaining` becomes a PL/pgSQL variable and collided
   with `subscriptions.credits_remaining`. Renamed to `out_*`.
2. **`/api/prompts` upsert would have failed at runtime.** It targeted
   `onConflict: 'user_id,title'` while migration 009 created a *functional*
   unique index on `lower(title)`; Postgres cannot match a column-list conflict
   target to an expression index. Now a plain `UNIQUE (user_id, title)`,
   verified against real Postgres.
3. **`parseAiJson` collapsed input and output types.** `z.ZodType<T>` pins both
   to the same `T`, so every `.default()` field appeared optional to callers.
   Now generic over the schema with `z.output<S>`.

## Remaining risks

1. **No live-credential verification.** No Groq, Cerebras, OpenRouter,
   Anthropic, Paddle or Resend credentials exist here. The cascade is tested
   against a fetch double that mirrors real `fetch`'s abort behaviour; the SQL
   against a local Postgres reproducing Supabase's roles and default
   privileges. A real provider call, a real Paddle delivery and a real Resend
   send are **not** verified and not claimed.
2. **Migrations 008 and 009 have not been applied anywhere.** Until they run,
   credits are still deducted non-atomically and webhook replays still refill
   credits.
3. **`transcribeVoice` remains single-provider.** Cerebras and OpenRouter
   expose no audio endpoint, so there is genuinely nothing to fall back to.
   Left as a single Groq call rather than pretending otherwise.
4. **Carried from Phase 1:** `@supabase/ssr` is still 0.4.1 (advisory
   neutralised by an override); six components carry a scoped lint relaxation;
   the dead `⌘K` control and the hardcoded dark chrome are Phase 3 work.
