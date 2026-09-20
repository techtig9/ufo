# UFO — Professional SaaS Audit + Claude Code 10/10 Upgrade Command

Date: 28 August 2026
Project: UFO — AI UI/UX Designer SaaS
Agency: TechTig
Audit target: `UFO-VERIFIED-FINAL.zip`

## 1. Audit scope

I inspected the ZIP archive structurally and statically.

- ZIP integrity: PASS.
- Archive entries: 275.
- Source files scanned: approximately 160 TypeScript/TSX/CSS/SQL/MJS files.
- Application source: approximately 10,857 lines across those source files.
- API route handlers: 25.
- Supabase migrations: 6.
- Main stack: Next.js 14.2.35, React 18.3.1, TypeScript, Supabase, Paddle, Resend, Monaco, Groq/Cerebras/OpenRouter/Anthropic.
- Pages include landing, auth, dashboard, AI designer, projects, editor, templates, billing, settings, admin, help, legal and public prototypes.

Important limitation:
- I could not complete a true browser/runtime test inside this environment because the dependency installation did not finish successfully within the execution window. Therefore, do NOT treat this audit as proof that every production integration works.
- The source was nevertheless deeply inspected, including routes, auth flow, AI provider logic, database schema/migrations, billing, email, UI components, security headers, CI, and project notes.
- Claude Code must perform the real browser/runtime testing after opening the project with valid environment variables.

---

# 2. Current professional rating

## Overall current rating: 7.4/10

This is a strong advanced MVP / early production SaaS foundation, but it is NOT yet a genuine 9.5–10/10 market-leading SaaS.

### Category scores

| Area | Current | 10/10 target | Main reason |
|---|---:|---:|---|
| Product concept & positioning | 8.5/10 | 10 | Strong AI UI/UX generation concept |
| Frontend/UI system | 8.4/10 | 10 | Strong design system, cards, transitions and responsive work, but needs a complete visual QA pass |
| AI generation | 7.8/10 | 10 | Good provider architecture, but fallback behavior does not exactly match the requested cascade |
| Authentication | 7.2/10 | 10 | Email/password, Google OAuth, MFA and CAPTCHA exist; Google white-page path needs real browser/provider testing |
| Backend/API | 8.0/10 | 10 | Many real routes and ownership checks; needs stronger automated integration tests and transactional guarantees |
| Database/Supabase | 8.2/10 | 10 | Good RLS and migrations; RLS recursion bug was found/fixed in migration 006 |
| Billing/Paddle | 8.0/10 | 10 | Checkout/webhook/subscription handling exists; production Paddle configuration must be verified |
| Email/Resend | 5.8/10 | 10 | Resend exists, but current implementation does not send a login notification on every sign-in |
| Security | 7.3/10 | 10 | Good headers/RLS/service-role separation; framework version is now unsupported and must be upgraded |
| Performance | 7.5/10 | 10 | Monaco was lazy-loaded; more performance budgets/load testing are needed |
| Reliability/error handling | 7.0/10 | 10 | Error/loading/empty states exist, but real E2E coverage is missing |
| Analytics/observability | 4.5/10 | 10 | No complete product analytics/error-monitoring stack is actually wired |
| Collaboration/team features | 5.5/10 | 10 | Comments/replies/resolution exist; real teams/orgs/invites are not implemented |
| Publishing/hosting | 5.5/10 | 10 | Public prototype sharing exists, but real production website hosting/custom domains do not |
| Assets/storage | 4.5/10 | 10 | Supabase is present but a full asset-management/storage system is not implemented |
| Testing/QA automation | 4.5/10 | 10 | CI has typecheck/lint/build, but no real unit/E2E/browser test suite |
| Documentation/launch readiness | 7.0/10 | 10 | Good notes/checklists, but some documentation is stale/contradictory |

---

# 3. What UFO already has

## Frontend

- Professional dark Studio Grid visual identity.
- Light-mode support.
- Responsive dashboard.
- Mobile navigation.
- Landing page.
- Pricing section.
- FAQ/help.
- Login/signup/forgot-password.
- Google OAuth button.
- MFA/TOTP enrollment and verification.
- CAPTCHA/Turnstile support.
- Dashboard statistics.
- Projects.
- Search.
- Favorites.
- Archive/restore.
- Rename.
- Duplicate.
- Delete with confirmation.
- Templates.
- AI Designer/generator.
- AI editing.
- Project editor.
- Monaco code editor.
- Version history.
- Design handoff.
- Prototype viewer.
- Device frames.
- Public prototype sharing.
- QR code.
- Comments.
- Comment replies.
- Comment resolution.
- Notifications.
- Billing.
- Referral system.
- Account deletion.
- Help center.
- Legal pages.
- Admin pages.
- Loading/empty/error states.
- Reusable Button/Panel/Input/Select/Modal/Drawer/Tabs/Tooltip/Dropdown/Badge/Skeleton components.
- Reveal animations.
- Tilt card.
- Hover transitions.
- Reduced-motion handling.

