# UFO Frontend Redesign — Fixes Applied

This build contains the first production-readiness fixes identified in the audit.

## Fixed
- Replaced invalid Tailwind `border-white/[0.08]` and `bg-white/[0.08]` utilities with supported arbitrary opacity syntax.
- Increased Free plan monthly credits from 150 to 1,500 so a new Free user can complete one full generation (generation cost is 1,500 credits).
- Updated Supabase schema default Free credits to 1,500.
- Added migration `supabase/migrations/002_launch_fixes.sql` for screen-version insert/delete RLS policies.
- Fixed Billing payment history so real payment rows are displayed.
- Added `/api/account/plan` for frontend feature gating.
- Gated ZIP/code export in the editor UI for Free users; Starter+ and admins can export.
- Disabled the unfinished Figma export button and API so users are not charged for a feature that is not implemented.
- Anthropic remains optional; Groq remains the required AI provider for local generation.

## Database step
If your Supabase database already exists, run:
`supabase/migrations/002_launch_fixes.sql`

Do not commit `.env.local` or any API secrets.
