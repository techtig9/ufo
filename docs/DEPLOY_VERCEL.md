# Deploying ufo to Vercel

## 1. Create the project

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root directory | `./` (repository root — **not** a subdirectory) |
| Build command | leave as the default; `vercel.json` sets `npm run preflight && npm run build` |
| Install command | `npm ci` |
| Node version | 22.x (the `engines` field requires ≥ 20.9) |

> If an existing project has **Root Directory** pointing at a subdirectory,
> every build fails with "no Next.js version detected". Clear it back to `./`.

## 2. Environment variables

Set these under **Settings → Environment Variables**, then **redeploy**. A
restart is not enough: the `NEXT_PUBLIC_*` values are compiled into the browser
bundle at build time.

### Required — the app cannot function without these

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role. **Server-only.** Never prefix it with `NEXT_PUBLIC_` |
| `GROQ_API_KEY` | console.groq.com — first provider in the cascade |

### Required before a public launch — `npm run preflight` fails the production build without them

| Variable | Example |
|---|---|
| `UFO_COMPANY_LEGAL_NAME` | `TechTig Ltd` |
| `UFO_COMPANY_DISPLAY_NAME` | `TechTig` |
| `UFO_COMPANY_CONTACT_EMAIL` | `hello@example.com` |
| `UFO_COMPANY_JURISDICTION` | `England and Wales` |
| `UFO_LEGAL_EFFECTIVE_DATE` | `20 September 2026` |
| `UFO_LAUNCH_DATE` | `September 2026` |

These render into the Terms, Privacy, Refunds and Cookie pages, the footer and
the contact page. They are not hardcoded because a legal entity name and
jurisdiction are facts about your business, not source code.

### Recommended

| Variable | Effect if unset |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Falls back to the Vercel deployment host. Set it once you have a custom domain — invitation and mention emails link here |
| `CRON_SECRET` | `/api/cron/reset-credits` returns 503 and **free-tier credits never reset** |
| `RESEND_API_KEY`, `EMAIL_FROM` | No transactional email is sent at all |
| `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_PRICE_*` | Upgrade buttons render disabled with a reason; nobody can pay |
| `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY` | The cascade has no fallback — a Groq outage is a full outage |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Signup and login have no bot protection |

The full annotated list, including model overrides, is `.env.example`.

## 3. Supabase auth redirect URLs

**Supabase → Authentication → URL Configuration:**

- **Site URL:** `https://your-domain.com`
- **Redirect URLs** (add every one you use):
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/**` — covers Vercel preview deployments if you
    add the preview host too
  - `http://localhost:3000/auth/callback` for local development

Without the callback URL registered, Google OAuth returns to a blank page.

## 4. Database

Migrations are **not** run by the deploy. Apply them yourself against the target
database before the first real traffic:

```bash
export DATABASE_URL='postgresql://...'   # session pooler or direct connection
npm run db:apply -- --dry-run
npm run db:apply
npm run db:verify                        # must print 0 failed
```

Take a backup first (Supabase → Database → Backups). The migrations are
re-runnable, but that is not a substitute for a backup.

## 5. Cron

`vercel.json` does not schedule anything. To reset free-tier credits monthly,
add a Vercel Cron job (or any scheduler) calling:

```
POST https://your-domain.com/api/cron/reset-credits
Authorization: Bearer $CRON_SECRET
```

The route fails **closed**: with `CRON_SECRET` unset it returns 503 rather than
running unauthenticated.

## 6. Paddle webhook

**Paddle → Developer Tools → Notifications → add a destination:**

```
https://your-domain.com/api/webhooks/paddle
```

Subscribe to the subscription and transaction events. The handler verifies the
HMAC signature in constant time and records every `event_id` in
`webhook_events`, so a Paddle retry cannot grant credits twice.

## 7. Verify the deployment

```bash
curl -s https://your-domain.com/api/health | jq
```

`status: "ok"` with every component `up` means the keys are right. Anything
else names the component that is not configured — it does not guess.

Then check by hand: sign up, generate one project, open a share link in a
private window, and run one checkout in Paddle sandbox.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It must never appear
  in a `NEXT_PUBLIC_*` variable, in client code, or in a log line.
- Preview deployments inherit production environment variables unless you scope
  them per environment. Scope the Paddle **live** keys to Production only.
- If a key is ever pasted into a commit, a PR or a screenshot, rotate it in the
  provider dashboard. Removing the commit does not un-leak it.
