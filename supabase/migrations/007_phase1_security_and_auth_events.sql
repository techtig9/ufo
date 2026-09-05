-- ============================================================================
-- Phase 1 — security hardening + authentication event log
-- Run after 001-006. Purely additive: creates two tables, enables RLS on one
-- pre-existing table, and adds one column. Touches no existing rows.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. CRITICAL — `templates` has never had RLS enabled.
--
-- supabase/schema.sql creates public.templates (Section 1) but the
-- `alter table ... enable row level security` block only covers users,
-- subscriptions, projects, screens, shares and payments. `templates` was
-- omitted, and migrations 001-006 never added it.
--
-- Supabase grants the `anon` and `authenticated` PostgREST roles full DML on
-- public-schema tables by default; RLS is the only thing that takes it away.
-- With RLS off, anyone holding the public anon key -- which ships in the
-- browser bundle -- can INSERT, UPDATE or DELETE template rows.
--
-- That is not merely a data-integrity problem. /api/templates/[id]/use copies
-- templates.screens verbatim into a new project, and those screens are then
-- rendered for the user, so a planted row becomes a stored payload delivered
-- to every user who clicks "Use this template".
--
-- Templates are meant to be a public, read-only catalogue: readable by
-- everyone (the gallery is browsable), writable only by the service-role key
-- (which bypasses RLS) from server-side code.
-- ---------------------------------------------------------------------------
alter table templates enable row level security;

drop policy if exists "templates are publicly readable" on templates;
create policy "templates are publicly readable"
  on templates for select
  using (true);

-- No insert/update/delete policies by design. With RLS enabled and no
-- permissive policy, those operations are denied for anon and authenticated.
-- Seeding/editing happens via the service-role client only.


-- ---------------------------------------------------------------------------
-- 2. Authentication event log (Master Command Phase 1.C).
--
-- Backs the "send a security notification on every successful login" rule
-- while satisfying "Do NOT send duplicate emails when one authentication flow
-- triggers multiple callbacks".
--
-- One authentication can legitimately produce several client-side signals
-- (password sign-in -> MFA challenge -> session refresh -> a remount that
-- re-fires the reporter). Rather than trying to suppress those at the call
-- site, every event is recorded here first and the email is only sent when
-- the insert actually created a new row inside the dedup window.
--
-- Deliberately stores no tokens, passwords, or session identifiers -- only the
-- event type, a coarse dedup key, and delivery bookkeeping.
-- ---------------------------------------------------------------------------
create table if not exists auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  event_type text not null check (event_type in (
    'SIGNUP',
    'EMAIL_VERIFIED',
    'PASSWORD_LOGIN',
    'GOOGLE_SIGN_IN',
    'MFA_LOGIN_SUCCESS',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_CHANGED'
  )),
  -- Coarse, non-identifying request context for the notification body.
  -- Never a token, never a full user agent fingerprint.
  ip_prefix text,
  user_agent_summary text,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'skipped_preference', 'skipped_unconfigured', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists auth_events_user_type_created_idx
  on auth_events (user_id, event_type, created_at desc);

alter table auth_events enable row level security;

-- A user may read their own security history (surfaced in Settings later).
-- Writes are service-role only: an authentication event must never be
-- forgeable by the client that is being authenticated.
drop policy if exists "users read own auth events" on auth_events;
create policy "users read own auth events"
  on auth_events for select
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 3. Webhook idempotency ledger.
--
-- Created here (not used yet) so Phase 2's Paddle work is application-only.
--
-- Paddle retries webhooks. app/api/webhooks/paddle/route.ts currently handles
-- subscription.created/updated by unconditionally resetting credits_remaining
-- to the plan total, so a retry mid-cycle silently refills a user's credits.
-- Recording each event id here first, and ignoring an event whose id is
-- already present, makes replays no-ops.
-- ---------------------------------------------------------------------------
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paddle',
  -- The provider's own event id. UNIQUE is what actually enforces idempotency:
  -- the second insert of the same id fails, and the handler skips the replay.
  event_id text not null,
  event_type text,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table webhook_events enable row level security;
-- Intentionally no policies -- service-role only, same as request_log
-- and generation_cache in schema.sql Section 3.


-- ---------------------------------------------------------------------------
-- 4. Per-user preference for security/login notification emails.
--
-- The Master Command requires this preference to exist and to default to
-- enabled. `not null default true` gives existing rows the enabled default
-- automatically.
--
-- Note the deliberate asymmetry with notify_low_credits: low-credit mail is
-- marketing-adjacent and freely optional, whereas security notifications are
-- the mechanism by which a user notices an account takeover. Both are
-- user-controllable, but this one defaults on and is described as such in the
-- UI rather than being bundled into a single "notifications" switch.
-- ---------------------------------------------------------------------------
alter table users
  add column if not exists notify_security_emails boolean not null default true;
