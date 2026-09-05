-- ============================================================================
-- Phase 4 — workspaces, roles, invites, and real share permissions
-- Run after 001-009. Additive: personal projects keep working untouched.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Workspaces.
--
-- A workspace is optional. `projects.workspace_id` is nullable and existing
-- rows stay NULL, so every project created before this migration remains a
-- personal project owned by its user and nothing about its access changes.
-- ---------------------------------------------------------------------------
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  owner_id uuid references users(id) on delete cascade not null,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on workspaces (owner_id);


-- ---------------------------------------------------------------------------
-- 2. Membership and roles.
--
-- owner  — full control, including deleting the workspace and billing
-- admin  — manage members and every project
-- editor — create and edit projects, but not manage people
-- viewer — read only
--
-- The role order is encoded in workspace_role_rank() below so policies can ask
-- "at least editor" instead of enumerating roles at every call site.
-- ---------------------------------------------------------------------------
create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members (user_id);
create index if not exists workspace_members_workspace_idx on workspace_members (workspace_id);


-- ---------------------------------------------------------------------------
-- 3. Invites.
--
-- The token is stored HASHED. An invite token is a bearer credential — anyone
-- holding it can join the workspace — so a database leak must not hand out
-- working invitations, exactly as with a password.
-- ---------------------------------------------------------------------------
create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  token_hash text not null unique,
  invited_by uuid references users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists workspace_invites_workspace_idx on workspace_invites (workspace_id);
create index if not exists workspace_invites_email_idx on workspace_invites (lower(email));

-- One live invite per email per workspace; re-inviting replaces rather than
-- accumulating. Partial, so accepted invites stay as history.
create unique index if not exists workspace_invites_pending_key
  on workspace_invites (workspace_id, lower(email))
  where accepted_at is null;


-- ---------------------------------------------------------------------------
-- 4. Projects gain an optional workspace.
-- ---------------------------------------------------------------------------
alter table projects add column if not exists workspace_id uuid references workspaces(id) on delete set null;
create index if not exists projects_workspace_idx on projects (workspace_id);


-- ---------------------------------------------------------------------------
-- 5. SECURITY DEFINER helpers.
--
-- These exist for the same reason migration 006's is_project_publicly_shared()
-- does. If a policy on `projects` queried `workspace_members`, and a policy on
-- `workspace_members` queried `projects` (or anything that leads back),
-- Postgres detects infinite recursion and REFUSES the query outright — which
-- is precisely the bug 006 had to fix for published prototypes.
--
-- A SECURITY DEFINER function bypasses RLS for its own internal query, so the
-- cycle is broken at the source rather than by carefully avoiding it in every
-- future policy.
-- ---------------------------------------------------------------------------
create or replace function public.workspace_role_rank(p_role text)
returns int
language sql
immutable
as $$
  select case p_role
    when 'owner' then 4
    when 'admin' then 3
    when 'editor' then 2
    when 'viewer' then 1
    else 0
  end;
$$;

