-- ─── THE GROUP RULES, ASKED RATHER THAN ASSUMED ─────────────────────
--  Four people, two groups, and every line prints PASS or FAIL.
--  Run by scripts/check-group-rules.sh against a real database built
--  from the real files. A private group's wall is somebody's private
--  conversation; "the policy looks right" is not the same as having
--  asked a stranger to read it and watched them fail.
--
--  Written to fail first: with an impossible member count in the last
--  assertion it reported FAIL, so the PASSes above it mean something.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
grant all on all sequences in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;

-- four people
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111','owner@t'),
  ('22222222-2222-4222-8222-222222222222','admin@t'),
  ('33333333-3333-4333-8333-333333333333','member@t'),
  ('44444444-4444-4444-8444-444444444444','stranger@t') on conflict do nothing;
insert into public.profiles (id, name) values
  ('11111111-1111-4111-8111-111111111111','Owner'),
  ('22222222-2222-4222-8222-222222222222','Admin'),
  ('33333333-3333-4333-8333-333333333333','Member'),
  ('44444444-4444-4444-8444-444444444444','Stranger')
  on conflict (id) do update set name = excluded.name;

insert into public.groups (id, owner_id, name, privacy) values
  ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Private Group','request'),
  ('aaaaaaaa-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','Open Group','open');
