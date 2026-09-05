-- Verifies a live UFO database has the Phase 1-3 fixes actually in effect.
-- Reports PASS/FAIL per check; the wrapper exits non-zero if anything fails.
\pset pager off
\pset tuples_only on
\pset format unaligned

with checks as (
  -- ---- Phase 1: the templates RLS hole ----------------------------------
  select 'templates has RLS enabled' as label,
         coalesce((select relrowsecurity from pg_class c
                   join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname='public' and c.relname='templates'), false) as ok,
         'CRITICAL: anon key holders can write templates' as consequence
  union all
  select 'templates is publicly readable',
         exists(select 1 from pg_policies
                where schemaname='public' and tablename='templates' and cmd='SELECT'),
         'the template gallery would be empty for users'
  union all
  select 'templates has NO write policy',
         not exists(select 1 from pg_policies
                    where schemaname='public' and tablename='templates'
                      and cmd in ('INSERT','UPDATE','DELETE','ALL')),
         'CRITICAL: templates would be client-writable'

  -- ---- every public table must have RLS ---------------------------------
  union all
  select 'every public table has RLS enabled',
         not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                    where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false),
         'CRITICAL: at least one table is client-writable'

  -- ---- Phase 1: auth events ---------------------------------------------
  union all
  select 'auth_events table exists',
         to_regclass('public.auth_events') is not null,
         'login security emails cannot be recorded or deduplicated'
  union all
  select 'auth_events dedup_key is UNIQUE',
         exists(select 1 from pg_indexes where schemaname='public'
                and tablename='auth_events' and indexdef ilike '%unique%dedup_key%'),
         'duplicate security emails on one sign-in'
  union all
  select 'users.notify_security_emails exists',
         exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='users'
                  and column_name='notify_security_emails'),
         'the security-email preference cannot be stored'

  -- ---- Phase 2: atomic credits ------------------------------------------
  union all
  select 'reserve_credits() exists',
         to_regprocedure('public.reserve_credits(uuid,int,text,text)') is not null,
         'CRITICAL: credit deduction stays non-atomic (double-spend)'
  union all
  select 'refund_credits() exists',
         to_regprocedure('public.refund_credits(uuid,int,text,text,text)') is not null,
         'failed generations would not be refunded'
  union all
  select 'credit_ledger table exists',
         to_regclass('public.credit_ledger') is not null,
         'credit movements are not auditable'

  -- ---- Phase 2: webhook idempotency -------------------------------------
  union all
  select 'webhook_events table exists',
         to_regclass('public.webhook_events') is not null,
         'CRITICAL: a Paddle retry refills credits for free'
  union all
  select 'webhook_events (provider,event_id) is UNIQUE',
         exists(select 1 from pg_constraint
                where conname='webhook_events_provider_event_id_key' and contype='u'),
         'CRITICAL: webhook replays are not deduplicated'

  -- ---- Phase 2: observability -------------------------------------------
  union all
  select 'ai_requests table exists',
         to_regclass('public.ai_requests') is not null,
         'no provider health, latency or fallback visibility'
  union all
  select 'email_events table exists',
         to_regclass('public.email_events') is not null,
         'email delivery cannot be diagnosed'

  -- ---- Phase 2: saved prompts -------------------------------------------
  union all
  select 'saved_prompts table exists',
         to_regclass('public.saved_prompts') is not null,
         'saved prompts will 500'
  union all
  select 'saved_prompts (user_id,title) is UNIQUE',
         exists(select 1 from pg_constraint
                where conname='saved_prompts_user_title_key' and contype='u'),
         'the save-prompt upsert fails at runtime'

  -- ---- Pre-existing fix that must still hold ----------------------------
  union all
  select 'is_project_publicly_shared() exists (RLS recursion fix)',
         to_regprocedure('public.is_project_publicly_shared(uuid)') is not null,
         'CRITICAL: published prototypes 500 with infinite policy recursion'

  -- ---- Phase 4: collaboration and share permissions ---------------------
  union all
  select 'workspaces table exists',
         to_regclass('public.workspaces') is not null,
         'CRITICAL: every workspace, member and invite endpoint 500s'
  union all
  select 'has_workspace_role() exists',
         to_regprocedure('public.has_workspace_role(uuid,text)') is not null,
         'CRITICAL: workspace RLS cannot evaluate roles, so collaborators see nothing'
  union all
  select 'shares.password_hash exists',
         exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='shares' and column_name='password_hash'),
         'CRITICAL: share passwords are accepted by the UI but never enforced'
  union all
  select 'shares.expires_at exists',
         exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='shares' and column_name='expires_at'),
         'CRITICAL: expiring links never actually expire'
  union all
  select 'workspace_invites has no client write policy',
         not exists(select 1 from pg_policies
                    where schemaname='public' and tablename='workspace_invites'
                      and cmd in ('INSERT','ALL') and 'anon' = any(roles)),
         'CRITICAL: anyone could mint themselves an invitation'
  union all
  select 'comment_mentions table exists',
         to_regclass('public.comment_mentions') is not null,
         'mentions are parsed but never recorded or notified'
  union all
  select 'comment_mentions has NO client write policy',
         not exists(select 1 from pg_policies
                    where schemaname='public' and tablename='comment_mentions'
                      and cmd in ('INSERT','UPDATE','DELETE','ALL')),
         'CRITICAL: a share visitor could make UFO email any user id it guesses'
  union all
  select 'comments.body is not client-updatable',
         not exists(
           select 1 from information_schema.column_privileges
            where table_schema='public' and table_name='comments'
              and column_name='body' and privilege_type='UPDATE'
              and grantee in ('authenticated','anon')),
         'CRITICAL: a workspace viewer could rewrite anyone''s feedback'
  union all
  select 'users.notify_collaboration_emails exists',
         exists(select 1 from information_schema.columns
                where table_schema='public' and table_name='users'
                  and column_name='notify_collaboration_emails'),
         'mention emails cannot be turned off, and the Settings toggle 500s'
)
select case when ok then 'PASS  ' else 'FAIL  ' end || label ||
       case when ok then '' else '  <-- ' || consequence end
