-- ============================================================================
-- ufo — Supabase schema
-- Apply this as-is (in order) before writing any app code.
-- Section 1 = required for Phases 1.1–1.9. Section 2 = optional zero-cost
-- add-ons (see "Optional Zero-Cost Add-Ons" in the build command doc) —
-- apply only if you're building those too. Section 3 = launch-hardening
-- additions (rate limiting / audit log, referrals) — apply before going live.
-- ============================================================================

-- ---------- Section 1: Core (required) ----------

create table users (
  id uuid primary key references auth.users(id),
  name text,
  email text unique not null,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz default now()
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  thumbnail text
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  plan text not null default 'free' check (plan in ('free','starter','pro','business')),
  status text not null default 'active',
  provider text default 'paddle',
  paddle_subscription_id text,
  paddle_customer_id text,
  credits_remaining int not null default 150,
  credits_reset_at timestamptz not null default now(),
  renews_at timestamptz
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  project_type text not null default 'web' check (project_type in ('web','mobile','dashboard','landing','ecommerce')),
  design_style text,
  color_theme jsonb,
  font_pairing text,
  figma_export_status text default null,
  -- Section 2 columns are added via ALTER TABLE below, not inline here,
  -- so Section 1 stays a clean copy of the required Phase 1.1 schema.
  created_at timestamptz default now()
);

create table screens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  name text not null,
  order_index int not null default 0,
  code text not null,
  thumbnail text,
  created_at timestamptz default now()
);

create table shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) not null,
  slug text unique not null,
  is_public boolean not null default true,
  created_at timestamptz default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  paddle_transaction_id text,
  amount numeric,
  status text,
  created_at timestamptz default now()
);

-- Indexes on every foreign key that the app actually filters by. Postgres
-- indexes primary keys and UNIQUE columns automatically (so `shares.slug`
-- and `users.email` already have one) but NOT plain foreign keys — every
-- one of these backs a real WHERE clause somewhere in app/.
create index if not exists subscriptions_user_id_idx on subscriptions (user_id);
create index if not exists projects_user_id_idx on projects (user_id);
create index if not exists screens_project_id_idx on screens (project_id);
create index if not exists shares_project_id_idx on shares (project_id);
create index if not exists payments_user_id_idx on payments (user_id);

-- Row Level Security — every table owner-scoped except public shares/templates.
alter table users enable row level security;
alter table subscriptions enable row level security;
alter table projects enable row level security;
alter table screens enable row level security;
alter table shares enable row level security;
alter table payments enable row level security;

create policy "users read own row" on users for select using (auth.uid() = id);
create policy "users update own row" on users for update using (auth.uid() = id);

create policy "read own subscription" on subscriptions for select using (auth.uid() = user_id);

create policy "read own projects" on projects for select using (auth.uid() = user_id);
create policy "write own projects" on projects for insert with check (auth.uid() = user_id);
create policy "update own projects" on projects for update using (auth.uid() = user_id);
create policy "delete own projects" on projects for delete using (auth.uid() = user_id);

create policy "read own screens" on screens for select using (
  exists (select 1 from projects p where p.id = screens.project_id and p.user_id = auth.uid())
);
create policy "public screens via public share" on screens for select using (
  exists (select 1 from shares sh where sh.project_id = screens.project_id and sh.is_public = true)
);
create policy "write own screens" on screens for all using (
  exists (select 1 from projects p where p.id = screens.project_id and p.user_id = auth.uid())
);

create policy "public project via public share" on projects for select using (
  exists (select 1 from shares sh where sh.project_id = projects.id and sh.is_public = true)
);

create policy "public shares are readable" on shares for select using (is_public = true);
create policy "owners manage their shares" on shares for all using (
  exists (select 1 from projects p where p.id = shares.project_id and p.user_id = auth.uid())
);

create policy "read own payments" on payments for select using (auth.uid() = user_id);

-- Admins bypass RLS via the service-role key from server-side routes only
-- (see lib/supabase/admin.ts) — never expose the service-role key client-side.

-- ============================================================================
-- Section 2: Optional Zero-Cost Add-Ons — apply only if building these
-- ============================================================================

-- Project folders, tags, favorites
alter table projects add column if not exists folder_id uuid;
alter table projects add column if not exists tags text[] default '{}';
alter table projects add column if not exists is_favorite boolean default false;

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  name text not null,
  created_at timestamptz default now()
);
create index if not exists folders_user_id_idx on folders (user_id);
alter table folders enable row level security;
create policy "read own folders" on folders for select using (auth.uid() = user_id);
create policy "manage own folders" on folders for all using (auth.uid() = user_id);

-- Version history per screen
create table if not exists screen_versions (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid references screens(id) not null,
  code text not null,
  created_at timestamptz default now()
);
create index if not exists screen_versions_screen_id_idx on screen_versions (screen_id);
alter table screen_versions enable row level security;
create policy "read own screen versions" on screen_versions for select using (
  exists (
    select 1 from screens s join projects p on p.id = s.project_id
    where s.id = screen_versions.screen_id and p.user_id = auth.uid()
  )
);

-- Comments & annotations on a shared prototype (anonymous stakeholders allowed)
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  share_id uuid references shares(id) not null,
  screen_id uuid references screens(id) not null,
  x numeric not null,
  y numeric not null,
  author_name text not null default 'Guest',
  body text not null,
  created_at timestamptz default now()
);
create index if not exists comments_share_id_idx on comments (share_id);
create index if not exists comments_screen_id_idx on comments (screen_id);
alter table comments enable row level security;
create policy "anyone can read comments on a public share" on comments for select using (
  exists (select 1 from shares sh where sh.id = comments.share_id and sh.is_public = true)
);
create policy "anyone can add a comment on a public share" on comments for insert with check (
  exists (select 1 from shares sh where sh.id = comments.share_id and sh.is_public = true)
);

-- ============================================================================
-- Section 3: Launch Hardening — apply before going live
-- ============================================================================

-- Doubles as (a) the rate-limit window store for lib/rate-limit.ts and
-- (b) a lightweight audit trail surfaced at /admin/activity. Only ever
-- written/read via the service-role client (lib/supabase/admin.ts) — no
-- public RLS policies, so it's effectively locked to server-side code.
create table if not exists request_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  route text not null,
  meta jsonb,
  created_at timestamptz default now()
);
create index if not exists request_log_user_route_idx on request_log (user_id, route, created_at desc);
alter table request_log enable row level security;
-- Intentionally no policies — service-role only.

-- Backs the "duplicate requests return cached responses at no extra
-- credit cost" rule stated in the Credit Rules / Fair Usage Policy
-- sections of the pricing doc — /api/generate hashes the request and
-- checks here before calling Gemini or deducting credits.
create table if not exists generation_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz default now()
);
create index if not exists generation_cache_user_hash_idx on generation_cache (user_id, request_hash, created_at desc);
alter table generation_cache enable row level security;
-- Intentionally no policies — service-role only, same as request_log.

-- Referral tracking (Optional Zero-Cost Add-On): a code per user, and who
-- signed up using it. Rewards are non-credit (e.g. bonus storage) so this
-- never touches the AI cost model.
alter table users add column if not exists referral_code text unique;
alter table users add column if not exists notify_low_credits boolean not null default true;
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references users(id) not null,
  referred_id uuid references users(id) not null unique,
  created_at timestamptz default now()
);
alter table referrals enable row level security;
create policy "read own referrals" on referrals for select using (auth.uid() = referrer_id);