insert into public.group_members (group_id, user_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','admin','joined'),
  ('aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','member','joined');
insert into public.group_posts (id, group_id, author_id, body) values
  ('bbbbbbbb-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','inside the private group');

\echo '── the owner really is the owner (set by the trigger, not by hand) ──'
select case when role='owner' then 'PASS' else 'FAIL role='||role end
  from public.group_members
 where group_id='aaaaaaaa-0000-4000-8000-000000000001' and user_id='11111111-1111-4111-8111-111111111111';

set role authenticated;

\echo '── a stranger and a private wall ──'
set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
select case when count(*)=0 then 'PASS  a stranger reads 0 posts on a private wall'
            else 'FAIL  a stranger read '||count(*)||' private post(s)' end from public.group_posts;

\echo '── a member reads it ──'
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select case when count(*)=1 then 'PASS  a member reads the post'
            else 'FAIL  a member sees '||count(*) end from public.group_posts;

\echo '── a stranger cannot post into a group they are not in ──'
set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
insert into public.group_posts (group_id, author_id, body)
  values ('aaaaaaaa-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','let me in');
\echo '(above must be a policy violation)'

\echo '── a stranger cannot write themselves in as an admin ──'
insert into public.group_members (group_id, user_id, role, status)
  values ('aaaaaaaa-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','admin','joined');
\echo '(above must be a policy violation)'

\echo '── joining a private group is ASKING, not joining ──'
insert into public.group_members (group_id, user_id, role, status)
  values ('aaaaaaaa-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','member','requested');
select case when count(*)=1 then 'PASS  the request was stored' else 'FAIL' end
  from public.group_members where user_id='44444444-4444-4444-8444-444444444444' and status='requested';

\echo '── and asking does not let them read the wall ──'
select case when count(*)=0 then 'PASS  still 0 posts while waiting'
            else 'FAIL  a waiting request read '||count(*)||' post(s)' end from public.group_posts;

\echo '── an open group lets anyone in at once ──'
insert into public.group_members (group_id, user_id, role, status)
  values ('aaaaaaaa-0000-4000-8000-000000000002','44444444-4444-4444-8444-444444444444','member','joined');
select case when count(*)=1 then 'PASS  joined the open group instantly' else 'FAIL' end
  from public.group_members where user_id='44444444-4444-4444-8444-444444444444'
   and group_id='aaaaaaaa-0000-4000-8000-000000000002' and status='joined';

\echo '── a member cannot approve anybody ──'
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select public.group_approve('aaaaaaaa-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444');
\echo '(above must be "not an admin of this group")'

\echo '── an admin can ──'
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select public.group_approve('aaaaaaaa-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444');
set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
select case when count(*)=1 then 'PASS  once let in, the wall is readable'
            else 'FAIL  sees '||count(*) end from public.group_posts
 where group_id='aaaaaaaa-0000-4000-8000-000000000001';

\echo '── an admin cannot remove the owner ──'
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select public.group_remove_member('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111');
\echo '(above must be "the owner cannot be removed from their own group")'

\echo '── an admin cannot hand out roles; only the owner can ──'
select public.group_set_role('aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','admin');
\echo '(above must be "only the owner changes roles")'
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.group_set_role('aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','admin');
select case when role='admin' then 'PASS  the owner promoted a member' else 'FAIL role='||role end
  from public.group_members where group_id='aaaaaaaa-0000-4000-8000-000000000001'
   and user_id='33333333-3333-4333-8333-333333333333';

\echo '── the owner cannot walk out of their own group by accident ──'
delete from public.group_members
 where group_id='aaaaaaaa-0000-4000-8000-000000000001' and user_id='11111111-1111-4111-8111-111111111111';
select case when count(*)=1 then 'PASS  the owner is still in it' else 'FAIL  the owner left' end
  from public.group_members where group_id='aaaaaaaa-0000-4000-8000-000000000001'
   and user_id='11111111-1111-4111-8111-111111111111';

\echo '── the wall, in one round trip ──'
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
insert into public.group_post_likes (post_id, user_id)
  values ('bbbbbbbb-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333');
insert into public.group_post_comments (post_id, author_id, body)
  values ('bbbbbbbb-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','first');
select case when author_name='Member' and likes=1 and comments=1 and liked and mine and can_remove
            then 'PASS  author, 1 like, 1 comment, liked by me, mine, removable by me'
            else 'FAIL  '||author_name||' likes='||likes||' comments='||comments||' liked='||liked||' mine='||mine end
  from public.group_wall('aaaaaaaa-0000-4000-8000-000000000001');

\echo '── "4 new posts" counts only what is new, and never your own ──'
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select public.group_seen('aaaaaaaa-0000-4000-8000-000000000001');
select case when unread=0 then 'PASS  nothing new right after looking' else 'FAIL unread='||unread end
  from public.group_unread() where group_id='aaaaaaaa-0000-4000-8000-000000000001';
insert into public.group_posts (group_id, author_id, body)
  values ('aaaaaaaa-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','my own post');
select case when unread=0 then 'PASS  your own post is not news to you' else 'FAIL unread='||unread end
  from public.group_unread() where group_id='aaaaaaaa-0000-4000-8000-000000000001';
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
insert into public.group_posts (group_id, author_id, body)
  values ('aaaaaaaa-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333','somebody else posted');
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select case when unread=1 then 'PASS  one new post from somebody else' else 'FAIL unread='||unread end
  from public.group_unread() where group_id='aaaaaaaa-0000-4000-8000-000000000001';

\echo '── an admin can take down somebody else''s post; a plain member cannot ──'
set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
delete from public.group_posts where id='bbbbbbbb-0000-4000-8000-000000000001';
select case when count(*)=1 then 'PASS  a plain member deleted nothing' else 'FAIL  the post is gone' end
  from public.group_posts where id='bbbbbbbb-0000-4000-8000-000000000001';
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
delete from public.group_posts where id='bbbbbbbb-0000-4000-8000-000000000001';
select case when count(*)=0 then 'PASS  an admin took it down' else 'FAIL  it is still there' end
  from public.group_posts where id='bbbbbbbb-0000-4000-8000-000000000001';

\echo '── and the count really does ignore somebody still waiting ──'
reset role;
insert into public.group_members (group_id, user_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','member','joined');
select case when members_count=3 then 'PASS  open group counts its 3 joined members'
            else 'FAIL  counts '||members_count end
  from public.groups_with_counts where id='aaaaaaaa-0000-4000-8000-000000000002';

\echo '── the count ignores a pending request ──'
insert into public.group_members (group_id, user_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','member','requested')
  on conflict (group_id, user_id) do nothing;
insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555','waiting@t') on conflict do nothing;
insert into public.group_members (group_id, user_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000002','55555555-5555-4555-8555-555555555555','member','requested');
select case when members_count=3 then 'PASS  still 3 with somebody waiting'
            else 'FAIL  counts '||members_count end
  from public.groups_with_counts where id='aaaaaaaa-0000-4000-8000-000000000002';
