# UFO — FINAL LOCAL SETUP & DEPLOYMENT CHECKLIST

This package is the consolidated UFO frontend/backend project after the previous fix rounds.

## 1. Install

```bash
npm install
```

## 2. Create local environment

Windows CMD:
```cmd
copy /Y .env.example .env.local
notepad .env.local
```

PowerShell:
```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Minimum core values:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- GROQ_API_KEY (unless you have another configured AI-compatible provider path)

ANTHROPIC_API_KEY is optional.

Do NOT commit `.env.local`.

## 3. Supabase

If this is an existing database, do NOT reset it.

Run the project's migrations in the Supabase SQL Editor in order, including:
- supabase/schema.sql (only if setting up a fresh database)
- supabase/migrations/001_premium_workspace.sql
- supabase/migrations/002_launch_fixes.sql

If your database already contains the tables from earlier deployments, apply only migrations that have not already been applied.

## 4. Typecheck

```bash
npm run typecheck
```

## 5. Production build

```bash
npm run build
```

Do not deploy until both typecheck and build complete successfully.

## 6. Local run

```bash
npm run dev
```

Open:
http://localhost:3000

## 7. Core acceptance test

1. Sign up / log in.
2. Open Dashboard.
3. Start AI Designer.
4. Generate a simple website.
5. Confirm a project and all generated screens are created.
6. Open the project.
7. Edit code.
8. Save.
9. Open Version History.
10. Restore a previous version.
11. Preview desktop/tablet/mobile.
12. Publish.
13. Open the public prototype URL.
14. Add a comment and verify it belongs to the active screen.
15. Test export according to the user's plan.
16. Open Billing and verify the current plan/payment history UI.
17. Test logout/login again.

## 8. Production environment

Before Vercel deployment, configure production values for:
- Supabase
- AI provider
- Paddle
- Resend/email
- CRON_SECRET

Do not put secret keys in NEXT_PUBLIC_* variables.

## Important

This package does not contain your private `.env.local` credentials.

A third-party provider cannot be tested without your real provider credentials, and payment/email integrations cannot be considered live until their production credentials and webhook settings are configured.