## Backend

- Supabase Auth.
- Supabase database.
- Supabase RLS.
- Server-side service-role client.
- Project CRUD.
- Screen CRUD.
- Screen reorder.
- Version history.
- AI editing.
- AI generation.
- Generation cache.
- Rate limiting.
- Credit system.
- Plan gating.
- Paddle checkout.
- Paddle webhook verification.
- Payment records.
- Subscription cancellation.
- Referral tracking.
- Notifications.
- Public sharing.
- Comments.
- Replies.
- Account export.
- Account deletion.
- Contact endpoint.
- Health endpoint.
- Cron credit reset.
- Admin dashboard APIs.
- Resend integration.
- Multiple AI provider integrations.

---

# 4. Important issues/gaps found

## P0 — must fix before production

### 1. Next.js version is no longer acceptable for a new production launch

The project uses Next.js 14.2.35.

Current Next.js guidance lists 14.x as unsupported, while the current supported major lines are 16.x Active LTS and 15.x Maintenance LTS. The Next.js site also announced an August 2026 security release requiring upgrades to 16.3.3 or 15.5.24 for critical vulnerabilities.

Do not blindly upgrade in-place without testing. Create a dedicated upgrade phase, run the complete E2E suite, then deploy.

### 2. Google OAuth "Continue with Google" needs a real browser test

The code calls:

`supabase.auth.signInWithOAuth({ provider: 'google', ... })`

and uses `/auth/callback`.

The callback exchanges the authorization code and redirects to the requested path.

A white page can therefore be caused by:
- Google OAuth provider configuration.
- Wrong Supabase redirect URL.
- Wrong production site URL.
- Google Cloud OAuth client configuration.
- Supabase Auth URL configuration.
- Missing/incorrect environment variables.
- Callback exception.
- Failed user/subscription provisioning.
- Invalid redirect target.
- Browser console/runtime error.

The current login button also does not explicitly show a user-facing error if `signInWithOAuth()` itself fails.

### 3. Resend does NOT currently implement the exact requested login-notification behavior

Current behavior:
- A welcome email is sent from the OAuth/email callback when a user is detected as first-time.
- Low-credit emails exist.
- Payment-failed email exists.
- Subscription-cancelled email exists.
- Contact form email exists.

But the requested requirement is:

"Send an email notification whenever a user signs in/logs in/signs up."

That requires an explicit authentication-event email system.

Implement separate event types:
- SIGNUP
- EMAIL_VERIFIED
- GOOGLE_SIGN_IN
- PASSWORD_LOGIN
- MFA_LOGIN_SUCCESS
- PASSWORD_RESET_REQUESTED
- PASSWORD_CHANGED
- PAYMENT_SUCCESS
- PAYMENT_FAILED
- SUBSCRIPTION_CANCELED
- LOW_CREDITS

Do NOT send duplicate emails when one authentication flow triggers multiple callbacks.

### 4. Welcome email contains stale credit text

The database/code now uses 1,500 Free credits, but `lib/email.ts` still says:

"You've got 150 free credits"

Change it to use the real plan configuration dynamically instead of hardcoding a number.

### 5. AI fallback chain does not exactly match the requested architecture

Current behavior is effectively:

Simple:
Groq → Cerebras → OpenRouter

Complex:
Claude first if `ANTHROPIC_API_KEY` exists; otherwise:
Groq → Cerebras → OpenRouter

The requested architecture is:

Groq
→ if rate limit/exhaustion → Cerebras
→ if rate limit/exhaustion → OpenRouter
→ if rate limit/exhaustion or configured difficult-task fallback → Claude

Implement a centralized provider router so this behavior is configurable and observable.

Do not fallback on every HTTP error. Distinguish:
- 429 rate limit
- quota exhausted
- timeout
- 5xx temporary failure
- invalid API key
- invalid request
- model unavailable

Invalid keys should not silently burn through every provider.

### 6. No true automated E2E test suite

There are no Playwright/Cypress-style tests in the archive.

Add Playwright tests for:
- landing
- signup
- email verification flow
- login
- Google OAuth callback simulation
- MFA
- dashboard
- project creation
- AI generation
- AI edit
- project rename
- duplicate
- archive
- restore
- delete
- template use
- sharing
- comments
- replies
- resolve
- billing UI
- account deletion
- logout
- mobile navigation
- light/dark mode
- error/loading/empty states

---

# 5. Important product gaps preventing 10/10

These should be implemented if the goal is a serious market-leading SaaS.

## AI product

