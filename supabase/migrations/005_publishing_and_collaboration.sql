-- UFO Phase 4: publishing timestamp + real collaboration (replies, resolve, pins)
-- Run after 001/002/003/004. Purely additive.

alter table shares add column if not exists published_at timestamptz;

-- Threaded replies — one level (a reply's parent must itself have no parent), matching
-- the spec's plain "replies" ask rather than deep nested threads.
alter table comments add column if not exists parent_id uuid references comments(id);
create index if not exists comments_parent_id_idx on comments (parent_id);

-- `resolved` already exists (001_premium_workspace.sql) but there was no RLS policy
-- letting the project owner actually change it — comments only had public
-- read/insert policies. Same for deleting a comment (moderation).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments' and policyname = 'owners manage comments on their shares'
  ) then
    create policy "owners manage comments on their shares"
      on comments for update
      using (
        exists (
          select 1 from shares sh join projects p on p.id = sh.project_id
          where sh.id = comments.share_id and p.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'comments' and policyname = 'owners delete comments on their shares'
  ) then
    create policy "owners delete comments on their shares"
      on comments for delete
      using (
        exists (
          select 1 from shares sh join projects p on p.id = sh.project_id
          where sh.id = comments.share_id and p.user_id = auth.uid()
        )
      );
  end if;
end $$;
