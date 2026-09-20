-- ---------------------------------------------------------------------------
-- Migration 017 — admin action log, and feature flags.
--
-- Both additive and idempotent. No existing table is altered.
-- ---------------------------------------------------------------------------

-- 1. Admin action log ---------------------------------------------------------
--
-- Every operator action that changes someone else's account is recorded here,
-- with who did it and why. This is not bureaucracy: granting credits is the
-- one place in the product where an employee can create value out of nothing,
-- and "who gave this account 50,000 credits, and when" must be answerable
-- without reading application logs.
--
-- The reason field is NOT NULL on purpose. An audit trail of actions with no
-- stated reason answers "what happened" but not "why", which is the question
-- actually asked six months later.
create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null not null,
  action text not null check (action in ('grant_credits', 'set_flag')),
  -- The account acted upon, where the action targets one.
  target_user_id uuid references users(id) on delete set null,
  -- Free-form detail: the amount granted, the flag and its new value.
  detail jsonb not null default '{}'::jsonb,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on admin_actions (target_user_id, created_at desc);

alter table admin_actions enable row level security;

-- No policy at all: this table is service-role only. An admin reads it through
-- the console, which uses the service role; nothing client-side should be able
-- to read or write an audit trail, including an admin's own browser session.
revoke select, insert, update, delete on public.admin_actions from anon, authenticated;

-- 2. Feature flags ------------------------------------------------------------
--
-- Runtime flags, so an incomplete feature can ship dark and a misbehaving one
-- can be turned off without a deploy.
--
-- Readable by everyone, writable by nobody through the API: a flag that the
-- client could set would be a feature gate the client controls, which is not a
-- feature gate. Writes go through the admin console on the service role.
create table if not exists feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null
);

alter table feature_flags enable row level security;

drop policy if exists "flags are readable" on feature_flags;
create policy "flags are readable" on feature_flags for select using (true);

revoke insert, update, delete on public.feature_flags from anon, authenticated;
