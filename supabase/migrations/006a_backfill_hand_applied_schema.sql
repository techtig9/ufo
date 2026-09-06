-- ---------------------------------------------------------------------------
-- Backfill of migrations 001-005, for a database whose schema was applied by
-- hand rather than through these files.
--
-- WHY THIS EXISTS
-- ---------------
-- UFO's live Supabase project was set up from the dashboard, and several
-- pieces of 001-005 were missed: comments.resolved and comments.parent_id,
-- shares.published_at, the notifications table, and the screen_versions /
-- templates columns. The application reads all of them — /api/shares/publish
-- selects published_at, /api/notifications reads notifications — so each
-- absence is a 500 waiting to happen rather than a missing feature. Migration
-- 011 also failed outright on it ("column resolved of relation comments does
-- not exist").
--
-- On a database that really did run 001-005 this file is a no-op: every
-- statement is guarded with IF NOT EXISTS or a catalogue check. It is numbered
-- 006a so it lands after the RLS-recursion fix and before 011, which depends
-- on comments.resolved.
-- ---------------------------------------------------------------------------

-- 001 ------------------------------------------------------------------------
alter table comments add column if not exists resolved boolean not null default false;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  type text not null default 'info',
  title text not null,
  message text not null,
  read boolean not null default false,
  metadata jsonb,
  created_at timestamptz default now()
);

-- The API lists a user's notifications newest-first, and this index also
-- covers the notifications_user_id foreign key.
create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "users read own notifications" on notifications;
create policy "users read own notifications"
  on notifications for select using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on notifications;
create policy "users update own notifications"
  on notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 003 ------------------------------------------------------------------------
alter table projects add column if not exists archived_at timestamptz;
create index if not exists projects_user_archived_idx on projects (user_id, archived_at);

-- 004 ------------------------------------------------------------------------
alter table screen_versions add column if not exists instruction text;
alter table screen_versions add column if not exists source text not null default 'manual';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'screen_versions_source_check') then
    alter table screen_versions add constraint screen_versions_source_check
      check (source in ('manual', 'ai'));
  end if;
end $$;

alter table templates add column if not exists description text;
alter table templates add column if not exists screens jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'templates_name_key') then
    alter table templates add constraint templates_name_key unique (name);
  end if;
end $$;

-- 005 ------------------------------------------------------------------------
alter table shares add column if not exists published_at timestamptz;
alter table comments add column if not exists parent_id uuid references comments(id);
create index if not exists comments_parent_id_idx on comments (parent_id);

-- Owner moderation of comments on their own shares. Migration 011 widens this
-- to workspace collaborators; both are permissive and therefore OR together.
drop policy if exists "owners manage comments on their shares" on comments;
create policy "owners manage comments on their shares"
  on comments for update
  using (
    exists (
      select 1 from shares sh join projects p on p.id = sh.project_id
       where sh.id = comments.share_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "owners delete comments on their shares" on comments;
create policy "owners delete comments on their shares"
  on comments for delete
  using (
    exists (
      select 1 from shares sh join projects p on p.id = sh.project_id
       where sh.id = comments.share_id and p.user_id = auth.uid()
    )
  );
