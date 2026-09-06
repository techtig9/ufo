-- ---------------------------------------------------------------------------
-- Migration 015 — make RLS evaluate auth.uid() once per statement.
--
-- The Supabase performance advisor flags 32 policies with auth_rls_initplan:
-- `auth.uid()` written bare in a policy is re-evaluated for every candidate
-- row, because the planner cannot prove it is constant within the statement.
-- Wrapping it as `(select auth.uid())` turns it into an InitPlan: evaluated
-- once, then compared against each row. On a table with 50k rows that is the
-- difference between 50k function calls and one.
--
-- This is a pure performance change. `(select auth.uid())` returns exactly what
-- `auth.uid()` returns — the transformation cannot widen or narrow a policy,
-- and each policy below is otherwise recreated verbatim: same command, same
-- PERMISSIVE/role targeting (all of these apply to PUBLIC, deliberately, so the
-- anonymous share-viewing paths keep working), same USING and WITH CHECK shape.
--
-- Policies are dropped and recreated rather than altered because PostgreSQL has
-- no ALTER POLICY ... USING that can be made idempotent; `drop policy if
-- exists` + `create policy` is re-runnable.
--
-- Not addressed here, deliberately:
--   * multiple_permissive_policies (70 warnings) — owner access and workspace
--     access are separate permissive policies that OR together. Merging them
--     into one expression would save a policy evaluation and cost the property
--     that a project with no workspace behaves exactly as it did before Phase 4.
--     Not worth the risk to a security boundary for a planner nicety.
--   * unused_index (43) — the database has no traffic yet, so every index is
--     unused by definition. Re-check once there is production load.
-- ---------------------------------------------------------------------------

-- users -----------------------------------------------------------------------
drop policy if exists "users read own row" on users;
create policy "users read own row" on users for select
  using ((select auth.uid()) = id);

drop policy if exists "users update own row" on users;
create policy "users update own row" on users for update
  using ((select auth.uid()) = id);

-- projects --------------------------------------------------------------------
drop policy if exists "read own projects" on projects;
create policy "read own projects" on projects for select
  using ((select auth.uid()) = user_id);

drop policy if exists "write own projects" on projects;
create policy "write own projects" on projects for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "update own projects" on projects;
create policy "update own projects" on projects for update
  using ((select auth.uid()) = user_id);

drop policy if exists "delete own projects" on projects;
create policy "delete own projects" on projects for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "workspace editors create workspace projects" on projects;
create policy "workspace editors create workspace projects" on projects for insert
  with check (
    workspace_id is not null
    and has_workspace_role(workspace_id, 'editor')
    and user_id = (select auth.uid())
  );