- AI design generation history.
- Regenerate individual screen.
- Regenerate section/component.
- AI theme transformation.
- AI copywriting.
- AI accessibility improvement.
- AI responsive conversion.
- AI mobile/desktop adaptation.
- AI UX critique.
- AI design consistency checker.
- AI design-to-code improvement.
- AI component extraction.
- AI reusable design system generation.
- Prompt history.
- Saved prompts.
- Prompt templates.
- Generation cancellation with real server-side abort.
- Streaming generation/progress.
- Generation retry.
- Provider status and fallback logging.
- Model selection for advanced users.
- Usage/cost dashboard for admins.

## Design editor

- Real visual property inspector.
- Component tree.
- Layers.
- Drag/drop.
- Spacing controls.
- Typography controls.
- Color controls.
- Border/radius/shadow controls.
- Responsive breakpoints.
- Design tokens.
- Reusable components.
- Auto-layout style behavior.
- Multi-select.
- Undo/redo.
- Keyboard shortcuts.
- Copy/paste.
- Duplicate element.
- Alignment tools.
- Grid/guides.
- Snap-to-grid.
- Asset manager.
- Image upload.
- SVG support.
- Icon library.
- Font management.

## Collaboration

- Organizations/workspaces.
- Team members.
- Invite system.
- Roles/permissions.
- Owner/admin/editor/viewer roles.
- Team billing.
- Activity feed.
- Presence.
- Real-time collaboration.
- Mentions.
- Notifications for comments.
- Assignment of comments/tasks.
- Share permissions.
- Password-protected links.
- Expiring share links.

## Publishing

Current system shares prototypes, but it is not a full website hosting platform.

For 10/10, add:
- Publish production site.
- Versioned deployments.
- Custom domains.
- SSL automation.
- Subdomain.
- Publish/unpublish.
- Deployment history.
- Rollback.
- SEO metadata.
- Open Graph images.
- Sitemap.
- Robots.
- Custom favicon.
- Custom code injection where safe.
- Form handling.
- Analytics integration.
- Site performance monitoring.

## Storage/assets

Use Supabase Storage properly for:
- project assets
- images
- logos
- generated exports
- avatars
- uploaded references
- screenshots
- Figma/import files

Add:
- quotas
- upload validation
- file size limits
- MIME validation
- private/public buckets
- signed URLs
- cleanup jobs

## SaaS operations

Add:
- PostHog/Plausible product analytics.
- Sentry or another real error-monitoring system.
- Uptime monitoring.
- Admin AI cost dashboard.
- AI provider health dashboard.
- Revenue dashboard.
- MRR/ARR.
- churn.
- conversion funnel.
- activation rate.
- retention.
- generation success rate.
- API latency.
- failed jobs.
- webhook logs.
- audit log.
- feature flags.
- maintenance mode.
- status page.

---

# 6. Frontend 10/10 requirements

Do NOT simply add random animation everywhere.

Use a coherent motion system.

Every important UI region should have purposeful:
- hover transition
- press feedback
- entrance animation
- loading animation
- skeleton
- success animation
- error animation where appropriate
- card elevation
- focus state
- disabled state
- empty state
- responsive behavior

Required animation categories:
- Hero reveal
- Staggered feature cards
- Pricing-card hover
- Dashboard stat count-up
- Project-card hover/tilt
- Sidebar transitions
- Mobile drawer slide
- Modal scale/fade
- Dropdown fade/scale
- Tabs transition
- Toast animation
- Button press
- AI generation state animation
- AI result reveal
- Editor panel transition
- Version history transition
- Prototype device transition
- Comment pin animation
- Share dialog transition
- Billing checkout transition
- Success/checkmark animation
- Skeleton shimmer
- Page transition

Use:
- transform
- opacity
- scale
- translate
- blur only when performance allows
- CSS transitions
- IntersectionObserver for reveal effects
- reduced-motion support

Avoid:
- animation on every tiny text node
- constant infinite animations
- excessive bounce
- animations that slow the workflow
- inaccessible motion
- layout-shifting animations

---

# 7. How to diagnose the Google white-page issue

Run this exact sequence.

## Browser

1. Open Chrome DevTools.
2. Console → reproduce "Continue with Google".
3. Network → preserve log.
4. Click Google.
5. Complete Google authentication.
6. Inspect the final request to `/auth/callback`.
7. Check HTTP status.
8. Check response.
9. Check browser console.
10. Check whether `/dashboard` returns 200/3xx/500.

## Supabase

Verify:
- Authentication → Providers → Google = enabled.
- Google Client ID is correct.
- Google Client Secret is correct.
- Supabase Site URL is the real production URL.
- Supabase Redirect URLs contain the exact production callback:
  `/auth/callback`
- Local callback is also configured when testing locally.

## Google Cloud

Verify the OAuth client contains the exact Supabase callback URL generated by the Supabase project.

## Server logs

Add structured logging around:
- OAuth start
- callback received
- code exchange
- user ID
- user upsert
- subscription lookup
- subscription creation
- welcome/login email result
- final redirect

Never log passwords, access tokens, OAuth secrets, API keys, or full session tokens.

