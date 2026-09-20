# ufo

Describe an app in plain language, get a complete clickable multi-screen UI/UX
prototype — real design tokens, real code, no design software.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript strict |
| Styling | Tailwind over semantic CSS custom properties (`app/globals.css`) |
| Database, auth, storage | Supabase (Postgres + RLS, Auth, Storage) |
| Billing | Paddle Billing (HMAC-verified webhooks, idempotency ledger) |
| Email | Resend, behind a provider-agnostic sender |
| AI | Groq → Cerebras → OpenRouter → Anthropic cascade (`lib/ai/router.ts`) |
| Tests | Node test runner (unit), Playwright (E2E and browser audits) |

## Setup

```bash
npm ci
cp .env.example .env.local     # then fill it in — every variable is annotated
npm run dev                    # http://localhost:3000
```

**The app runs with no environment variables at all.** Public pages, pricing
and the legal pages work; `/dashboard` and `/admin` render a setup notice
naming what is missing; `/api/health` reports an honest 503. That is deliberate,
so a deployment can be created first and credentials added afterwards.

### Database

Migrations are ordered and idempotent — a repeat run is a no-op.

```bash
export DATABASE_URL='postgresql://...'   # Supabase → Settings → Database → URI
                                         # session pooler or direct; the
                                         # transaction pooler cannot run all DDL
npm run db:apply -- --dry-run   # list what would run
npm run db:apply                # apply 006a → 015
npm run db:apply -- --all       # fresh database: schema.sql + every migration
npm run db:verify               # assert the RESULT, not that a file ran
```

`db:verify` reads only catalogue metadata, so it is safe against production and
exits non-zero — it can gate a deploy.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit`, app and tests |
| `npm test` | Unit and integration tests (node test runner) |
| `npm run test:e2e` | Playwright end-to-end |
| `npm run test:browser` | Contrast, a11y, responsive and UX audits against a running server |
| `npm run preflight` | Fails a production build when required variables are missing |
| `npm run db:apply` / `db:verify` | Migrations, and verification of their effect |

Node 20.9+ is required (`engines` enforces it) — Next 16 does not run on 18.

## Deploying

See **[docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)** for exact steps, the
required-variables list and the auth redirect URLs.

## Project structure

```
app/                Next App Router
  (auth)/           login, signup, forgot-password
  api/              40 route handlers
  admin/            operator console (users, AI cost, email, system health)
  dashboard/        the product: projects, AI designer, templates, workspaces
  proto/[slug]/     public prototype viewer
components/
  ui/               the design system primitives
  editor/ landing/ dashboard/ workspaces/ ...
lib/
  ai/               provider cascade, schemas, JSON guards
  supabase/         browser, server, admin and middleware clients
  *.ts              credits, entitlements, publishing, observability, …
supabase/
  schema.sql        base schema
  migrations/       ordered, idempotent
scripts/            preflight, migration apply, database verification
tests/              unit + browser audits      e2e/  Playwright specs
docs/               deployment, go-live, and history/ (build logs)
```

## Conventions

- A component names a **role** (`bg-surface`, `text-fg-muted`), never a literal
  colour, so both themes follow automatically.
- Every async action has loading, disabled, success and error states. A control
  that cannot work renders disabled **with a reason**, never silently inert.
- Server logs go through `lib/observability.ts`, which redacts credentials.
  Never `console.log` a request or a provider error directly.
- Migrations are additive and idempotent; they are never applied to a live
  database by CI or by a PR.
