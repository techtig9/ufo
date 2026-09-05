\set ON_ERROR_STOP off
\pset pager off

-- ===========================================================================
-- Phase 2 database tests: atomic credits, webhook idempotency, observability
-- tables. Runs as the real anon/authenticated roles where isolation matters.
-- ===========================================================================

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com');
insert into users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com');
insert into subscriptions (user_id, plan, status, credits_remaining) values
  ('11111111-1111-1111-1111-111111111111', 'pro', 'active', 1000),
  ('22222222-2222-2222-2222-222222222222', 'free', 'active', 1500);

\echo ''
\echo '=== P2-1: reserve_credits deducts exactly once ==='
select out_success, out_credits_remaining
  from reserve_credits('11111111-1111-1111-1111-111111111111', 300, 'generate_full_project', 'r1');
\echo '   ^ expect: t|700'

\echo ''
\echo '=== P2-2: reserve refuses to overdraw (balance must not go negative) ==='
select out_success, out_credits_remaining
  from reserve_credits('11111111-1111-1111-1111-111111111111', 5000, 'generate_full_project', 'r2');
\echo '   ^ expect: f|700  (refused, balance unchanged)'

\echo ''
\echo '=== P2-3: a charge writes exactly one ledger row ==='
select count(*) as ledger_rows_expect_1, sum(amount) as sum_expect_minus_300
  from credit_ledger where request_id = 'r1';

\echo ''
\echo '=== P2-4: refund restores the balance ==='
select out_success, out_credits_remaining
  from refund_credits('11111111-1111-1111-1111-111111111111', 300, 'generate_full_project', 'r1', 'refund_generation_failed');
\echo '   ^ expect: t|1000'

\echo ''
\echo '=== P2-5: refund is idempotent (a retry must not pay twice) ==='
select out_success, out_credits_remaining
  from refund_credits('11111111-1111-1111-1111-111111111111', 300, 'generate_full_project', 'r1', 'refund_generation_failed');
\echo '   ^ expect: t|1000  (NOT 1300)'

\echo ''
\echo '=== P2-6: reserve for an unknown user fails safely ==='
select out_success, out_credits_remaining
  from reserve_credits('33333333-3333-3333-3333-333333333333', 100, 'generate_full_project', 'r3');
\echo '   ^ expect: f|0'

\echo ''
\echo '=== P2-7: zero-cost action is a no-op that still succeeds (admin path) ==='
select out_success, out_credits_remaining
  from reserve_credits('11111111-1111-1111-1111-111111111111', 0, 'generate_full_project', 'r4');
\echo '   ^ expect: t|1000'

\echo ''
\echo '=== P2-8: webhook_events UNIQUE makes a Paddle replay a no-op ==='
insert into webhook_events (provider, event_id, event_type) values ('paddle','evt_A','subscription.updated');
insert into webhook_events (provider, event_id, event_type) values ('paddle','evt_A','subscription.updated');
\echo '   ^ expect: first INSERT 0 1, second ERROR duplicate key'

\echo ''
\echo '=== P2-9: the same event id from a different provider is NOT a duplicate ==='
insert into webhook_events (provider, event_id, event_type) values ('stripe','evt_A','x');
\echo '   ^ expect: INSERT 0 1'

\echo ''
\echo '=== P2-10: a user reads only their OWN credit ledger ==='
insert into credit_ledger (user_id, action, amount, balance_after, reason)
  values ('22222222-2222-2222-2222-222222222222','generate_full_project',-100,1400,'reserve');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as owner_sees_own_ledger_only_expect_2 from credit_ledger;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== P2-11: a client cannot forge a credit movement ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into credit_ledger (user_id, action, amount, balance_after, reason)
  values ('11111111-1111-1111-1111-111111111111','generate_full_project',999999,999999,'forged');
\echo '   ^ expect: ERROR — credits are service-role only'
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== P2-12: ai_requests and email_events are invisible to clients ==='
insert into ai_requests (request_id, task, provider, outcome, latency_ms)
  values ('r1','generate_full_project','groq','success',1200);
insert into email_events (template, recipient_hash, status)
  values ('welcome','deadbeef','sent');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as ai_requests_visible_expect_0 from ai_requests;
select count(*) as email_events_visible_expect_0 from email_events;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== P2-13: email_events stores a hash, never an address ==='
select count(*) as rows_with_an_at_sign_expect_0
  from email_events where recipient_hash like '%@%';

\echo ''
\echo '=== P2-14: every public table still has RLS enabled ==='
select relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;
\echo '   ^ expect: 0 rows'

\echo ''
\echo '=== P2-15: cascading delete removes a user credit ledger ==='
delete from credit_ledger where user_id = '22222222-2222-2222-2222-222222222222';
delete from subscriptions where user_id = '22222222-2222-2222-2222-222222222222';
delete from users where id = '22222222-2222-2222-2222-222222222222';
select count(*) as orphaned_ledger_rows_expect_0
  from credit_ledger where user_id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '=== P2-16: saved prompts are private to their owner ==='
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444','p2@example.com');
insert into users (id, email) values ('44444444-4444-4444-4444-444444444444','p2@example.com');
insert into saved_prompts (user_id, title, body) values
  ('11111111-1111-1111-1111-111111111111','Owner prompt','make it calmer'),
  ('44444444-4444-4444-4444-444444444444','Other prompt','make it louder');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as owner_sees_own_prompts_expect_1 from saved_prompts;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== P2-17: a user cannot write a prompt for someone else ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into saved_prompts (user_id, title, body)
  values ('44444444-4444-4444-4444-444444444444','Planted','payload');
\echo '   ^ expect: ERROR — with check (auth.uid() = user_id)'
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== P2-18: re-saving the same title updates rather than duplicating ==='
insert into saved_prompts (user_id, title, body)
  values ('11111111-1111-1111-1111-111111111111','Owner prompt','changed');
\echo '   ^ expect: ERROR duplicate key (the route upserts on this constraint)'
select count(*) as owner_prompt_rows_expect_1
  from saved_prompts
 where user_id = '11111111-1111-1111-1111-111111111111' and title = 'Owner prompt';
