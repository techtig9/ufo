-- ---------------------------------------------------------------------------
-- Migration 016 — in-app feedback.
--
-- One table. Feedback is write-mostly: users submit, operators read in the
-- admin console, and nobody edits or deletes through the API — so the policies
-- are deliberately narrower than the usual owner-CRUD shape.
--
-- Idempotent and additive: no existing table is altered.
-- ---------------------------------------------------------------------------

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  -- 'general' from the widget, 'first_success' from the post-first-generation
  -- prompt. Kept as a constrained text rather than an enum so adding a source
  -- later is a one-line check change, not a type migration.
  source text not null default 'general' check (source in ('general', 'first_success')),
  -- 1-5, or null: the widget accepts a comment with no rating, because forcing
  -- a score on someone who wants to report a bug loses the bug.
  rating int check (rating is null or rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 4000),
  -- Where they were when they submitted. A path, never a full URL: a query
  -- string can carry a share token or an email address.
  path text check (path is null or char_length(path) <= 255),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on feedback (created_at desc);
create index if not exists feedback_user_idx on feedback (user_id);

alter table feedback enable row level security;

-- Insert only, and only as yourself. There is no select policy at all, which
-- is the point: feedback often names other people or quotes private work, so
-- no client key can read the table back. The admin console reads it with the
-- service role.
drop policy if exists "users submit their own feedback" on feedback;
create policy "users submit their own feedback"
  on feedback for insert
  with check (user_id = (select auth.uid()));

-- Belt and braces alongside the absent select policy: PostgREST checks column
-- privileges before RLS, so revoking here means a misconfigured policy added
-- later still cannot leak the table.
revoke select, update, delete on public.feedback from anon, authenticated;
grant insert (user_id, source, rating, message, path) on public.feedback to authenticated;