---

# 8. How to test the entire application

Claude Code must use this sequence.

## Static checks

Run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm audit
```

If the current Next.js version is unsupported, upgrade it before production.

## Database

Apply:

```text
schema.sql
001_premium_workspace.sql
002_launch_fixes.sql
003_project_management.sql
004_ai_history_and_templates.sql
005_publishing_and_collaboration.sql
006_fix_rls_recursion.sql
```

Then test:
- owner access
- non-owner denial
- anonymous public share
- private project denial
- project deletion
- screen deletion
- comment deletion
- reply deletion
- subscription access

## Browser tests

Use Playwright.

For every major page test:

1. Loading state
2. Empty state
3. Normal state
4. Error state
5. Mobile state
6. Desktop state
7. Keyboard navigation
8. Accessibility
9. Light mode
10. Dark mode

## API tests

Every API route must test:
- unauthenticated request
- authenticated request
- wrong user/project ID
- malformed JSON
- invalid schema
- rate limit
- insufficient credits
- provider failure
- database failure
- successful response

---

# 9. Production acceptance criteria

Do not call the project "10/10" until all of these are true.

- Zero TypeScript errors.
- Zero lint errors.
- Production build passes.
- No critical/high security issue left unexplained.
- Supported Next.js version.
- No exposed secrets.
- Google OAuth works.
- Email/password login works.
- Signup works.
- Email verification works.
- MFA works.
- Password reset works.
- Resend works.
- Login notifications work according to user settings.
- No duplicate authentication emails.
- AI provider fallback works.
- AI generation succeeds.
- AI generation failure does not charge credits.
- Credit deduction is atomic.
- Duplicate generation cache does not double-charge.
- Paddle checkout works.
- Paddle webhook verification works.
- Subscription upgrade works.
- Subscription cancellation works.
- Payment failure handling works.
- Project CRUD works.
- Version history works.
- Templates work.
- Public prototype works.
- Private prototype is private.
- Comments work.
- Replies work.
- Resolve works.
- Code export works where enabled.
- Figma is either genuinely implemented or clearly marked unavailable.
- Mobile navigation works.
- Light mode works.
- Dark mode works.
- Keyboard navigation works.
- Screen-reader basics work.
- Error states work.
- Loading states work.
- Empty states work.
- No major layout shifts.
- No console errors on normal flows.
- No broken buttons.
- No fake feature claims.
- No "coming soon" feature is presented as production-ready.
- Analytics works.
- Error monitoring works.
- Admin audit logs work.
- Backups/recovery plan exists.
- Rate limiting works.
- Abuse protection works.
- Terms/privacy/refund policies contain real company information.
- Production domain works.
- Email domain is verified.
- Paddle production account is configured.
- Supabase production configuration is configured.
- CI passes.

---

# 10. Claude Code MASTER COMMAND

Paste the following command into Claude Code from the root of the UFO repository.

```text
You are the principal engineer, product architect, senior UI/UX designer, security engineer,
QA lead, DevOps engineer and SaaS product manager responsible for taking this UFO project to
production-grade, market-leading quality.

PROJECT:
UFO is an AI UI/UX designer SaaS product owned by TechTig.

CORE PRODUCT:
A user describes a product/design idea. UFO uses AI to generate a complete multi-screen UI/UX
prototype, lets the user edit/refine it, preview it, collaborate through comments, share it,
and export where the plan permits.

YOUR OBJECTIVE:
Upgrade the existing project without destroying working functionality.

Target quality:
10/10 production-grade SaaS foundation.

IMPORTANT:
Do not blindly rewrite the project.
Do not replace working architecture just because you prefer another stack.
Do not delete existing features.
Do not create fake functionality.
Do not create buttons that do nothing.
Do not mark a feature complete unless it actually works end-to-end.
Do not expose API keys.
Do not commit .env files.
Do not fabricate test results.
Do not claim browser tests passed unless you actually ran them.

FIRST:
1. Inspect every file in the repository.
2. Inspect package.json and package-lock.json.
3. Inspect every app route.
4. Inspect every API route.
5. Inspect every component.
6. Inspect every lib file.
7. Inspect all Supabase SQL and migrations.
8. Inspect middleware.
9. Inspect next.config.js.
10. Inspect CI.
11. Inspect all documentation/notes because some may be stale or contradictory.
12. Create an internal dependency/feature map before changing code.

Do NOT start by deleting or rewriting files.

--------------------------------------------------
PHASE PLAN — EXACTLY 5 PHASES
--------------------------------------------------

Divide all required work into EXACTLY 5 major phases.

PHASE 1 — AUDIT, FOUNDATION, SECURITY, AUTHENTICATION
PHASE 2 — AI ENGINE, BACKEND, DATABASE, BILLING, EMAIL
PHASE 3 — FRONTEND/UI/UX 10/10 + RESPONSIVE + MOTION
PHASE 4 — PRODUCT FEATURES, COLLABORATION, PUBLISHING, STORAGE
PHASE 5 — TESTING, PERFORMANCE, SECURITY, OBSERVABILITY, FINAL POLISH

