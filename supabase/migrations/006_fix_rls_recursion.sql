-- CRITICAL FIX — pre-existing bug in the original schema.sql (predates every phase of this
-- upgrade). Not something any of migrations 001-005 introduced.
--
-- `projects` has a policy "public project via public share" that queries `shares` to check
-- visibility. `shares` has a policy "owners manage their shares" (FOR ALL, i.e. including
-- SELECT) that queries `projects` back. Postgres detects this as infinite recursion and
-- REFUSES the query outright — with this exact error:
--   ERROR: infinite recursion detected in policy for relation "projects"
--
-- This fires for every anonymous or non-owner visitor to a published prototype link — which
-- is the primary way /proto/[slug] is meant to be used. Verified by testing as a real
-- non-superuser Postgres role with RLS actually enforced (a superuser session bypasses RLS
-- entirely, which is why this didn't surface in any earlier superuser-based check).
--
-- Standard fix: a SECURITY DEFINER helper function bypasses RLS for its own internal query,
-- breaking the cycle. This is the pattern Supabase's own docs recommend for exactly this
-- situation. Only the `projects` side needs it — that's enough to break the cycle for both
-- directions, since nothing can recurse back through `projects` once its own policy no
-- longer re-triggers `shares`'s RLS.

create or replace function public.is_project_publicly_shared(pid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from shares where project_id = pid and is_public = true);
$$;

drop policy if exists "public project via public share" on projects;
create policy "public project via public share"
  on projects for select
  using (public.is_project_publicly_shared(projects.id));
