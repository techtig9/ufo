-- ===========================================================================
-- Phase 4 — project asset management on Supabase Storage.
--
-- Two halves that must agree:
--
--   1. `project_assets`  — the metadata rows the app reads and lists, under
--                          normal RLS.
--   2. `storage.objects` — the bytes, under Supabase Storage's own RLS.
--
-- Both are secured, because either one alone is a hole: metadata rows without
-- object policies means anyone holding the anon key can download any file by
-- guessing a path, and object policies without metadata means nothing can be
-- listed, renamed or counted against a quota.
--
-- The storage half is guarded on the `storage` schema existing, so this file
-- applies unchanged against the plain-Postgres test harness (which has no
-- Storage) and against a real Supabase project.
--
-- Re-runnable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Asset metadata.
--
-- `storage_path` is the object key in the bucket and is assigned by the server,
-- never by the client — a client-chosen path is a directory-traversal and
-- overwrite primitive. `name` is the display name, which the user may rename
-- freely; renaming never moves the object, so a rename cannot fail halfway and
-- leave the row pointing at nothing.
-- ---------------------------------------------------------------------------
create table if not exists project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade not null,
  uploaded_by uuid references users(id) on delete set null,
  name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  width int,
  height int,
  -- Uploads are two-step (row first, then the bytes), so a row is only part of
  -- the library once the client confirms the upload landed. An unconfirmed row
  -- still counts against quota until it is cleaned up, so a failed upload
  -- cannot be used to bypass the limit by never confirming.
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now()
);

create index if not exists project_assets_project_idx on project_assets (project_id, created_at desc);
create index if not exists project_assets_pending_idx on project_assets (created_at) where status = 'pending';

alter table project_assets enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Who may see and change an asset.
--
-- SECURITY DEFINER, for the same reason as migrations 010 and 011: a policy on
-- project_assets that read `projects` directly would be re-entered through that
-- table's own policies.
-- ---------------------------------------------------------------------------

/** True when the current user holds at least `p_minimum` on the project. */
create or replace function public.can_access_project(p_project uuid, p_minimum text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from projects p
     where p.id = p_project
       and (
         p.user_id = auth.uid()
         or (p.workspace_id is not null and has_workspace_role(p.workspace_id, p_minimum))
       )
  );
$$;

drop policy if exists "collaborators read project assets" on project_assets;
create policy "collaborators read project assets"
  on project_assets for select
  using (can_access_project(project_id, 'viewer'));

drop policy if exists "editors add project assets" on project_assets;
create policy "editors add project assets"
  on project_assets for insert
  with check (can_access_project(project_id, 'editor') and uploaded_by = auth.uid());

drop policy if exists "editors update project assets" on project_assets;
create policy "editors update project assets"
  on project_assets for update
  using (can_access_project(project_id, 'editor'))
  with check (can_access_project(project_id, 'editor'));

drop policy if exists "editors delete project assets" on project_assets;
create policy "editors delete project assets"
  on project_assets for delete
  using (can_access_project(project_id, 'editor'));

-- A viewer may read the library but must not be able to rewrite the bookkeeping
-- the quota is computed from, nor point a row at a different object. Only the
-- display name is client-updatable; everything else is set server-side.
revoke update on public.project_assets from authenticated;
revoke update on public.project_assets from anon;
grant update (name) on public.project_assets to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Quota accounting.
--
-- Computed from the rows rather than kept in a counter column, so it cannot
-- drift out of step with reality. `pending` rows are included deliberately: an
-- upload in flight has to reserve its space or two concurrent uploads could
-- both pass a check that neither would pass afterwards.
-- ---------------------------------------------------------------------------
create or replace function public.project_storage_used(p_owner uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(a.size_bytes), 0)::bigint
    from project_assets a
    join projects p on p.id = a.project_id
   where p.user_id = p_owner;
$$;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket and object policies.
--
-- Skipped where there is no `storage` schema, so this migration also applies to
-- the plain-Postgres test harness.
--
-- The bucket is PRIVATE. Assets are served through signed URLs with a short
-- expiry rather than a public bucket, because a public bucket makes every file
-- readable by URL forever — including a client's unreleased designs.
--
-- `file_size_limit` and `allowed_mime_types` are set on the bucket itself.
-- That matters: the app validates too, but a signed upload URL is used directly
-- by the browser, so the bucket is the only thing standing between a modified
-- client and an arbitrary 500 MB file.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'no storage schema — skipping bucket setup (expected outside Supabase)';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'project-assets',
    'project-assets',
    false,
    26214400, -- 25 MB
    array['image/png','image/jpeg','image/gif','image/webp','image/svg+xml','application/pdf']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Object keys are `<project_id>/<asset_id>.<ext>`, so the first path segment
  -- names the project and can be authorised with the same helper the metadata
  -- policies use. The server is what assigns the key, so it always has this
  -- shape.
  execute $p$
    drop policy if exists "collaborators read project asset objects" on storage.objects;
    create policy "collaborators read project asset objects"
      on storage.objects for select
      using (
        bucket_id = 'project-assets'
        and public.can_access_project((storage.foldername(name))[1]::uuid, 'viewer')
      );

    drop policy if exists "editors write project asset objects" on storage.objects;
    create policy "editors write project asset objects"
      on storage.objects for insert
      with check (
        bucket_id = 'project-assets'
        and public.can_access_project((storage.foldername(name))[1]::uuid, 'editor')
      );

    drop policy if exists "editors delete project asset objects" on storage.objects;
    create policy "editors delete project asset objects"
      on storage.objects for delete
      using (
        bucket_id = 'project-assets'
        and public.can_access_project((storage.foldername(name))[1]::uuid, 'editor')
      );
  $p$;
end $$;
