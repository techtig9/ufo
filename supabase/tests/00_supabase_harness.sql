-- Minimal stand-in for the parts of Supabase that schema.sql / the migrations
-- depend on, so the real files can be applied unmodified against plain Postgres.
--
-- This mirrors Supabase's actual setup closely enough to test what matters here:
--   * an auth.users table for the users.id foreign key
--   * auth.uid() reading a request-local setting, as Supabase's does
--   * the anon / authenticated / service_role roles
--   * Supabase's DEFAULT PRIVILEGES, which are the whole reason RLS matters:
--     anon and authenticated are granted full DML on public tables, so a table
--     with RLS disabled is wide open to anyone holding the public anon key.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Supabase implements auth.uid() as a read of a request-scoped GUC set from
-- the caller's JWT. Same shape here so RLS policies behave identically.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- The critical bit: Supabase grants these roles full DML on public tables by
-- default. RLS is the only thing that takes it back.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