-- screens ---------------------------------------------------------------------
drop policy if exists "read own screens" on screens;
create policy "read own screens" on screens for select
  using (
    exists (
      select 1 from projects p
       where p.id = screens.project_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "write own screens" on screens;
create policy "write own screens" on screens for all
  using (
    exists (
      select 1 from projects p
       where p.id = screens.project_id and p.user_id = (select auth.uid())
    )
  );

-- screen_versions -------------------------------------------------------------
drop policy if exists "read own screen versions" on screen_versions;
create policy "read own screen versions" on screen_versions for select
  using (
    exists (
      select 1 from screens s join projects p on p.id = s.project_id
       where s.id = screen_versions.screen_id and p.user_id = (select auth.uid())
    )
  );

-- shares ----------------------------------------------------------------------
drop policy if exists "owners manage their shares" on shares;
create policy "owners manage their shares" on shares for all
  using (
    exists (
      select 1 from projects p
       where p.id = shares.project_id and p.user_id = (select auth.uid())
    )
  );

-- comments --------------------------------------------------------------------
drop policy if exists "owners manage comments on their shares" on comments;
create policy "owners manage comments on their shares" on comments for update
  using (
    exists (
      select 1 from shares sh join projects p on p.id = sh.project_id
       where sh.id = comments.share_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "owners delete comments on their shares" on comments;
create policy "owners delete comments on their shares" on comments for delete
  using (
    exists (
      select 1 from shares sh join projects p on p.id = sh.project_id
       where sh.id = comments.share_id and p.user_id = (select auth.uid())
    )
  );

-- folders ---------------------------------------------------------------------
drop policy if exists "read own folders" on folders;
create policy "read own folders" on folders for select
  using ((select auth.uid()) = user_id);

drop policy if exists "manage own folders" on folders;
create policy "manage own folders" on folders for all
  using ((select auth.uid()) = user_id);

-- notifications ---------------------------------------------------------------
drop policy if exists "users read own notifications" on notifications;
create policy "users read own notifications" on notifications for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users update own notifications" on notifications;
create policy "users update own notifications" on notifications for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- billing ---------------------------------------------------------------------
drop policy if exists "read own subscription" on subscriptions;
create policy "read own subscription" on subscriptions for select
  using ((select auth.uid()) = user_id);

drop policy if exists "read own payments" on payments;
create policy "read own payments" on payments for select
  using ((select auth.uid()) = user_id);

drop policy if exists "read own referrals" on referrals;
create policy "read own referrals" on referrals for select
  using ((select auth.uid()) = referrer_id);

-- phase 1/2 tables ------------------------------------------------------------
drop policy if exists "users read own auth events" on auth_events;
create policy "users read own auth events" on auth_events for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users read own credit ledger" on credit_ledger;
create policy "users read own credit ledger" on credit_ledger for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users read own saved prompts" on saved_prompts;
create policy "users read own saved prompts" on saved_prompts for select
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own saved prompts" on saved_prompts;
create policy "users insert own saved prompts" on saved_prompts for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own saved prompts" on saved_prompts;
create policy "users update own saved prompts" on saved_prompts for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users delete own saved prompts" on saved_prompts;
create policy "users delete own saved prompts" on saved_prompts for delete
  using ((select auth.uid()) = user_id);

-- workspaces ------------------------------------------------------------------
drop policy if exists "members read their workspaces" on workspaces;
create policy "members read their workspaces" on workspaces for select
  using (owner_id = (select auth.uid()) or has_workspace_role(id, 'viewer'));

drop policy if exists "users create workspaces they own" on workspaces;
create policy "users create workspaces they own" on workspaces for insert
  with check (owner_id = (select auth.uid()));

drop policy if exists "admins update their workspace" on workspaces;
create policy "admins update their workspace" on workspaces for update
  using (owner_id = (select auth.uid()) or has_workspace_role(id, 'admin'));

drop policy if exists "owners delete their workspace" on workspaces;
create policy "owners delete their workspace" on workspaces for delete
  using (owner_id = (select auth.uid()));

drop policy if exists "members read the roster" on workspace_members;
create policy "members read the roster" on workspace_members for select
  using (user_id = (select auth.uid()) or has_workspace_role(workspace_id, 'viewer'));

-- project_assets --------------------------------------------------------------
drop policy if exists "editors add project assets" on project_assets;
create policy "editors add project assets" on project_assets for insert
  with check (can_access_project(project_id, 'editor') and uploaded_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Covering indexes for the foreign keys the advisor flags as unindexed. Each
-- one backs both a join the application makes and the parent-side cascade
-- delete (removing a workspace walks workspace_activity; removing a user walks
-- email_events).
-- ---------------------------------------------------------------------------
create index if not exists comments_assigned_by_idx on comments (assigned_by);
create index if not exists email_events_user_idx on email_events (user_id);
create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);
create index if not exists project_assets_uploaded_by_idx on project_assets (uploaded_by);
create index if not exists referrals_referrer_idx on referrals (referrer_id);
create index if not exists share_publish_events_actor_idx on share_publish_events (actor_id);
create index if not exists share_publish_events_share_idx on share_publish_events (share_id);
create index if not exists share_views_share_idx on share_views (share_id);
create index if not exists workspace_activity_actor_idx on workspace_activity (actor_id);
create index if not exists workspace_activity_project_idx on workspace_activity (project_id);
create index if not exists workspace_invites_accepted_by_idx on workspace_invites (accepted_by);
create index if not exists workspace_invites_invited_by_idx on workspace_invites (invited_by);