Do not move to the next phase until the current phase is tested.

After EACH phase:
1. Run typecheck.
2. Run lint.
3. Run production build.
4. Run relevant database tests.
5. Run relevant API tests.
6. Run Playwright/browser tests.
7. Check browser console for errors.
8. Check network requests.
9. Check responsive desktop/tablet/mobile layouts.
10. Check light and dark mode.
11. Check accessibility.
12. Check loading/empty/error/normal states.
13. Fix every issue discovered.
14. Re-run all tests.
15. Only when green, report:
   PHASE X = GREEN
16. List:
   - files changed
   - features added
   - bugs fixed
   - tests executed
   - test results
   - remaining risks

Do not declare a phase green while known critical issues remain.

--------------------------------------------------
PHASE 1
AUDIT + FOUNDATION + SECURITY + AUTH
--------------------------------------------------

A. Upgrade unsupported framework dependencies carefully.

The current project uses Next.js 14.x.
Check the current supported Next.js release and security advisories.
Upgrade to a supported stable version only after checking breaking changes.
Keep React/Next compatibility correct.

B. Authentication

Make all of these work:
- signup
- login
- logout
- email verification
- resend verification
- forgot password
- password reset
- Google OAuth
- MFA/TOTP
- CAPTCHA
- protected routes
- admin authorization
- session refresh
- redirect after authentication

CRITICAL GOOGLE OAUTH:
The current project has a reported "Continue with Google → white page" problem.
Investigate it with actual browser testing.

Instrument the OAuth callback with safe structured logs.
Never log secrets/tokens/passwords.

Check:
- Supabase Google provider
- Google Cloud OAuth configuration
- Supabase Site URL
- Supabase redirect URLs
- callback route
- exchangeCodeForSession
- user creation
- subscription creation
- final redirect
- production URL
- local URL

The Google button must show an error instead of silently failing.

C. Authentication emails

Use Resend.

Implement explicit authentication event handling:
- signup
- email verified
- password login
- Google login
- MFA login
- password reset request
- password changed

Do not send duplicate messages for the same event.

Add a user notification preference:
"Security/login email notifications"

Default it to enabled.

For every successful login event, send a security notification email if enabled.

Do not send emails before authentication is actually successful.

D. Security

Audit:
- RLS
- service-role usage
- CSRF-sensitive operations
- SSRF
- XSS
- HTML sanitization
- iframe isolation
- CSP
- security headers
- rate limits
- brute-force protection
- API abuse
- upload validation
- webhook verification
- open redirects
- authorization bypass
- IDOR
- admin routes
- secret exposure

Generated HTML must be safely rendered.
Do not trust AI-generated HTML.
Sanitize where appropriate while preserving the intended prototype behavior.

--------------------------------------------------
PHASE 2
AI + BACKEND + DATABASE + BILLING + RESEND
--------------------------------------------------

A. AI provider architecture

Implement a centralized AI provider router.

Required preferred cascade:

1. Groq
2. Cerebras
3. OpenRouter
4. Anthropic Claude

Fallback only for retryable conditions:
- 429
- quota/rate limit
- temporary 5xx
- timeout

Do NOT fallback on:
- invalid API key
- invalid request
- schema errors
- authorization errors that cannot succeed elsewhere

For difficult/large tasks, Claude may be preferred, but the behavior must be explicit and configurable.

Add:
- provider health logging
- latency logging
- provider used
- fallback reason
- request ID
- model
- success/failure
- token/usage metadata where available

Never log prompts containing secrets or sensitive customer data.

B. AI reliability

Add:
- structured JSON validation
- retry with safe limits
- malformed JSON recovery
- timeout
- cancellation where technically possible
- idempotency
- generation caching
- atomic credit deduction
- no credit charge on failed generation
- no double charge on retries
- request correlation IDs

C. AI features

Implement:
- full project generation
- regenerate project
- regenerate screen
- generate new screen
- AI component generation
- edit component
- change theme
- improve UX
- accessibility audit
- responsive conversion
- copy improvement
- design consistency check
- design system extraction
- prompt history
- saved prompts

D. Supabase

Review every table and RLS policy.

Test:
- owner access
- non-owner denial
- anonymous public share
- private project protection
- cascading deletes
- comments/replies
- version history
- notifications
- subscriptions
- payments
- referrals
- request logs
- generation cache

Use transactions or server-side atomic operations wherever money/credits are involved.

E. Paddle

Verify:
- checkout
- plan upgrade
- subscription creation
- subscription update
- payment success
- payment failure
- cancellation
- renewal
- webhook signature verification
- duplicate webhook idempotency
- plan/credit synchronization

