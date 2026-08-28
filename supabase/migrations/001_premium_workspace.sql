-- UFO Premium Workspace upgrade
-- Run this migration AFTER the existing schema.sql.

alter table comments
  add column if not exists resolved boolean not null default false;

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

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "users read own notifications" on notifications;
create policy "users read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on notifications;
create policy "users update own notifications"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional helper for server-side service-role notification creation.
-- The service-role key bypasses RLS; never expose it to the browser.
