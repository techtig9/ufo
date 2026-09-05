-- ============================================================================
-- Phase 2 — saved prompts (Master Command 2.C)
-- Run after 001-008. Purely additive.
-- ============================================================================

-- "Prompt history" is already covered: screen_versions rows carry the AI
-- instruction that produced them (source='ai', migration 004), so the editor
-- can replay what was asked without a parallel chat log. What was missing is
-- the deliberate half — prompts a user wants to keep and reuse across projects.
create table if not exists saved_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  title text not null,
  body text not null,
  -- Which AI action this prompt was written for, so the editor can offer it in
  -- the right place. Null means "any".
  action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_prompts_user_created_idx
  on saved_prompts (user_id, created_at desc);

-- One title per user, so re-saving a prompt updates it instead of silently
-- accumulating duplicates every time someone clicks Save.
--
-- A plain UNIQUE constraint on the columns, deliberately NOT a functional index
-- on lower(title): PostgREST's upsert names conflict targets by column
-- (onConflict: 'user_id,title'), and Postgres cannot match that to an
-- expression index, so the route's upsert would fail at runtime.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saved_prompts_user_title_key') then
    alter table saved_prompts add constraint saved_prompts_user_title_key unique (user_id, title);
  end if;
end $$;

alter table saved_prompts enable row level security;

drop policy if exists "users read own saved prompts" on saved_prompts;
create policy "users read own saved prompts"
  on saved_prompts for select using (auth.uid() = user_id);

drop policy if exists "users insert own saved prompts" on saved_prompts;
create policy "users insert own saved prompts"
  on saved_prompts for insert with check (auth.uid() = user_id);

drop policy if exists "users update own saved prompts" on saved_prompts;
create policy "users update own saved prompts"
  on saved_prompts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete own saved prompts" on saved_prompts;
create policy "users delete own saved prompts"
  on saved_prompts for delete using (auth.uid() = user_id);