Never trust the client to grant a paid plan.

F. Resend

Use dynamic configuration and correct verified sender domain.

Fix stale hardcoded credit numbers.
Use actual plan data.

Implement:
- welcome
- login security notification
- signup notification
- verification-related messaging
- password reset
- payment success
- payment failed
- subscription canceled
- low credits
- support/contact

Add an email event log so admins can diagnose delivery attempts without exposing sensitive data.

--------------------------------------------------
PHASE 3
FRONTEND 10/10
--------------------------------------------------

Redesign/refine the existing frontend rather than replacing the product identity.

Design goals:
- premium AI SaaS
- modern
- clean
- professional
- high conversion
- excellent UX
- light and dark mode
- responsive
- fast
- consistent

Use the existing visual language as the foundation.

EVERY major interactive UI area should have:
- card treatment where appropriate
- hover state
- active state
- pressed state
- focus state
- disabled state
- loading state
- success state
- error state
- empty state
- responsive state
- purposeful transition

Animations must be DIFFERENT and PURPOSEFUL.

Use:
- fade
- slide
- scale
- stagger
- reveal
- card lift
- subtle tilt
- modal scale
- drawer slide
- dropdown fade/scale
- skeleton shimmer
- count-up
- AI generation pulse
- result reveal
- tab transitions
- toast transitions
- comment-pin transitions
- editor panel transitions
- page transitions where appropriate

Do not animate everything simultaneously.
Respect prefers-reduced-motion.

Audit:
- spacing
- padding
- margins
- typography
- font sizes
- line heights
- card sizes
- button sizes
- icon alignment
- grid
- container width
- sidebar width
- mobile breakpoints
- tablet layouts
- touch targets
- visual hierarchy
- contrast
- empty states
- form validation
- focus rings
- hover consistency

Use a single design-token system.

Make sure:
- no overflow
- no clipped content
- no horizontal scrolling accidentally
- no layout shift
- no white-on-white text
- no tiny touch targets
- no broken mobile navigation

Pages to audit individually:
- landing
- pricing
- login
- signup
- forgot password
- dashboard
- projects
- project editor
- AI Designer
- templates
- billing
- settings
- help
- contact
- legal
- public prototype
- admin
- error pages

--------------------------------------------------
PHASE 4
PRODUCT FEATURES + COLLABORATION + PUBLISHING + STORAGE
--------------------------------------------------

A. Collaboration

Implement:
- workspaces
- organizations
- team invites
- roles
- permissions
- team member management
- comment mentions
- comment assignments
- activity feed
- share permissions
- password-protected share links
- expiring share links
- real-time collaboration where appropriate

B. Asset management

Use Supabase Storage.

Implement:
- upload
- delete
- rename
- preview
- file type validation
- file size validation
- project asset folders
- signed URLs
- quotas
- cleanup

Support:
- images
- logos
- screenshots
- reference designs
- generated assets

C. Design editor

Improve editor with:
- layers
- component tree
- visual inspector
- typography
- colors
- spacing
- borders
- radius
- shadows
- responsive breakpoints
- reusable components
- tokens
- drag/drop where feasible
- multi-select
- alignment
- undo/redo
- keyboard shortcuts

D. Publishing

If real hosting is implemented, add:
- publish
- unpublish
- deployment history
- rollback
- custom domains
- SSL
- subdomains
- SEO
- Open Graph
- sitemap
- robots
- favicon
- analytics
- deployment status

If a feature cannot safely be completed in this phase, do NOT fake it.
Either implement it fully or clearly label it unavailable.

--------------------------------------------------
PHASE 5
QA + PERFORMANCE + OBSERVABILITY + FINAL RELEASE
--------------------------------------------------

A. Add Playwright.

Create full E2E suite.

B. Add unit/integration tests for:
- credits
- plan gating
- AI provider router
- webhook signature validation
- auth callback
- project authorization
- RLS-sensitive operations
- email event deduplication

C. Performance

Measure:
- Lighthouse
- Core Web Vitals
- initial JS
- route load
- AI generation latency
- database query latency
- image size
- editor bundle
- Monaco loading
- mobile performance

Keep Monaco lazy loaded.

C. Observability

Add:
- Sentry or equivalent
- product analytics such as PostHog/Plausible
- server logs
- structured request IDs
- AI provider metrics
- webhook logs
- email event logs
- uptime monitoring

D. Admin

Build:
- users
- subscriptions
- payments
- revenue
- AI usage
- provider health
- failed generations
- email delivery events
- audit log
- support activity
- system health

E. Final security audit

Run:
```bash
npm audit
```

Resolve critical/high issues where practical.
Document anything that cannot be upgraded without a deliberate compatibility migration.

F. Final UX audit

No:
- dead buttons
- broken links
- placeholder copy
- fake numbers
- stale pricing
- stale credit counts
- fake features
- misleading feature descriptions
- console errors
- hydration errors
- accessibility blockers