from checks order by ok, label;

\echo ''
select 'RESULT: ' || count(*) filter (where not ok) || ' failed, '
       || count(*) filter (where ok) || ' passed'
from (
  select coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
                   where n.nspname='public' and c.relname='templates'), false) as ok
  union all select exists(select 1 from pg_policies where schemaname='public' and tablename='templates' and cmd='SELECT')
  union all select not exists(select 1 from pg_policies where schemaname='public' and tablename='templates' and cmd in ('INSERT','UPDATE','DELETE','ALL'))
  union all select not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false)
  union all select to_regclass('public.auth_events') is not null
  union all select exists(select 1 from pg_indexes where schemaname='public' and tablename='auth_events' and indexdef ilike '%unique%dedup_key%')
  union all select exists(select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='notify_security_emails')
  union all select to_regprocedure('public.reserve_credits(uuid,int,text,text)') is not null
  union all select to_regprocedure('public.refund_credits(uuid,int,text,text,text)') is not null
  union all select to_regclass('public.credit_ledger') is not null
  union all select to_regclass('public.webhook_events') is not null
  union all select exists(select 1 from pg_constraint where conname='webhook_events_provider_event_id_key' and contype='u')
  union all select to_regclass('public.ai_requests') is not null
  union all select to_regclass('public.email_events') is not null
  union all select to_regclass('public.saved_prompts') is not null
  union all select exists(select 1 from pg_constraint where conname='saved_prompts_user_title_key' and contype='u')
  union all select to_regprocedure('public.is_project_publicly_shared(uuid)') is not null
  union all select to_regclass('public.workspaces') is not null
  union all select to_regprocedure('public.has_workspace_role(uuid,text)') is not null
  union all select exists(select 1 from information_schema.columns where table_schema='public' and table_name='shares' and column_name='password_hash')
  union all select exists(select 1 from information_schema.columns where table_schema='public' and table_name='shares' and column_name='expires_at')
  union all select not exists(select 1 from pg_policies where schemaname='public' and tablename='workspace_invites' and cmd in ('INSERT','ALL') and 'anon' = any(roles))
  union all select to_regclass('public.comment_mentions') is not null
  union all select not exists(select 1 from pg_policies where schemaname='public' and tablename='comment_mentions' and cmd in ('INSERT','UPDATE','DELETE','ALL'))
  union all select not exists(select 1 from information_schema.column_privileges where table_schema='public' and table_name='comments' and column_name='body' and privilege_type='UPDATE' and grantee in ('authenticated','anon'))
  union all select exists(select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='notify_collaboration_emails')
) t;
