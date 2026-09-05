-- ===========================================================================
-- Phase 4 — comment mentions, assignment, and the collaboration half of the
-- activity feed.
--
-- The comment system this builds on was designed for ANONYMOUS stakeholder
-- feedback on a public share link: `author_name` is free text and there is no
-- author id. That stays true — it is the point of a share link — so everything
-- added here is optional and additive:
--
--   * `author_id`   set only when a signed-in user comments, so their comments
--                   are attributable while a guest's remain a name;
--   * `assigned_to` who owns acting on the comment;
--   * `comment_mentions` who was @-mentioned, as rows rather than parsed out of
--                   the body on every read.
--
-- Mentions and assignment are deliberately restricted to workspace members: a
-- prototype's anonymous visitors cannot see the member list, so they cannot
-- mention or assign anyone, and the policies below enforce that rather than
-- relying on the UI to hide the control.
--
-- Re-runnable: every statement is guarded.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Columns.
-- ---------------------------------------------------------------------------
alter table comments add column if not exists author_id uuid references users(id) on delete set null;
alter table comments add column if not exists assigned_to uuid references users(id) on delete set null;
alter table comments add column if not exists assigned_by uuid references users(id) on delete set null;
alter table comments add column if not exists assigned_at timestamptz;

create index if not exists comments_assigned_to_idx on comments (assigned_to) where assigned_to is not null;
create index if not exists comments_author_id_idx on comments (author_id) where author_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Mentions.
--
-- A row per (comment, mentioned user). The unique constraint makes a repeated
-- "@alice @alice" in one body a single mention rather than two notifications.
-- ---------------------------------------------------------------------------
create table if not exists comment_mentions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references comments(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists comment_mentions_user_idx on comment_mentions (user_id, created_at desc);

alter table comment_mentions enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Helpers.
--
-- SECURITY DEFINER for the same reason as migration 010's helpers: a policy on
-- `comments` that reads `shares`/`projects`/`workspace_members` directly would
-- be re-entered through those tables' own policies. Encapsulating the lookup
-- breaks the cycle, and `stable` lets the planner cache it per statement.
-- ---------------------------------------------------------------------------

/** The project a share belongs to. */
create or replace function public.share_project(p_share uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select project_id from shares where id = p_share;
$$;

/**
 * True when the current user may act on a comment: they own the underlying
 * project, or they hold at least `p_minimum` in the project's workspace.
 *
 * This is the single definition of "can moderate this comment", used by the
 * policies below so the rule cannot drift between them.
 */
create or replace function public.can_moderate_comment(p_share uuid, p_minimum text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from shares sh
      join projects p on p.id = sh.project_id
     where sh.id = p_share
       and (
         p.user_id = auth.uid()
         or (p.workspace_id is not null and has_workspace_role(p.workspace_id, p_minimum))
       )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Policies.
--
-- The existing "owners manage/delete comments on their shares" policies from
-- migration 005 are left in place: PostgreSQL ORs permissive policies, so these
-- widen access to workspace collaborators without weakening anything. A project
-- with no workspace behaves exactly as before.
-- ---------------------------------------------------------------------------

drop policy if exists "workspace members moderate comments" on comments;
create policy "workspace members moderate comments"
  on comments for update
  -- Viewer is deliberate: resolving a comment and picking it up are review
  -- actions, not edits to the design. Deleting still requires editor.
  using (can_moderate_comment(share_id, 'viewer'))
  with check (can_moderate_comment(share_id, 'viewer'));

drop policy if exists "workspace editors delete comments" on comments;
create policy "workspace editors delete comments"
  on comments for delete
  using (can_moderate_comment(share_id, 'editor'));

-- Mentions are readable by anyone who can already read the comment they hang
-- off — including the anonymous visitor reading a public share, so a thread
-- renders consistently for everyone who can see it.
drop policy if exists "mentions readable with their comment" on comment_mentions;
create policy "mentions readable with their comment"
  on comment_mentions for select
  using (
    exists (select 1 from comments c where c.id = comment_mentions.comment_id)
  );

-- No INSERT/UPDATE/DELETE policy at all: mentions are written service-role-side
-- only, after the app has verified that each mentioned user is genuinely a
-- member of the project's workspace. A client that could insert its own rows
-- could mention — and so email — any user id it could guess.

-- ---------------------------------------------------------------------------
-- 5. Notification preference.
--
-- Reuses the pattern from migration 007 (`notify_security_emails`): on by
-- default, because a mention the recipient never hears about is not a mention.
-- ---------------------------------------------------------------------------
alter table users add column if not exists notify_collaboration_emails boolean not null default true;

-- ---------------------------------------------------------------------------
-- 6. Column-level UPDATE grants on comments.
--
-- RLS is row-level, not column-level. The policy above says a workspace viewer
-- may update a comment row — meaning that, without this, a viewer could PATCH
-- `body` straight through PostgREST and rewrite anyone's feedback, including an
-- anonymous stakeholder's. The API route only ever sets `resolved` and the
-- assignment columns, but the API is not the boundary: the anon/authenticated
-- keys ship in the browser, so PostgREST is reachable directly.
--
-- A comment is immutable once posted. Only its review state may change, so the
-- grant is narrowed to exactly those columns. This also closes the same gap for
-- the pre-existing owner policy from migration 005, under which a project owner
-- could silently edit a guest's words.
-- ---------------------------------------------------------------------------
revoke update on public.comments from authenticated;
revoke update on public.comments from anon;
grant update (resolved, assigned_to, assigned_by, assigned_at)
  on public.comments to authenticated;