--------------------------------------------------
TESTING RULE
--------------------------------------------------

After every code change:
- run the smallest relevant test
- then run the full phase test suite

At the end of each phase run:

npm run typecheck
npm run lint
npm run build
npm audit

And run Playwright for the features changed in that phase.

For browser failures:
- capture console error
- capture network request
- identify exact file
- identify exact line
- reproduce
- fix
- retest

Do not merely hide errors.

--------------------------------------------------
FINAL REPORT
--------------------------------------------------

After Phase 5 produce:

1. Final score /10 for:
   - Product
   - UI/UX
   - AI
   - Backend
   - Auth
   - Database
   - Billing
   - Email
   - Security
   - Performance
   - Accessibility
   - Testing
   - Analytics
   - Collaboration
   - Publishing
   - Overall

2. Exact list of files changed.

3. Exact list of features implemented.

4. Exact list of bugs found and fixed.

5. Exact test commands executed.

6. Exact test results.

7. Remaining risks.

8. Production deployment checklist.

9. Environment-variable checklist.

10. Database migration checklist.

11. Paddle configuration checklist.

12. Supabase authentication checklist.

13. Resend domain/email checklist.

14. Google OAuth checklist.

15. Final statement:
   - DO NOT say "10/10" unless the acceptance criteria are actually satisfied.
   - If something remains, give its exact reason and severity.

MOST IMPORTANT:
This is an existing production-oriented SaaS. Preserve working functionality.
Improve it incrementally.
Never sacrifice security for visual polish.
Never sacrifice correctness for speed.
Never create fake features.
Never claim tests passed when they were not run.

# APPENDIX — UFO 2026 FRONTEND DESIGN DIRECTION

## Design decision
Use a hybrid **Dark-first AI Design Studio + Calm Density + Premium Editorial Marketing + Refined Glass Layers** direction. Do not copy one generic SaaS template. UFO should feel like serious professional creative software, not a generic AI chatbot.

Use these principles as inspiration: Linear-style restrained dark product UI; Vercel-style minimal chrome and typography; Stripe-style clarity for billing/data; Figma-style professional creative-tool workflow; Untitled UI-style systematic tokens/components; shadcn-compatible architecture where practical. Current 2026 SaaS guidance emphasizes calm density, minimal chrome, semantic tokens, embedded/in-context AI and restrained brand-driven motion. Figma's current guidance emphasizes shared design systems, components, variables/tokens, responsive layouts and interaction-state validation.

## Color system
**Dark-first:** Background #080B12; secondary #0D111A; surface #111722; hover #151D2A; border rgba(255,255,255,.08); strong border rgba(255,255,255,.14); primary text #F7F9FC; secondary #A7B0C0; muted #737D8F; brand violet #7C5CFC; blue-violet #5B8CFF; AI accent #9B7BFF; success #2ECC8A; warning #F5B942; error #FF5C6C; info #55A8FF.

**Light:** Background #F7F8FB; surface #FFFFFF; text #121722; secondary #667085; border #E5E7EB.

Use semantic CSS variables/design tokens everywhere. Do not scatter hardcoded colors across components. Light mode must be a first-class theme, not an afterthought.

## Typography
Use Inter/Geist-style modern sans typography depending on the existing safe font setup. Display 48–72px desktop / 36–48px tablet / 32–40px mobile; H1 36–48px; H2 28–36px; H3 20–24px; body 14–16px; small 12–13px. Use strong hierarchy, readable line heights and tabular numerals for metrics.

## Layout
Use calm density and an 8px spacing system: 4/8/12/16/20/24/32/40/48/64px. Desktop: 240–260px sidebar, compact command/header bar, 12-column content grid, max content width around 1440px. Mobile: compact drawer/bottom navigation where appropriate, minimum 44px touch targets, no horizontal scrolling. Do not build a wall of giant cards.

## Surfaces/cards
Use three levels: flat background, subtle 1px bordered surface, elevated/glass surface. Radius 10/14/18/20px. Use subtle shadows. Use glass only for command palette, floating toolbar, modals, AI generation overlays, contextual menus and selected editor tools. Do not make the whole dashboard translucent.

## Landing page
Structure: Hero → Product/demo preview → How UFO works → AI capabilities → Generated-design gallery → Editor capabilities → Collaboration → Publishing/export → Pricing → FAQ → Final CTA → Footer.
Hero: product badge, strong value proposition, primary CTA, secondary demo CTA, animated real product preview, subtle grid/noise background. Use restrained bento-style feature sections.

## Dashboard
Prioritize Create with AI, Recent Projects, Continue Designing, Templates, Credits/Usage and Activity. Do not overload the first screen with analytics. The primary action must be obvious within seconds.

