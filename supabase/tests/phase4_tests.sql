\set ON_ERROR_STOP off
\pset pager off

-- ===========================================================================
-- Phase 4: workspace roles, share permissions. Run as the real anon /
-- authenticated roles — a superuser bypasses RLS entirely and would prove
-- nothing.
-- ===========================================================================

-- owner, admin, editor, viewer, outsider
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001','owner@x.test'),
  ('a0000000-0000-0000-0000-000000000002','admin@x.test'),
  ('a0000000-0000-0000-0000-000000000003','editor@x.test'),
  ('a0000000-0000-0000-0000-000000000004','viewer@x.test'),
  ('a0000000-0000-0000-0000-000000000005','outsider@x.test');
insert into users (id, email) values
  ('a0000000-0000-0000-0000-000000000001','owner@x.test'),
  ('a0000000-0000-0000-0000-000000000002','admin@x.test'),
  ('a0000000-0000-0000-0000-000000000003','editor@x.test'),
  ('a0000000-0000-0000-0000-000000000004','viewer@x.test'),
  ('a0000000-0000-0000-0000-000000000005','outsider@x.test');

insert into workspaces (id, name, owner_id)
  values ('b0000000-0000-0000-0000-000000000001','Acme','a0000000-0000-0000-0000-000000000001');

