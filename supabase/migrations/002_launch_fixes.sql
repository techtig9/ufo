-- UFO launch fixes: version-history write policies
-- Run after schema.sql / 001_premium_workspace.sql.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'screen_versions'
      and policyname = 'insert own screen versions'
  ) then
    create policy "insert own screen versions"
      on screen_versions for insert
      with check (
        exists (
          select 1 from screens s
          join projects p on p.id = s.project_id
          where s.id = screen_versions.screen_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'screen_versions'
      and policyname = 'delete own screen versions'
  ) then
    create policy "delete own screen versions"
      on screen_versions for delete
      using (
        exists (
          select 1 from screens s
          join projects p on p.id = s.project_id
          where s.id = screen_versions.screen_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end $$;
