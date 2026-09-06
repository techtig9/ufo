-- ---------------------------------------------------------------------------
-- Migration 014 — hardening pass driven by the Supabase database linter.
--
-- Run against the live project after migrations 007–013 were applied, the
-- security advisor returned three classes of finding on the public schema.
-- This migration closes the two that are real and records why the third is
-- left alone.
--
-- 1. function_search_path_mutable on workspace_role_rank()
--    It is the only helper added in Phase 4 without an explicit search_path.
--    In practice it is only ever reached from has_workspace_role(), which is
--    SECURITY DEFINER with `set search_path = public`, and a nested call
--    inherits that setting — so this is defence in depth rather than a live
--    hole. Pinned anyway: the next caller may not be inside a definer.
--
-- 2. anon/authenticated_security_definer_function_executable
--    PostgreSQL grants EXECUTE on new functions to PUBLIC, so every helper
--    added in Phases 2 and 4 became callable over PostgREST as
--    /rest/v1/rpc/<name>. For the four functions below that is wrong:
--
--      reserve_credits / refund_credits  state-mutating, and refund_credits
--                                        grants credits — a signed-in user
--                                        calling it directly could top up
--                                        their own balance for free. Both are
--                                        only ever called by the server with
--                                        the service-role key
--                                        (lib/credits-server.ts).
--      project_storage_used              takes an arbitrary owner id and
--                                        bypasses RLS, so it leaks another
--                                        tenant's storage total. Server-only
--                                        (app/api/projects/[id]/assets).
--      current_workspace_role            has no caller at all in SQL or in the
--                                        application; has_workspace_role reads
--                                        workspace_members directly. Kept for
--                                        future policies, closed to the API.
--      share_project                     reached only from inside
--                                        can_moderate_comment(), which is
--                                        SECURITY DEFINER, so the nested call
--                                        does not need an invoker grant.
--
--    share_view_stats() authorises itself internally (can_access_project) and
--    is called from a route with the *user's* session, so authenticated keeps
--    it; anon can never be a collaborator, so anon loses it.
--
-- 3. The remaining flagged functions — can_access_project, has_workspace_role,
--    project_workspace, is_project_publicly_shared, share_is_anon_readable,
--    can_moderate_comment — appear inside RLS policy expressions. Policy
--    expressions are evaluated as the *invoking* role, so revoking EXECUTE
--    would turn a correct "no rows" into "permission denied for function" on
--    the public share path. They stay granted deliberately. Each is a
--    read-only boolean scoped to the caller's own identity: calling one over
--    RPC tells you only whether you yourself may see a row you already have
--    the id for, which is what the policy would tell you regardless.
-- ---------------------------------------------------------------------------

-- 1. Pin the one mutable search_path. -----------------------------------------
create or replace function public.workspace_role_rank(p_role text)
returns int
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_role
    when 'owner' then 4
    when 'admin' then 3
    when 'editor' then 2
    when 'viewer' then 1
    else 0
  end;
$$;

-- 2. Close the four server-only helpers to the API. ---------------------------
-- Revoking from PUBLIC is what actually removes the default grant; the two
-- explicit revokes cover the case where a previous migration (or the dashboard)
-- granted a role directly. service_role is granted back by name so the intent
-- survives a future `grant execute ... to public` from any tooling.
revoke execute on function public.reserve_credits(uuid, integer, text, text) from public, anon, authenticated;
grant  execute on function public.reserve_credits(uuid, integer, text, text) to service_role;

revoke execute on function public.refund_credits(uuid, integer, text, text, text) from public, anon, authenticated;
grant  execute on function public.refund_credits(uuid, integer, text, text, text) to service_role;

revoke execute on function public.project_storage_used(uuid) from public, anon, authenticated;
grant  execute on function public.project_storage_used(uuid) to service_role;

revoke execute on function public.current_workspace_role(uuid) from public, anon, authenticated;
grant  execute on function public.current_workspace_role(uuid) to service_role;

revoke execute on function public.share_project(uuid) from public, anon, authenticated;
grant  execute on function public.share_project(uuid) to service_role;

-- share_view_stats stays callable by a signed-in collaborator (the publishing
-- panel calls it with the user's session); it authorises itself internally.
revoke execute on function public.share_view_stats(uuid, integer) from public, anon;
grant  execute on function public.share_view_stats(uuid, integer) to authenticated, service_role;
