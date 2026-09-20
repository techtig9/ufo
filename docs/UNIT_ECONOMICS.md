# Unit economics

What each plan can cost in AI, against what it charges.

Regenerate this analysis with:

```bash
node --experimental-strip-types scripts/unit-economics.mjs
DATABASE_URL='postgresql://...' node --experimental-strip-types scripts/unit-economics.mjs  # + actual spend
```

The script reads `PLAN_MONTHLY_CREDITS`, `PLAN_PRICE_USD` and `CREDIT_COSTS`
from `lib/credits.ts` and the rate table from `lib/ai/cost.ts`, so it cannot
drift from what the product actually charges and spends. It exits non-zero when
a **paid** plan has a negative worst-case margin, so it can gate a release.

Re-run it whenever plan prices, credit costs, model choices or provider rates
change. Those are four independent ways for a plan to go underwater, and three
of them are changes nobody thinks of as a pricing change.

## Worst case, as of 2026-09-20

"Worst case" means a user spends every credit on the most token-expensive
action, on the cascade's **most expensive** provider tier — which is exactly
what happens during a Groq outage, when every request is silently promoted to
the frontier model.

| Plan | Credits | Price | Worst-case AI cost | Margin | Margin % |
|---|---|---|---|---|---|
| free | 1,500 | $0 | $2.16 | −$2.16 | n/a |
| starter | 5,000 | $15 | $7.20 | $7.80 | **52%** |
| pro | 13,000 | $29 | $18.72 | $10.28 | **35%** |
| business | 26,000 | $59 | $37.44 | $21.56 | **37%** |

**No paid plan is underwater**, even under the pessimistic assumption above.
Real usage will be well below this: these use the `maxTokens` ceiling from each
call site as though every response hit it, and assume the cheap providers are
unavailable.

### Free costs about $2.16 per user per month, worst case

That is the number to watch, and it is a *decision*, not a problem: free users
are a customer-acquisition cost. The question is whether conversion pays for
it. At Starter's $7.80 worst-case margin, roughly **one conversion pays for
three-and-a-half free users for a month**. Track the ratio; if free signups
grow much faster than conversions, the free credit allowance is the lever.

## The finding: `generate_component` is underpriced ~19×

The script compares cost-per-credit across actions with comparable token
ceilings:

| Action | Credits | Max output tokens | Cost per credit, relative |
|---|---|---|---|
| `generate_component` | 100 | 8,000 | **19.0×** |
| `audit_accessibility` | 40 | 2,000 | 11.9× |
| `update_screen` | 90 | 4,000 | 10.6× |
| `import_redesign` | 1,900 | 8,000 | 1.0× (cheapest) |

`generate_component` and `import_redesign` have the **same 8,000-token
ceiling** — the same underlying work — but one charges 100 credits and the
other 1,900. A user who wants a lot of generated markup cheaply will find that
route, and nothing stops them: on Business, 26,000 credits buys 260
component generations at 8,000 tokens each, which is $37 of AI against $59 of
revenue *before* they do anything else.

**This has not been changed here.** Credit pricing is a product decision with
real customer impact — existing users have expectations set by the current
numbers — and it is not one to make inside a refactor. The options, in the
order I would consider them:

1. **Raise `generate_component` to ~400–600 credits.** Brings it in line with
   `regenerate_project` (400 credits, same ceiling class). Simplest, and the
   action is niche enough that few users will notice.
2. **Lower its `maxTokens` to ~2,000.** A single component does not need an
   8,000-token budget; the ceiling is probably just copied. This fixes the
   economics without touching a published price, and is the least disruptive
   option.
3. **Leave it, and watch it.** Defensible if real usage is negligible — check
   `admin/ai` for the actual call count before deciding it is theoretical.

Option 2 is the one I would take first: it is not a pricing change at all, and
if 2,000 tokens turns out to be too tight, that shows up as truncated output
rather than as a bill.

## What the numbers rest on

- **Rates are configuration, not fact.** `lib/ai/cost.ts` holds published list
  prices from when it was written. Provider pricing changes without notifying
  your codebase. Reconcile against a real invoice, and override per model with
  `AI_RATE_<MODEL>` when they drift.
- **Token ceilings are bounds, not measurements.** They come from the
  `maxTokens` at each call site. Once `ai_requests` has real traffic, the
  `DATABASE_URL` mode measures what actually happens, which is the number to
  price against.
- **Unknown models are billed at the most expensive known rate.** So the
  estimate errs high, deliberately — see the reasoning in `lib/ai/cost.ts`.

## Related controls

- `AI_MONTHLY_BUDGET_USD` caps estimated monthly spend; past it, generation
  pauses and credits are refunded.
- `AI_DISABLED=1` stops generation immediately, with no database dependency.
- `admin/ai` shows spend against the cap, and flags when the cap is failing
  open because the log could not be read.
