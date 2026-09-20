# ROADMAP

Ranked by impact ÷ effort. Everything here was scoped and deliberately not
built in this pass — either because it needs a product decision that is not
mine to make, or because the honest version is bigger than the phase allowed.

## Growth (from Phase 6)

| # | Item | Why it is not built yet |
|---|---|---|
| 1 | **Try-before-signup demo on the landing page** | The highest-value item left. It needs a decision first: an anonymous visitor generating a real project costs real AI money, so it needs its own abuse model (IP-based rate limit, a cheap model, a screen cap) and a cost ceiling you are willing to pay. Building it without that is an open invitation to burn the AI budget. |
| 2 | **Use-case landing pages** (`/for/agencies`, `/for/founders`, `/for/product-teams`) | Cheap to build, but each needs genuinely unique copy to be worth anything. Three near-identical pages with the nouns swapped are a ranking liability, not an asset. The scaffold to host them exists — the blog's content loader generalises to this. |
| 3 | **Post-first-success survey** | The widget and API already take `source: 'first_success'`; what is missing is the trigger — detecting a user's first successful generation and prompting once, ever. Needs a per-user "prompted" flag so it cannot re-ask. |
| 4 | **An honest "how we differ" section** | Deliberately deferred: a comparison must be factual and checkable, which means someone has to verify competitor claims and keep them current. A stale comparison is worse than none. |

## Product advantage (from Phase 8 — see that section for what WAS built)

| # | Item | Notes |
|---|---|---|
| 5 | **Export to React** | HTML/Tailwind export exists. React export means componentising generated markup — real work, and the output quality bar is high because developers will judge it. |
| 6 | **Design-system generation as a first-class artefact** | Tokens are emitted with each project; turning them into a reusable, versioned system shared across a workspace's projects is the larger feature. |
| 7 | **Figma export beyond the current scope** | `/api/export/figma` exists; the round trip a designer actually wants (editable layers, auto-layout) needs the Figma plugin API, not just a file. |

## Backend and operations (from Phase 7)

| # | Item | Notes |
|---|---|---|
| 8 | **Public API `/api/v1` with scoped keys + OpenAPI** | Worth doing once there is demand. Hashed keys shown once, per-key rate limits, and a docs page are each straightforward; the versioning commitment is the part not to take on lightly. |
| 9 | **Outbound webhooks with HMAC + delivery log** | Pairs with the public API. Little value before it. |
| 10 | **Background job queue with dead-letter state** | Generation is currently synchronous and fits inside the request timeout. This matters when a single generation exceeds it, not before. |
| 11 | **Streaming AI responses** | A real UX win on long generations. Needs the provider cascade to support partial-failure fallback mid-stream, which is the hard part. |
