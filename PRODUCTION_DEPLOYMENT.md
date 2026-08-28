# UFO Production Deployment Checklist

## 1. Local verification

```bash
npm install
npm run typecheck
npm run build
npm start
```

Verify login, signup, dashboard, generation, project editor, AI edit, preview/prototype,
sharing, billing UI, notifications, and account settings.

## 2. Supabase

Run the existing `supabase/schema.sql` on a new database, or keep the existing UFO database.

Then run:

```text
supabase/migrations/001_premium_workspace.sql
```

Do not reset a production database just to apply this migration.

## 3. Vercel environment variables

Configure the variables from `.env.example` in Vercel for the Production environment.

Required for the current AI architecture:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY (optional; UFO falls back to the configured OpenAI-compatible provider when absent)
- GROQ_API_KEY

Recommended AI fallbacks:

- CEREBRAS_API_KEY
- OPENROUTER_API_KEY

Billing/email/cron variables are required only for those features.

Never expose SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY (optional; UFO falls back to the configured OpenAI-compatible provider when absent), GROQ_API_KEY, Paddle secrets,
Resend keys, or CRON_SECRET as NEXT_PUBLIC_* variables.

## 4. Production URL

Set:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN
```

Do not leave the localhost value in Vercel Production.

## 5. Paddle

Use Paddle sandbox keys/price IDs for preview testing and production keys/price IDs for
Production. Configure the Paddle webhook URL to the deployed `/api/webhooks/paddle` endpoint.

## 6. Final smoke test

- Create an account.
- Sign in/out.
- Create a project.
- Generate screens.
- Open Studio.
- Add/rename/delete/reorder a screen.
- Edit code.
- Use AI Design Copilot.
- Apply an AI change.
- Restore a previous version.
- Open prototype preview.
- Test navigation/hotspots.
- Test public sharing.
- Test credits.
- Test upgrade/checkout in the appropriate Paddle environment.
- Test notification loading/read state.
- Test mobile layout.
- Confirm browser devtools has no exposed server secrets.
