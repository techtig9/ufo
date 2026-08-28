# UFO Final Release Notes

This package is the cleaned production source for the current UFO AI SaaS implementation.

## Important fixes made in this final pass

- Removed the broken Sentry integration because the uploaded project did not contain the
  `@sentry/nextjs` dependency or a real Sentry configuration. Error pages now log errors
  server/client-side without a missing dependency.
- Removed the missing `@anthropic-ai/sdk` runtime dependency by using Anthropic's HTTPS API
  directly. No new npm dependency is required for Claude generation.
- Updated the default Claude model to `claude-fable-5`, matching the current Anthropic API
  model documentation as of August 2026. The `CLAUDE_MODEL` environment variable can override it.
- Updated `.env.example` and startup validation to match the AI providers actually used by
  `lib/ai.ts`.
- Added a production deployment checklist.
- Added a proper `.gitignore` so `node_modules`, local environment files and build output do
  not get committed to GitHub.

## What was not changed

Existing UFO project data structures, authentication, billing, sharing, prototype, generator,
dashboard, and editor features were preserved. The premium workspace additions remain included.

## Before first production deploy

1. Run `npm install`.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Apply `supabase/migrations/001_premium_workspace.sql`.
5. Configure Vercel environment variables from `.env.example`.
6. Set `NEXT_PUBLIC_SITE_URL` to the real production URL.
7. Configure Paddle production webhook/price IDs if billing is enabled.
8. Complete the smoke-test list in `PRODUCTION_DEPLOYMENT.md`.

This package is source-complete, but production credentials and third-party dashboard
configuration cannot be verified from the ZIP itself.
