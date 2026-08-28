-- UFO project management: archive support
-- Run after schema.sql / 001_premium_workspace.sql / 002_launch_fixes.sql.
-- Purely additive — does not touch existing rows, users, or working features.

alter table projects add column if not exists archived_at timestamptz;

-- Archived projects are excluded from the default dashboard/projects views by
-- the application query (archived_at is null), not by RLS — owners can still
-- read/restore their own archived projects at any time.
create index if not exists projects_user_archived_idx on projects (user_id, archived_at);
