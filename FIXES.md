# FIXES — what changed, what did not, and what you need to do

Branch: `release/clean`. Covers phases 1–5 of `/fix-all`.

## 1. Fixed

### The upgrade button could not report failure (P1)

`components/dashboard/paddle-checkout-button.tsx` failed three ways in silence.
On a billing control that means a customer who wants to pay you cannot, and
never finds out why:

- `Paddle.Initialize({ token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN! })`
  — the non-null assertion is a claim the type system cannot check. Unset, the
  SDK initialised with `undefined` and the overlay never opened.
- `if (!window.Paddle) return;` — a bare return. `paddle.com` is on most
  ad-blocker lists, so this is common, not theoretical.
- The `<Script>` tag had no `onError`, so a blocked CDN left the button
  disabled for ever with no explanation.

Now: no token → a disabled button **with the reason and the variable name**;
blocked script → a message naming the ad blocker; a throw from `Initialize` →
a retryable error and the init flag reset.

### `/api/chat` read its body with a cast instead of a check (P1)

`(await request.json()) as { messages: ChatMessage[] }`. Two things went
through it: `text` could be any type (a number or object reached the provider
and came back an opaque 400), and `text` had **no length cap** — `MAX_HISTORY`
bounds the message count and `maxTokens` bounds the output, so twelve
multi-megabyte messages were a rate-limit-compliant way to run up a bill on
your API key. Now zod-validated, 4 000 characters per message, 400 with a
reason for malformed JSON. 8 tests.

It did *not* allow a forged `role: "system"`, contrary to first appearance:
`chatWithAssistant` maps any role that is not `model` to `user`. The enum keeps
that true if that mapping is ever rewritten.

### Three log paths skipped the credential redactor (P1)

`lib/ai/router.ts`, `lib/email.ts` and the Paddle webhook each emitted their own
`console.log(JSON.stringify(...))` rather than going through `log()`. The AI
router is the dangerous one: `fallbackReason` carries provider error text
verbatim, and a provider that echoes the `Authorization` header put an API key
straight into your log pipeline. All three now route through the redactor.
Regression test added.

### CI was not gating anything (P1)

It never ran the 253-test suite, and it built **with** placeholder environment
variables — so the "builds with nothing configured" guarantee was enforced
nowhere. It now runs tests, and builds with nothing set. Added an advisory
`npm audit`, grouped Dependabot, and a PR template.

### `engines.node` was wrong (P1)

`>=18.18.0`, but Next 16 needs 20.9+. `npm install` succeeded and the build then
failed. Now `>=20.9.0`.

### Design system completed

A 9-step neutral ramp that inverts between themes, theme-aware shadow tokens,
spacing tokens, fluid `clamp()` display sizes (headings stepped at breakpoints,
with a visible reflow jump at 767/768px), and the three missing primitives —
`Table` (owns its own scroll container, because a data table is the top cause
of horizontal page scroll on a phone), `Avatar` (initials, no `<img>` at all),
`Progress` (reports its numbers through ARIA, animates `scaleX` not `width`).

### Repo cleaned

21 status-report markdown files left the root for `docs/history/`. The README
was a build log; it is now what it is, stack, setup, scripts, structure and
conventions. Added `docs/DEPLOY_VERCEL.md`.

## 2. Not fixed, and why

| Thing | Why |
|---|---|
| 16 write routes use hand-rolled validation, not zod | Reviewed individually: the ones that write user input use explicit allow-lists and are correct. Converting them is churn with no behaviour change. Phase 7 does it properly, via a shared `readJson(request, schema)` helper that also turns a malformed body into a 400 |
| Leaked-password protection is off in Supabase Auth | A dashboard toggle. No API for it in this tooling — see MANUAL ACTIONS |
| Migrations not applied anywhere by this branch | The command file forbids it, and correctly: a migration applied by a PR cannot be reviewed before it runs |
| `.next/` still in the working tree | Build output, already git-ignored; `git archive` excludes it |

## 3. Design decisions

- **Direction.** ufo.ai is the "AI UI/UX design" product, so: dark ground, neon
  citron `#D4FF4F` with a violet accent, dot-grid canvas. Already implemented in
  an earlier phase and verified against the quality bar rather than rebuilt —
  restyling working, contrast-verified UI to prove activity would have been
  destructive.
- **A 9-step ramp on top of semantic tokens, not instead of them.** Semantic
  tokens name a role and cover most of the product, but nothing could answer
  "a grey between surface and border". The ramp inverts between themes so
  `--n2` keeps its *intent* on paper.
- **Colour is never the only signal.** `Progress` changes colour as it fills,
  and always states the same thing in text.
- **A control that cannot work renders disabled with a reason.** Applied to the
  Paddle button; it is the rule for the rest of the product.
- **Whole-value redaction.** When the redactor sees a secret shape it drops the
  entire value, losing surrounding context. That cost is deliberate: splicing a
  secret out of free text means trusting the pattern to have caught every one,
  and a missed key in a log pipeline is unrecoverable.

## 4. MANUAL ACTIONS FOR ME

### Environment variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`.