## AI Designer — signature UFO interface
Use a three-region workspace. Left: prompt/context, project requirements, style controls. Center: live generated design/prototype. Right: AI suggestions, screens, properties/quick actions. Top: project title, device selector, preview, share, export, generate.

Generation stages must reflect real backend state: Understanding requirements → Planning information architecture → Designing screens → Applying design system → Preparing prototype. Never show fake percentages.

## Editor
Make it feel like professional creative software. Use compact toolbar, canvas, layers, properties, screen navigator and responsive device preview. Include layout, spacing, typography, colors, borders, radius, shadows and responsive settings. Keyboard shortcuts: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Cmd/Ctrl+C, Cmd/Ctrl+V, Cmd/Ctrl+D, Delete/Backspace, Escape, Cmd/Ctrl+K command palette.

## Project cards
Show preview, title, updated time, screen count, favorite and more menu. Hover: 2px lift, subtle border emphasis, preview scale 1.01, action reveal. Do not use aggressive 3D tilt on every card; reserve tilt for selected marketing/demo cards.

## Templates
Visual gallery categories: SaaS, AI, Dashboard, Mobile, E-commerce, Fintech, Education, Portfolio, Landing page. Each card shows preview, category, screen count, use-template action and favorite.

## Billing/settings
Billing should clearly show current plan, credits, renewal, payment status, usage, upgrade and billing history without dark patterns. Settings should use left navigation: Profile, Security, Notifications, AI preferences, Appearance, Billing, Data & privacy, Danger zone. Every section needs title, description, controls, validation and save feedback.

## Motion system
Use Framer Motion only if already present or justified by bundle/performance constraints; otherwise prefer CSS transitions/lightweight utilities. Timing: micro 120–180ms; standard 180–240ms; modal/drawer 220–320ms; section reveal 350–500ms. Use fade, slide, scale, stagger, reveal, card lift, drawer slide, modal scale, skeleton shimmer, count-up, AI generation pulse and result reveal. Respect prefers-reduced-motion.

Signature UFO generation-complete interaction: AI indicator transitions to success → generated design fades/scales into place → screen thumbnails stagger in → success toast appears. Do not animate every text node or constantly move the interface.

## Animation inventory
Marketing: hero reveal, headline reveal, CTA hover, product preview motion, bento reveal, feature-card reveal, pricing hover, FAQ expansion.
Application: sidebar collapse, mobile drawer, command palette, dropdown, modal, toast, tabs, filters, project cards, favorite/archive/delete feedback, template selection, AI generation/completion, screen selection, editor panels, device preview, comments/replies, share dialog, billing, settings save, success/error feedback.

## Accessibility
Implement prefers-reduced-motion, visible keyboard focus, semantic HTML, ARIA labels, accessible dialogs, focus trapping, WCAG AA contrast, minimum 44px touch targets and keyboard navigation. With reduced motion, remove parallax/large transforms and use opacity/subtle state changes.

## Loading/empty/error states
Every asynchronous feature gets an intentional loading state. Use skeletons for dashboard, project grid, templates, comments, billing and settings. AI generation must show meaningful real stages rather than a generic spinner. Empty states must explain the next action. Errors must use friendly messages, retry/support actions and optional request IDs; never expose raw stack traces.

## Responsive QA
Test 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px. Check clipping, overflow, touch targets, typography, editor usability, navigation, dialogs, forms, cards, tables and mobile actions.

## Figma-connected design selection — mandatory
Figma is connected to Claude Code. **Do not choose a template blindly.** First inspect the connected Figma resources/templates and compare SaaS suitability, AI-product suitability, dashboard quality, design-system completeness, responsive layouts, light/dark support, Auto Layout, variables/tokens, component variants, accessibility, developer handoff and compatibility with UFO's existing React architecture.

Preferred foundation: **Untitled UI-style systematic component discipline + shadcn-compatible implementation + Linear/Vercel calm-density product UX + Figma-like editor ergonomics.**

Claude Code must: (1) inspect available Figma resources, (2) compare candidates, (3) choose the best specifically for UFO, (4) explain why, (5) map Figma tokens to UFO CSS variables, (6) map Figma components to existing React components, (7) preserve working functionality, (8) avoid duplicate component systems, (9) implement consistently across every page, and (10) visually and functionally test the result.

Do not copy proprietary UI assets or another company's exact design.

## Frontend quality gate
Do not mark frontend complete until every route is visually audited and responsive; light and dark modes are polished; tokens, spacing, typography and components are consistent; loading/empty/error/focus states are complete; reduced motion is supported; there are no console/hydration errors, layout shifts, accidental horizontal scrolling, dead interactions or placeholder UI; key breakpoints are reviewed; Playwright tests pass; and the production build passes.

## Product feeling
The final interface must communicate: **Professional creative software powered by AI.** It must not feel like a generic AI chatbot, crypto dashboard, template marketplace or AI-generated landing page. UFO should feel like software designers can use for hours every day.
