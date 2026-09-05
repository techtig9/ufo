-- ===========================================================================
-- Phase 4 — publishing: the publish log and prototype view analytics.
--
-- Scope note, because the Master Command's publishing list is explicitly
-- conditional ("If real hosting is implemented"):
--
--   UFO does not host anything. Publishing makes a share link live at
--   /proto/<slug> on UFO's own domain; it does not deploy a site. Custom
--   domains, SSL, subdomains and deployment rollback are therefore properties
--   of infrastructure that does not exist here, and are labelled unavailable in
--   the product rather than stubbed.
--
--   What IS real is recorded here: every publish and unpublish, and every view
--   of a published prototype.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. The publish log.
--
-- Append-only, written service-role side. This is the honest form of
-- "deployment status and history" for UFO: a record of when a link went live,
-- when it stopped, and who did it.
-- ---------------------------------------------------------------------------
create table if not exists share_publish_events (
  id uuid primary key default gen_random_uuid(),
  share_id uuid references shares(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  actor_id uuid references users(id) on delete set null,
  action text not null check (action in ('published', 'unpublished', 'settings_changed')),
  -- The settings in force after the event, so the log explains itself without
  -- having to reconstruct state from the shares row as it is now.
  had_password boolean not null default false,
  expires_at timestamptz,
  allow_comments boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists share_publish_events_project_idx
  on share_publish_events (project_id, created_at desc);

alter table share_publish_events enable row level security;

drop policy if exists "collaborators read the publish log" on share_publish_events;
create policy "collaborators read the publish log"
  on share_publish_events for select
  using (can_access_project(project_id, 'viewer'));

-- No write policy: a publish log a client can write is not a log.

-- ---------------------------------------------------------------------------
-- 2. Prototype views.
--
-- Deliberately minimal, and deliberately NOT identifying:
--
--   * no IP address, raw or hashed — a per-visitor identifier is exactly what
--     turns analytics into personal data, and UFO does not need one to answer
--     "is anyone looking at this?";
--   * no user agent string, only a coarse bucket;
--   * only the referrer's HOST, never the full URL, which can carry a path and
--     query a referring site did not intend to share.
--
-- This is why prototype analytics needs no cookie and no consent banner entry:
-- there is nothing stored that identifies a visitor.
-- ---------------------------------------------------------------------------
create table if not exists share_views (
  id uuid primary key default gen_random_uuid(),
  share_id uuid references shares(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  device text check (device in ('mobile', 'tablet', 'desktop', 'unknown')),
  referrer_host text,
  viewed_at timestamptz not null default now()
);

create index if not exists share_views_project_time_idx on share_views (project_id, viewed_at desc);

alter table share_views enable row level security;

drop policy if exists "collaborators read prototype views" on share_views;
create policy "collaborators read prototype views"
  on share_views for select
  using (can_access_project(project_id, 'viewer'));

-- No client write policy: views are recorded server-side when the page renders,
-- so a visitor cannot inflate or forge someone's numbers.

-- ---------------------------------------------------------------------------
-- 3. A rolled-up read, so the panel is one query rather than pulling every row.
-- ---------------------------------------------------------------------------
create or replace function public.share_view_stats(p_project uuid, p_days int default 30)
returns table (
  total_views bigint,
  recent_views bigint,
  last_viewed_at timestamptz,
  active_days bigint
)
language sql
security definer
set search_path = public
stable
as $$
  -- SECURITY DEFINER bypasses RLS, so authorisation is made explicit here
  -- rather than inherited: a caller with no access gets zeros, not someone
  -- else's numbers.
  select
    case when allowed then coalesce(count(*), 0) else 0 end,
    case when allowed then coalesce(count(*) filter (where v.viewed_at > now() - make_interval(days => p_days)), 0) else 0 end,
    case when allowed then max(v.viewed_at) else null end,
    case when allowed then coalesce(count(distinct date_trunc('day', v.viewed_at)), 0) else 0 end
  from (select can_access_project(p_project, 'viewer') as allowed) a
  left join share_views v on v.project_id = p_project
  group by allowed;
$$;