Required before public launch (preflight fails the production build without
them): `UFO_COMPANY_LEGAL_NAME`, `UFO_COMPANY_DISPLAY_NAME`,
`UFO_COMPANY_CONTACT_EMAIL`, `UFO_COMPANY_JURISDICTION`,
`UFO_LEGAL_EFFECTIVE_DATE`, `UFO_LAUNCH_DATE`.

Recommended: `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` (without it free credits
never reset), `RESEND_API_KEY` + `EMAIL_FROM`, the Paddle set, the fallback AI
providers, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

Full annotated list: `.env.example`. Consequences of each omission:
`docs/DEPLOY_VERCEL.md`.

### Migrations, in order

`006a → 007 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015`, via
`npm run db:apply`, then `npm run db:verify` (must print `0 failed`). **This
branch adds no new migration.** 006a must precede 011 — it backfills the parts
of 001–005 that a hand-applied schema misses, and 011 fails outright without it.

### Auth redirect URLs

Supabase → Authentication → URL Configuration. Site URL `https://your-domain`,
redirect URLs including `https://your-domain/auth/callback` and
`http://localhost:3000/auth/callback`.

### Vercel settings

Framework Next.js; **Root Directory `./`** — an existing project pointing at a
subdirectory fails every build; Node 22.x. Scope Paddle **live** keys to
Production only, or preview deployments will take real payments.

### Keys to rotate

**None found.** Git history was scanned: no `.env` file has ever been committed,
and no build output is tracked.

One thing to turn on that is not a key: **Supabase → Authentication → enable
leaked-password protection.** It rejects passwords found in known breaches, and
it is off.

## 5. Five-minute test checklist

1. `/` in both themes and at 375 px — no horizontal scroll, prices read
   $0/$15/$29/$59, no console errors.
2. Sign up with a real address → the verification email arrives → `/dashboard`
   loads.
3. Generate one project. Watch the credit count drop by the quoted cost, and
   `/dashboard/billing` agree with it.
4. Publish a prototype → open the share link in a **private window** → it
   renders and accepts a comment.
5. Click an upgrade button with `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` unset: it must
   be **disabled and say why**, not silently do nothing. Then set it and confirm
   the Paddle overlay opens.
6. `curl -s https://your-domain/api/health | jq` → every component `up`.

---

# Phases 6–9 (branches `release/growth`, `release/advantage`)

## New migrations, in order

Apply **after** 006a–015. Each is additive and idempotent, and **none has been
applied to any database**.

| Migration | What it adds | Notes |
|---|---|---|
| **016** | `feedback` | Insert-only for clients, **no select policy at all** — feedback quotes private work, so no client key can read it back |
| **017** | `admin_actions`, `feature_flags` | `admin_actions` is service-role only (nothing client-side reads an audit trail). `feature_flags` is world-readable, writable by nobody through the API |

```bash
npm run db:apply    # picks up 016 and 017
npm run db:verify   # must print 0 failed
```

## New environment variables

All optional; everything degrades honestly without them.

| Variable | Effect if unset |
|---|---|
| `AI_DISABLED` | No kill switch. Set to `1` to stop all generation immediately — no database dependency, cannot fail open |
| `AI_MONTHLY_BUDGET_USD` | **No spend ceiling at all.** Past the cap, generation returns 503 and refunds credits. The admin console says loudly when no cap is set |
| `AI_RATE_<MODEL>` | Cost estimates use the built-in rate table. Format `"input,output"` in USD per million tokens |
| `NEXT_PUBLIC_PADDLE_PRICE_{STARTER,PRO,BUSINESS}_YEARLY` | The yearly tab renders plans disabled naming the missing variable, rather than selling a monthly subscription to someone who chose yearly |

## MANUAL ACTIONS FOR ME

1. **Set `AI_MONTHLY_BUDGET_USD`.** This is the single most valuable variable
   added. Without it there is no ceiling on what the product can spend. Pick a
   number you would be unhappy but not ruined to see on an invoice.
2. **Create the three annual Paddle prices** at 10× the monthly price, and set
   the `_YEARLY` variables. The webhook already maps them to the right plans —
   without that mapping an annual customer is charged and *not* upgraded.
3. **Decide on `generate_component`.** It is ~19× underpriced per credit
   against comparable actions. `docs/UNIT_ECONOMICS.md` sets out three options;
   the least disruptive is lowering its `maxTokens` from 8,000 to ~2,000, which
   is not a pricing change at all.
4. **Reconcile the AI rate table** in `lib/ai/cost.ts` against a real provider
   invoice once there is one. Every number in the economics analysis rests on it.
5. Still outstanding from phases 1–5: enable **leaked-password protection** in
   Supabase Auth.

## Five-minute test checklist (additions)

7. Toggle the pricing page to **Yearly** — the headline stays a per-month
   figure, the annual total appears beneath it, and the two agree when
   multiplied.
8. On the dashboard, confirm the credit meter shows a prompt only past 75%.
9. Open `/admin/ai` — the spend panel must state which of the four states it is
   in (capped / no cap / over budget / could not read).
10. Export a project: the zip should contain `html/`, `react/`, `png/` and
    `design-system/`, and the React components should open without syntax
    errors in your editor.