insert into workspace_members (workspace_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','owner'),
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','admin'),
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','editor'),
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','viewer');

-- A workspace project, and a personal project belonging to the owner.
insert into projects (id, user_id, name, workspace_id) values
  ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Team Project','b0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Personal Project', null);

insert into screens (id, project_id, name, order_index, code) values
  ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','Home',0,'<main>team</main>'),
  ('d0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002','Home',0,'<main>personal</main>');

\echo ''
\echo '=== P4-1: a viewer can READ the workspace project ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
select count(*) as viewer_reads_team_project_expect_1 from projects where id='c0000000-0000-0000-0000-000000000001';
select count(*) as viewer_reads_team_screens_expect_1 from screens where project_id='c0000000-0000-0000-0000-000000000001';
reset role; reset request.jwt.claim.sub;

\echo ''
\echo '=== P4-2: a viewer CANNOT edit it ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
update projects set name='hijacked' where id='c0000000-0000-0000-0000-000000000001';
\echo '   ^ expect: UPDATE 0'
reset role; reset request.jwt.claim.sub;
select name as name_unchanged_expect_Team_Project from projects where id='c0000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== P4-3: an editor CAN edit it ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
update projects set name='Team Project v2' where id='c0000000-0000-0000-0000-000000000001';
\echo '   ^ expect: UPDATE 1'
reset role; reset request.jwt.claim.sub;

\echo ''
\echo '=== P4-4: an editor CANNOT delete it (that is an admin action) ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
delete from projects where id='c0000000-0000-0000-0000-000000000001';
\echo '   ^ expect: DELETE 0'
reset role; reset request.jwt.claim.sub;
select count(*) as project_survives_expect_1 from projects where id='c0000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== P4-5: an outsider sees NOTHING ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select count(*) as outsider_projects_expect_0 from projects;
select count(*) as outsider_screens_expect_0 from screens;
select count(*) as outsider_workspaces_expect_0 from workspaces;
select count(*) as outsider_roster_expect_0 from workspace_members;
reset role; reset request.jwt.claim.sub;

\echo ''
\echo '=== P4-6: a workspace member does NOT gain the owner personal project ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
select count(*) as editor_sees_personal_project_expect_0 from projects where id='c0000000-0000-0000-0000-000000000002';
reset role; reset request.jwt.claim.sub;

\echo ''
\echo '=== P4-7: an editor cannot promote themselves ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
update workspace_members set role='owner' where user_id='a0000000-0000-0000-0000-000000000003';
\echo '   ^ expect: UPDATE 0'
reset role; reset request.jwt.claim.sub;
select role as editor_role_unchanged_expect_editor from workspace_members where user_id='a0000000-0000-0000-0000-000000000003';

\echo ''
\echo '=== P4-8: an admin CAN manage the roster ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
update workspace_members set role='viewer' where user_id='a0000000-0000-0000-0000-000000000003';
\echo '   ^ expect: UPDATE 1'
reset role; reset request.jwt.claim.sub;
-- put it back
update workspace_members set role='editor' where user_id='a0000000-0000-0000-0000-000000000003';

\echo ''
\echo '=== P4-9: invite tokens are stored hashed, never in the clear ==='
insert into workspace_invites (workspace_id, email, role, token_hash, expires_at, invited_by)
  values ('b0000000-0000-0000-0000-000000000001','new@x.test','editor',
          encode(digest('the-real-token','sha256'),'hex'), now() + interval '7 days',
          'a0000000-0000-0000-0000-000000000001');
select count(*) as invites_storing_raw_token_expect_0
  from workspace_invites where token_hash = 'the-real-token';

\echo ''
\echo '=== P4-10: an outsider cannot read invites ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
select count(*) as outsider_sees_invites_expect_0 from workspace_invites;
reset role; reset request.jwt.claim.sub;

\echo ''
\echo '=== P4-11: only one PENDING invite per email per workspace ==='
insert into workspace_invites (workspace_id, email, role, token_hash, expires_at)
  values ('b0000000-0000-0000-0000-000000000001','new@x.test','viewer','otherhash', now() + interval '7 days');
\echo '   ^ expect: ERROR duplicate key'

\echo ''
\echo '=== P4-12: an EXPIRED share stops being anon-readable ==='
insert into shares (id, project_id, slug, is_public, expires_at) values
  ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','live-slug', true, now() + interval '1 day'),
  ('e0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','dead-slug', true, now() - interval '1 day');
reset request.jwt.claim.sub;
set role anon;
select count(*) as anon_sees_live_share_expect_1 from shares where slug='live-slug';
select count(*) as anon_sees_expired_share_expect_0 from shares where slug='dead-slug';
reset role;

\echo ''
\echo '=== P4-13: an expired share also hides its SCREENS, not just its row ==='
set role anon;
select count(*) as anon_sees_expired_screens_expect_0 from screens
  where project_id='c0000000-0000-0000-0000-000000000001';
reset role;

\echo ''
\echo '=== P4-14: a PASSWORD-PROTECTED share is not anon-readable at all ==='
update shares set password_hash='$2b$fake', expires_at=null where slug='live-slug';
set role anon;
select count(*) as anon_sees_password_share_expect_0 from shares where slug='live-slug';
select count(*) as anon_sees_password_screens_expect_0 from screens
  where project_id='c0000000-0000-0000-0000-000000000002';
reset role;

\echo ''
\echo '=== P4-15: removing the password restores public access ==='
update shares set password_hash=null where slug='live-slug';
set role anon;
select count(*) as anon_sees_share_again_expect_1 from shares where slug='live-slug';
select count(*) as anon_sees_screens_again_expect_1 from screens
  where project_id='c0000000-0000-0000-0000-000000000002';
reset role;

\echo ''
\echo '=== P4-16: comments respect allow_comments ==='
update shares set allow_comments=false where slug='live-slug';
set role anon;
insert into comments (share_id, screen_id, x, y, author_name, body)
  values ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000002',50,50,'Guest','hi');
\echo '   ^ expect: ERROR — commenting is switched off for this share'
reset role;

\echo ''
\echo '=== P4-17: activity feed is member-read, service-role write ==='
insert into workspace_activity (workspace_id, actor_id, action)
  values ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','project.created');
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
select count(*) as viewer_reads_activity_expect_1 from workspace_activity;
insert into workspace_activity (workspace_id, action) values ('b0000000-0000-0000-0000-000000000001','forged');
\echo '   ^ expect: ERROR — a forgeable audit trail is not an audit trail'
reset role; reset request.jwt.claim.sub;

\echo ''
\echo '=== P4-18: published prototypes still work (no policy recursion) ==='
set role anon;
select count(*) as anon_public_project_expect_1 from projects
  where id='c0000000-0000-0000-0000-000000000002';
reset role;
\echo '   ^ a recursion regression would ERROR here, not return a count'

\echo ''
\echo '=== P4-19: every public table still has RLS enabled ==='
select relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false;
\echo '   ^ expect: 0 rows'

-- ===========================================================================
-- Migration 011 — comment mentions, assignment, and the widened moderation
-- policies. Same discipline as above: every assertion runs as a real
-- anon/authenticated role, never as a superuser.
-- ===========================================================================

-- A live, comment-enabled share on the WORKSPACE project, so the workspace
-- moderation policies have something to act on. (The fixtures above left
-- 'live-slug' password-protected and pointing at the personal project.)
insert into shares (id, project_id, slug, is_public, allow_comments)
  values ('e0000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000001','team-slug', true, true);

insert into comments (id, share_id, screen_id, x, y, author_name, body) values
  ('f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000009',
   'd0000000-0000-0000-0000-000000000001',10,10,'Guest','please look at the header');

\echo ''
\echo '=== P4-20: a workspace VIEWER can resolve a comment on a team project ==='
-- Reviewing is not editing: resolving is deliberately open to viewer, which the
-- pre-011 policy (project owner only) did not allow at all.
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
update comments set resolved=true where id='f0000000-0000-0000-0000-000000000001';
\echo '   ^ expect: UPDATE 1'
reset role; reset request.jwt.claim.sub;
select resolved as resolved_expect_t from comments where id='f0000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== P4-21: an OUTSIDER cannot moderate that comment ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000005';
update comments set resolved=false where id='f0000000-0000-0000-0000-000000000001';
\echo '   ^ expect: UPDATE 0'
delete from comments where id='f0000000-0000-0000-0000-000000000001';
\echo '   ^ expect: DELETE 0'
reset role; reset request.jwt.claim.sub;
select count(*) as comment_survived_expect_1 from comments where id='f0000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== P4-22: a workspace VIEWER cannot DELETE a comment (editor+ only) ==='
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
delete from comments where id='f0000000-0000-0000-0000-000000000001';
\echo '   ^ expect: DELETE 0 — resolving is review, deleting is destructive'
reset role; reset request.jwt.claim.sub;
select count(*) as comment_still_there_expect_1 from comments where id='f0000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== P4-23: a CLIENT CANNOT FORGE A MENTION ==='
-- This is the important one. The comment endpoint is open to anonymous
-- visitors, so if a client could write comment_mentions directly it could make
-- UFO email any user id it could guess, with attacker-chosen text, from UFO's
-- own domain. There is deliberately no INSERT policy at all.
set role anon;
insert into comment_mentions (comment_id, user_id)
  values ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005');
\echo '   ^ expect: ERROR — anon cannot forge a mention'
reset role;

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
insert into comment_mentions (comment_id, user_id)
  values ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000005');
\echo '   ^ expect: ERROR — not even a workspace EDITOR can forge one'
reset role; reset request.jwt.claim.sub;

select count(*) as forged_mentions_expect_0 from comment_mentions;

\echo ''
\echo '=== P4-24: a service-role mention IS readable alongside its comment ==='
insert into comment_mentions (comment_id, user_id)
  values ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004');
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
select count(*) as member_reads_mention_expect_1 from comment_mentions;
reset role; reset request.jwt.claim.sub;

\echo ''
\echo '=== P4-25: the same person is only mentioned once per comment ==='
insert into comment_mentions (comment_id, user_id)
  values ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004');
\echo '   ^ expect: ERROR duplicate key — one notification, not two'

\echo ''
\echo '=== P4-26: deleting a comment takes its mentions with it ==='
-- ON DELETE CASCADE, so a resolved-and-deleted thread leaves no orphan rows
-- pointing at a comment that no longer exists.
delete from comments where id='f0000000-0000-0000-0000-000000000001';
select count(*) as orphan_mentions_expect_0 from comment_mentions
  where comment_id='f0000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== P4-27: can_moderate_comment does not leak across projects ==='
-- The outsider owns their own project and share; holding a role nowhere in
-- Acme must not let them moderate Acme's comments (asserted in P4-21), and
-- equally the Acme editor must not moderate theirs.
insert into projects (id, user_id, name, workspace_id)
  values ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000005','Outsider Project', null);
insert into screens (id, project_id, name, order_index, code)
  values ('d0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003','Home',0,'<main>out</main>');
insert into shares (id, project_id, slug, is_public, allow_comments)
  values ('e0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000003','out-slug', true, true);
insert into comments (id, share_id, screen_id, x, y, author_name, body) values
  ('f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000010',
   'd0000000-0000-0000-0000-000000000003',10,10,'Guest','not yours');

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
update comments set resolved=true where id='f0000000-0000-0000-0000-000000000002';
\echo '   ^ expect: UPDATE 0 — an Acme editor holds nothing on an outside project'
reset role; reset request.jwt.claim.sub;
select coalesce(bool_or(resolved), false) as leaked_expect_f from comments
  where id='f0000000-0000-0000-0000-000000000002';

\echo ''
\echo '=== P4-28: assignment columns exist and accept a null (unassign) ==='
update comments set assigned_to='a0000000-0000-0000-0000-000000000003', assigned_at=now()
  where id='f0000000-0000-0000-0000-000000000002';
select assigned_to is not null as assigned_expect_t from comments
  where id='f0000000-0000-0000-0000-000000000002';
update comments set assigned_to=null, assigned_by=null, assigned_at=null
  where id='f0000000-0000-0000-0000-000000000002';
select assigned_to is null as unassigned_expect_t from comments
  where id='f0000000-0000-0000-0000-000000000002';

\echo ''
\echo '=== P4-29: closing an account does not erase the feedback it touched ==='
-- author_id / assigned_to are ON DELETE SET NULL, not CASCADE: deleting a user
-- must blank the attribution, never delete a project's comment history. Asserted
-- from the catalog because the alternative — actually deleting a user — would
-- cascade their projects and prove something else.
select conname, confdeltype as expect_n_for_set_null
from pg_constraint
where conrelid = 'public.comments'::regclass
  and contype = 'f'
  and conname like '%author_id%' or (conrelid = 'public.comments'::regclass and contype='f' and conname like '%assigned%')
order by conname;

\echo ''
\echo '=== P4-30: a mention row cannot outlive its user ==='
-- comment_mentions.user_id IS cascade: a pending mention of a deleted account
-- is not something to keep, and there is nothing to attribute.
select confdeltype as expect_c_for_cascade
from pg_constraint
where conrelid = 'public.comment_mentions'::regclass
  and contype = 'f'
  and conname like '%user_id%';

\echo ''
\echo '=== P4-31: a comment BODY cannot be rewritten, by anyone ==='
-- RLS is row-level: the "workspace members moderate comments" policy lets a
-- viewer update the row, which without column-level grants would also let them
-- rewrite the text through PostgREST directly. A comment is immutable once
-- posted; only its review state may change.
insert into comments (id, share_id, screen_id, x, y, author_name, body) values
  ('f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000009',
   'd0000000-0000-0000-0000-000000000001',20,20,'Guest','the original words');

set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
update comments set body='rewritten by a viewer' where id='f0000000-0000-0000-0000-000000000003';
\echo '   ^ expect: ERROR permission denied (no UPDATE grant covering body)'
reset role; reset request.jwt.claim.sub;

-- Not even the project owner, who holds the migration-005 policy.
set role authenticated; set request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
update comments set body='rewritten by the owner' where id='f0000000-0000-0000-0000-000000000003';
\echo '   ^ expect: ERROR — an owner rewriting a guest comment is not moderation'
-- The review state is still theirs to change.
update comments set resolved=true where id='f0000000-0000-0000-0000-000000000003';
\echo '   ^ expect: UPDATE 1 — resolving still works'
reset role; reset request.jwt.claim.sub;

select body as body_unchanged_expect_the_original_words from comments
  where id='f0000000-0000-0000-0000-000000000003';