create or replace function public.current_workspace_role(p_workspace uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from workspace_members
   where workspace_id = p_workspace and user_id = auth.uid()
   limit 1;
$$;

/** True when the current user holds at least `p_minimum` in the workspace. */
create or replace function public.has_workspace_role(p_workspace uuid, p_minimum text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    workspace_role_rank(
      (select role from workspace_members
        where workspace_id = p_workspace and user_id = auth.uid() limit 1)
    ) >= workspace_role_rank(p_minimum),
    false
  );
$$;

/** The workspace a project belongs to, if any. Used by the project policies. */
create or replace function public.project_workspace(p_project uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from projects where id = p_project;
$$;


-- ---------------------------------------------------------------------------
-- 6. RLS.
-- ---------------------------------------------------------------------------
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;

drop policy if exists "members read their workspaces" on workspaces;
create policy "members read their workspaces"
  on workspaces for select
  using (owner_id = auth.uid() or has_workspace_role(id, 'viewer'));

drop policy if exists "users create workspaces they own" on workspaces;
create policy "users create workspaces they own"
  on workspaces for insert
  with check (owner_id = auth.uid());

drop policy if exists "admins update their workspace" on workspaces;
create policy "admins update their workspace"
  on workspaces for update
  using (owner_id = auth.uid() or has_workspace_role(id, 'admin'));

drop policy if exists "owners delete their workspace" on workspaces;
create policy "owners delete their workspace"
  on workspaces for delete
  using (owner_id = auth.uid());

-- Members: readable by anyone in the workspace, writable only by admins+.
-- Note this policy queries workspace_members from a policy ON
-- workspace_members — safe only because has_workspace_role() is
-- SECURITY DEFINER and therefore does not re-trigger RLS.
drop policy if exists "members read the roster" on workspace_members;
create policy "members read the roster"
  on workspace_members for select
  using (user_id = auth.uid() or has_workspace_role(workspace_id, 'viewer'));

drop policy if exists "admins manage the roster" on workspace_members;
create policy "admins manage the roster"
  on workspace_members for all
  using (has_workspace_role(workspace_id, 'admin'))
  with check (has_workspace_role(workspace_id, 'admin'));

-- Invites are readable by workspace admins only. Acceptance happens
-- server-side with the service role, because the accepting user is by
-- definition not yet a member and so cannot satisfy any policy here.
drop policy if exists "admins read invites" on workspace_invites;
create policy "admins read invites"
  on workspace_invites for select
  using (has_workspace_role(workspace_id, 'admin'));

drop policy if exists "admins manage invites" on workspace_invites;
create policy "admins manage invites"
  on workspace_invites for all
  using (has_workspace_role(workspace_id, 'admin'))
  with check (has_workspace_role(workspace_id, 'admin'));


-- ---------------------------------------------------------------------------
-- 7. Extend project access to workspace members.
--
-- ADDITIVE. The existing "read own projects" / "write own projects" policies
-- are left in place, so a personal project (workspace_id IS NULL) behaves
-- exactly as before. These add a second, independent route to the same rows
-- for workspace members — Postgres ORs permissive policies together.
-- ---------------------------------------------------------------------------
drop policy if exists "workspace members read workspace projects" on projects;
create policy "workspace members read workspace projects"
  on projects for select
  using (workspace_id is not null and has_workspace_role(workspace_id, 'viewer'));

drop policy if exists "workspace editors update workspace projects" on projects;
create policy "workspace editors update workspace projects"
  on projects for update
  using (workspace_id is not null and has_workspace_role(workspace_id, 'editor'));

drop policy if exists "workspace editors create workspace projects" on projects;
create policy "workspace editors create workspace projects"
  on projects for insert
  with check (
    workspace_id is not null
    and has_workspace_role(workspace_id, 'editor')
    and user_id = auth.uid()
  );

-- Deleting a shared project is an admin action: an editor can change a
-- project, but removing the team's work is a different level of authority.
drop policy if exists "workspace admins delete workspace projects" on projects;
create policy "workspace admins delete workspace projects"
  on projects for delete
  using (workspace_id is not null and has_workspace_role(workspace_id, 'admin'));

-- Screens follow their project.
drop policy if exists "workspace members read workspace screens" on screens;
create policy "workspace members read workspace screens"
  on screens for select
  using (has_workspace_role(project_workspace(project_id), 'viewer'));

drop policy if exists "workspace editors write workspace screens" on screens;
create policy "workspace editors write workspace screens"
  on screens for all
  using (has_workspace_role(project_workspace(project_id), 'editor'))
  with check (has_workspace_role(project_workspace(project_id), 'editor'));


-- ---------------------------------------------------------------------------
-- 8. Share permissions: expiry and password protection.
--
-- Expiry is enforced in RLS, not just in the UI — an expired link must stop
-- working even for someone querying PostgREST directly with the public key.
--
-- Password protection is deliberately NOT expressed as "anon may read if they
-- know the password", because RLS cannot verify a password the client has not
-- proven. Instead a password-protected share is removed from anon reach
-- entirely; the server verifies the password and then serves the content with
-- the service role. Anything less would make the password decorative.
-- ---------------------------------------------------------------------------
alter table shares add column if not exists expires_at timestamptz;
alter table shares add column if not exists password_hash text;
alter table shares add column if not exists allow_comments boolean not null default true;

/** A share the public key may read: public, unexpired, and not password-gated. */
create or replace function public.share_is_anon_readable(p_share uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from shares
     where id = p_share
       and is_public = true
       and password_hash is null
       and (expires_at is null or expires_at > now())
  );
$$;

/** Same test, by project — used by the projects/screens anon policies. */
create or replace function public.is_project_publicly_shared(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from shares
     where project_id = pid
       and is_public = true
       and password_hash is null
       and (expires_at is null or expires_at > now())
  );
$$;

-- The anon screen policy predates these columns and still tests is_public
-- alone, so an expired or password-gated share would keep leaking screens.
-- Route it through the same helper as projects.
drop policy if exists "public screens via public share" on screens;
create policy "public screens via public share"
  on screens for select
  using (is_project_publicly_shared(screens.project_id));

-- Same for the shares row itself.
drop policy if exists "public shares are readable" on shares;
create policy "public shares are readable"
  on shares for select
  using (
    is_public = true
    and password_hash is null
    and (expires_at is null or expires_at > now())
  );

-- And for comments on a share.
drop policy if exists "anyone can read comments on a public share" on comments;
create policy "anyone can read comments on a public share"
  on comments for select
  using (share_is_anon_readable(comments.share_id));

drop policy if exists "anyone can add a comment on a public share" on comments;
create policy "anyone can add a comment on a public share"
  on comments for insert
  with check (
    share_is_anon_readable(comments.share_id)
    and exists (select 1 from shares where id = comments.share_id and allow_comments = true)
  );


-- ---------------------------------------------------------------------------
-- 9. Activity feed.
-- ---------------------------------------------------------------------------
create table if not exists workspace_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  actor_id uuid references users(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists workspace_activity_workspace_created_idx
  on workspace_activity (workspace_id, created_at desc);

alter table workspace_activity enable row level security;

drop policy if exists "members read workspace activity" on workspace_activity;
create policy "members read workspace activity"
  on workspace_activity for select
  using (has_workspace_role(workspace_id, 'viewer'));
-- Writes are service-role only: an activity record a client can forge is not
-- an audit trail.
