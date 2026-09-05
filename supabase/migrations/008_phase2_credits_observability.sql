-- ============================================================================
-- Phase 2 — atomic credits, AI provider observability, email delivery log
-- Run after 001-007. Purely additive: three tables and two functions.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Credit ledger.
--
-- Every credit movement, append-only. Exists for three reasons:
--   * it makes a double-charge detectable after the fact rather than invisible;
--   * a reservation that is never resolved (server killed mid-generation) is
--     auditable instead of silently lost;
--   * it is the data source for the admin AI-cost view Phase 5 calls for.
--
-- `amount` is signed: negative charges, positive refunds. The running balance
-- is recorded alongside so the ledger can be reconciled against
-- subscriptions.credits_remaining without replaying every row.
-- ---------------------------------------------------------------------------
create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  action text not null,
  amount int not null,
  balance_after int not null,
  -- Correlates a charge with its refund, and with the ai_requests rows for the
  -- same generation.
  request_id text,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_created_idx
  on credit_ledger (user_id, created_at desc);
create index if not exists credit_ledger_request_idx
  on credit_ledger (request_id);

alter table credit_ledger enable row level security;

drop policy if exists "users read own credit ledger" on credit_ledger;
create policy "users read own credit ledger"
  on credit_ledger for select
  using (auth.uid() = user_id);
-- No write policies: only the service role may move credits.


-- ---------------------------------------------------------------------------
-- 2. Atomic credit reservation.
--
-- Replaces the read-modify-write in /api/generate and
-- /api/projects/[id]/ai-edit:
--
--     const newBalance = subscription.credits_remaining - cost;
--     await admin.from('subscriptions').update({ credits_remaining: newBalance })
--
-- Two concurrent generations both read the same balance and both write
-- `balance - cost`, so the user is charged once for two generations. The
-- Master Command's acceptance criteria require this to be atomic.
--
-- The single UPDATE below carries its own guard: Postgres takes a row lock for
-- the duration, so concurrent callers serialise and the second one sees the
-- already-decremented balance. If it can no longer afford the charge the
-- UPDATE matches no row and the caller is told, rather than the balance going
-- negative.
--
-- Returns (success, credits_remaining) so the caller can distinguish
-- "insufficient credits" from "no subscription row".
-- ---------------------------------------------------------------------------
create or replace function public.reserve_credits(
  p_user_id uuid,
  p_amount int,
  p_action text,
  p_request_id text default null
)
-- The OUT columns are named out_* on purpose: a RETURNS TABLE column becomes a
-- PL/pgSQL variable, and a column named `credits_remaining` would then be
-- ambiguous against subscriptions.credits_remaining inside the UPDATE below.
returns table (out_success boolean, out_credits_remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if p_amount is null or p_amount <= 0 then
    select s.credits_remaining into v_balance
      from subscriptions s where s.user_id = p_user_id;
    if not found then
      return query select false, 0;
    else
      return query select true, v_balance;
    end if;
    return;
  end if;

  update subscriptions
     set credits_remaining = credits_remaining - p_amount
   where user_id = p_user_id
     and credits_remaining >= p_amount
  returning subscriptions.credits_remaining into v_balance;

  if v_balance is null then
    -- Either no subscription row, or not enough credits. Report the real
    -- balance so the caller can produce an accurate message.
    select s.credits_remaining into v_balance
      from subscriptions s where s.user_id = p_user_id;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into credit_ledger (user_id, action, amount, balance_after, request_id, reason)
  values (p_user_id, p_action, -p_amount, v_balance, p_request_id, 'reserve');

  return query select true, v_balance;
end;
$$;


-- ---------------------------------------------------------------------------
-- 3. Refund.
--
-- The reserve-then-refund order matters. Charging only after a successful
-- generation looks simpler, but under concurrency two requests can both pass
-- the affordability check and both generate before either writes, so one of
-- them is free. Reserving first makes the charge authoritative; this refunds
-- when the work then fails, satisfying "AI generation failure does not charge
-- credits".
--
-- Idempotent per (request_id, action): a retried refund for the same request
-- is a no-op, so a caller that fails twice cannot hand back credits twice.
-- ---------------------------------------------------------------------------
create or replace function public.refund_credits(
  p_user_id uuid,
  p_amount int,
  p_action text,
  p_request_id text,
  p_reason text default 'refund'
)
returns table (out_success boolean, out_credits_remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_already int;
begin
  if p_amount is null or p_amount <= 0 then
    select s.credits_remaining into v_balance
      from subscriptions s where s.user_id = p_user_id;
    return query select true, coalesce(v_balance, 0);
    return;
  end if;

  -- Idempotency: a refund already recorded for this request is not repeated.
  select count(*) into v_already
    from credit_ledger
   where request_id = p_request_id
     and action = p_action
     and amount > 0;

  if v_already > 0 then
    select s.credits_remaining into v_balance
      from subscriptions s where s.user_id = p_user_id;
    return query select true, coalesce(v_balance, 0);
    return;
  end if;

  update subscriptions
     set credits_remaining = credits_remaining + p_amount
   where user_id = p_user_id
  returning subscriptions.credits_remaining into v_balance;

  if v_balance is null then
    return query select false, 0;
    return;
  end if;

  insert into credit_ledger (user_id, action, amount, balance_after, request_id, reason)
  values (p_user_id, p_action, p_amount, v_balance, p_request_id, p_reason);

  return query select true, v_balance;
end;
$$;


-- ---------------------------------------------------------------------------
-- 4. AI request log — provider health, latency and fallback observability.
--
-- The Master Command (2.A) requires provider health logging, latency, provider
-- used, fallback reason, request id, model, success/failure and token usage.
-- One row per ATTEMPT, not per request: a request that falls back from Groq to
-- Cerebras writes two rows sharing a request_id, which is what makes
-- "how often is Groq rate limiting us" answerable.
--
-- Deliberately stores no prompt or completion text — only metadata.
-- ---------------------------------------------------------------------------
create table if not exists ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  request_id text not null,
  task text not null,
  provider text not null,
  model text,
  outcome text not null check (outcome in ('success', 'retryable_failure', 'fatal_failure')),
  http_status int,
  latency_ms int,
  fallback_reason text,
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz not null default now()
);

create index if not exists ai_requests_request_idx on ai_requests (request_id);
create index if not exists ai_requests_provider_created_idx
  on ai_requests (provider, created_at desc);
create index if not exists ai_requests_user_created_idx
  on ai_requests (user_id, created_at desc);

alter table ai_requests enable row level security;
-- Intentionally no policies — service-role only, same as request_log.


-- ---------------------------------------------------------------------------
-- 5. Email delivery log (Master Command 2.F).
--
-- "Add an email event log so admins can diagnose delivery attempts without
-- exposing sensitive data."
--
-- Hence recipient_hash rather than the address, and an error class rather than
-- the provider's raw error string: enough to answer "are welcome emails
-- bouncing" without turning the table into a mailing list or a copy of the
-- message bodies.
-- ---------------------------------------------------------------------------
create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  template text not null,
  recipient_hash text not null,
  status text not null check (status in ('sent', 'failed', 'skipped_unconfigured')),
  provider_message_id text,
  error_class text,
  created_at timestamptz not null default now()
);

create index if not exists email_events_created_idx on email_events (created_at desc);
create index if not exists email_events_template_status_idx
  on email_events (template, status, created_at desc);

alter table email_events enable row level security;
-- Intentionally no policies — service-role only. Users see their own
-- authentication history through auth_events instead.
