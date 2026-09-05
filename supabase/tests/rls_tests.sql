\set ON_ERROR_STOP off
\pset pager off

-- ===========================================================================
-- RLS test suite. Runs as the real `anon` / `authenticated` PostgREST roles,
-- NOT as superuser (a superuser session bypasses RLS entirely, which is how
-- the migration-006 recursion bug went unnoticed originally).
-- ===========================================================================

-- Seed data as superuser (mimics the service-role client).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'attacker@example.com');

insert into users (id, email, name) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'attacker@example.com', 'Attacker');

insert into projects (id, user_id, name)
  values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Owner Project');

insert into screens (id, project_id, name, order_index, code)
  values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Home', 0, '<main>hi</main>');

-- One private share and one public share.
insert into shares (id, project_id, slug, is_public) values
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'private-slug', false);

\echo ''
\echo '=== TEST 1: anon CANNOT write to templates (the Phase 1 fix) ==='
reset request.jwt.claim.sub;
set role anon;
insert into templates (category, name) values ('evil', 'PLANTED BY ANON');
\echo '   ^ expect: ERROR permission denied / violates row-level security'
reset role;
reset request.jwt.claim.sub;
select count(*) as planted_rows_should_be_0 from templates where name = 'PLANTED BY ANON';

\echo ''
\echo '=== TEST 2: anon CAN still read the template gallery ==='
reset request.jwt.claim.sub;
set role anon;
select count(*) > 0 as anon_can_read_templates from templates;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== TEST 3: anon CANNOT update or delete templates ==='
reset request.jwt.claim.sub;
set role anon;
update templates set name = 'HIJACKED';
\echo '   ^ expect: 0 rows (RLS filters every row from the UPDATE)'
delete from templates;
\echo '   ^ expect: 0 rows'
reset role;
reset request.jwt.claim.sub;
select count(*) as templates_still_intact from templates;

\echo ''
\echo '=== TEST 4: non-owner CANNOT read another user private project ==='
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as attacker_sees_projects_expect_0 from projects;
select count(*) as attacker_sees_screens_expect_0 from screens;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== TEST 5: owner CAN read their own project ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as owner_sees_projects_expect_1 from projects;
select count(*) as owner_sees_screens_expect_1 from screens;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== TEST 6: anon CANNOT read a PRIVATE share (is_public=false) ==='
reset request.jwt.claim.sub;
set role anon;
select count(*) as anon_sees_private_project_expect_0 from projects;
select count(*) as anon_sees_private_screens_expect_0 from screens;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== TEST 7: publishing the share makes it anon-readable (no RLS recursion) ==='
update shares set is_public = true where id = '55555555-5555-5555-5555-555555555555';
reset request.jwt.claim.sub;
set role anon;
select count(*) as anon_sees_public_project_expect_1 from projects;
select count(*) as anon_sees_public_screens_expect_1 from screens;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== TEST 8: auth_events is service-role write-only ==='
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into auth_events (user_id, event_type)
  values ('11111111-1111-1111-1111-111111111111', 'PASSWORD_LOGIN');
\echo '   ^ expect: ERROR — a client must never be able to forge an auth event'
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== TEST 9: a user reads only their OWN auth events ==='
insert into auth_events (user_id, event_type) values
  ('11111111-1111-1111-1111-111111111111', 'PASSWORD_LOGIN'),
  ('22222222-2222-2222-2222-222222222222', 'GOOGLE_SIGN_IN');
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as owner_sees_own_events_expect_1 from auth_events;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== TEST 10: webhook_events is fully locked to service-role ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as authed_sees_webhook_events_expect_0 from webhook_events;
insert into webhook_events (event_id) values ('evt_forged');
\echo '   ^ expect: ERROR'
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== TEST 11: webhook_events UNIQUE enforces idempotency ==='
insert into webhook_events (provider, event_id, event_type) values ('paddle', 'evt_123', 'subscription.updated');
insert into webhook_events (provider, event_id, event_type) values ('paddle', 'evt_123', 'subscription.updated');
\echo '   ^ expect: ERROR duplicate key — this is what makes a Paddle replay a no-op'

\echo ''
\echo '=== TEST 12: notify_security_emails column exists and defaults to true ==='
select notify_security_emails as should_be_true from users where email = 'owner@example.com';

\echo ''
\echo '=== TEST 13: every public table has RLS enabled ==='
select relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;
\echo '   ^ expect: 0 rows'

-- ===========================================================================
-- Project authorization — WRITES, not just reads.
--
-- Phase 5.B lists "project authorization" and "RLS-sensitive operations".
-- TESTS 4 and 5 above cover reads; these cover the writes, which are what
-- actually destroy someone's work if the policies are wrong. A read leak is
-- serious; a write leak is unrecoverable.
-- ===========================================================================

\echo ''
\echo '=== TEST 14: a non-owner cannot UPDATE another user project or screens ==='
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update projects set name = 'stolen';
\echo '   ^ expect: UPDATE 0'
update screens set code = '<script>owned</script>';
\echo '   ^ expect: UPDATE 0'
reset role; reset request.jwt.claim.sub;
select count(*) as projects_renamed_expect_0 from projects where name = 'stolen';
select count(*) as screens_defaced_expect_0 from screens where code like '%owned%';

\echo ''
\echo '=== TEST 15: a non-owner cannot DELETE another user project or screens ==='
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
delete from screens;
\echo '   ^ expect: DELETE 0'
delete from projects;
\echo '   ^ expect: DELETE 0'
reset role; reset request.jwt.claim.sub;
select count(*) as projects_survived_expect_1 from projects;
select count(*) as screens_survived_expect_1 from screens;

\echo ''
\echo '=== TEST 16: a user cannot INSERT a project owned by someone else ==='
-- Otherwise an attacker could plant content into a victim's dashboard.
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into projects (user_id, name)
  values ('11111111-1111-1111-1111-111111111111', 'planted');
\echo '   ^ expect: ERROR — with check (user_id = auth.uid())'
reset role; reset request.jwt.claim.sub;
select count(*) as planted_expect_0 from projects where name = 'planted';

\echo ''
\echo '=== TEST 17: an ANON caller can write nothing to projects or screens ==='
-- The anon key ships in the browser bundle, so this is the exposure that
-- matters most.
set role anon;
insert into projects (user_id, name)
  values ('11111111-1111-1111-1111-111111111111', 'anon-planted');
\echo '   ^ expect: ERROR'
update projects set name = 'anon-renamed';
\echo '   ^ expect: UPDATE 0'
delete from projects;
\echo '   ^ expect: DELETE 0'
reset role;
select count(*) as anon_damage_expect_0 from projects
  where name in ('anon-planted', 'anon-renamed');

\echo ''
\echo '=== TEST 18: the owner CAN still do all of it (the policies are not just "deny") ==='
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update projects set name = 'renamed by owner' where user_id = '11111111-1111-1111-1111-111111111111';
\echo '   ^ expect: UPDATE 1'
insert into projects (user_id, name)
  values ('11111111-1111-1111-1111-111111111111', 'second project');
\echo '   ^ expect: INSERT 0 1'
delete from projects where name = 'second project';
\echo '   ^ expect: DELETE 1'
reset role; reset request.jwt.claim.sub;
