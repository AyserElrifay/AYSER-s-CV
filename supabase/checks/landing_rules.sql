-- ─── THE LANDING RULES, ASKED RATHER THAN ASSUMED ───────────────────
--  Three people, one city, and every line prints PASS or FAIL. Run by
--  scripts/check-landing-rules.sh against a real database built from
--  the real files.
--
--  The claim this file exists to test is the one the whole feature
--  rests on: a stranger's guess must never reach a newcomer looking
--  like fact, and an edit must cost a step its standing.
--
--  Written to fail first — with the trust threshold read as one
--  confirmation instead of two, the "one person is not enough" line
--  reported FAIL — so the passes below it mean something.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated, anon;
grant all on all sequences in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;

insert into auth.users (id, email) values
  ('a1111111-1111-4111-8111-111111111111','writer@t'),
  ('a2222222-2222-4222-8222-222222222222','first@t'),
  ('a3333333-3333-4333-8333-333333333333','second@t'),
  ('a4444444-4444-4444-8444-444444444444','newcomer@t') on conflict do nothing;
insert into public.profiles (id, name) values
  ('a1111111-1111-4111-8111-111111111111','Writer'),
  ('a2222222-2222-4222-8222-222222222222','First'),
  ('a3333333-3333-4333-8333-333333333333','Second'),
  ('a4444444-4444-4444-8444-444444444444','Newcomer')
  on conflict (id) do update set name = excluded.name;

\echo '── what the EU guarantees is there from the first second ──'
set role authenticated;
set request.jwt.claim.sub = 'a4444444-4444-4444-8444-444444444444';
select case when count(*) >= 8 and bool_and(trusted) then 'PASS  ' || count(*) || ' EU-wide steps, all trusted with nobody having voted'
            else 'FAIL  ' || count(*) || ' steps, all trusted = ' || bool_and(trusted) end
  from public.arrival_list('LT', 'Vilnius') where scope = 'eu';

\echo '── a newcomer cannot write an EU-wide guarantee ──'
insert into public.arrival_steps (scope, slug, title, body, author_id)
  values ('eu', 'invented', 'Everyone gets free rent', 'Trust me.', 'a4444444-4444-4444-8444-444444444444');
\echo '(above must be a policy violation)'

\echo '── somebody who lives there writes a step about their city ──'
set request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';
insert into public.arrival_steps (id, scope, country, city, slug, title, body, author_id, sort)
  values ('bbbb1111-0000-4000-8000-000000000001','city','LT','Vilnius','address',
          'Registering in Vilnius', 'Bring the rental contract and your passport.',
          'a1111111-1111-4111-8111-111111111111', 11);
select case when count(*)=1 then 'PASS  the step was written' else 'FAIL' end
  from public.arrival_steps where id='bbbb1111-0000-4000-8000-000000000001';

\echo '── one person is not enough for a newcomer to be shown it ──'
set request.jwt.claim.sub = 'a2222222-2222-4222-8222-222222222222';
select public.arrival_confirm('bbbb1111-0000-4000-8000-000000000001', true, 'Took me 20 minutes.');
set request.jwt.claim.sub = 'a4444444-4444-4444-8444-444444444444';
select case when not trusted then 'PASS  still marked as needing checking (' || confirms || ' confirmation)'
            else 'FAIL  shown as trusted on ' || confirms end
  from public.arrival_list('LT','Vilnius') where id='bbbb1111-0000-4000-8000-000000000001';

\echo '── two different people are ──'
set request.jwt.claim.sub = 'a3333333-3333-4333-8333-333333333333';
select public.arrival_confirm('bbbb1111-0000-4000-8000-000000000001', true, null);
set request.jwt.claim.sub = 'a4444444-4444-4444-8444-444444444444';
select case when trusted then 'PASS  now shown, on ' || confirms || ' confirmations'
            else 'FAIL  still not trusted on ' || confirms end
  from public.arrival_list('LT','Vilnius') where id='bbbb1111-0000-4000-8000-000000000001';

\echo '── the same person twice is still one person ──'
set request.jwt.claim.sub = 'a2222222-2222-4222-8222-222222222222';
select public.arrival_confirm('bbbb1111-0000-4000-8000-000000000001', true, 'Still fine.');
set request.jwt.claim.sub = 'a4444444-4444-4444-8444-444444444444';
select case when confirms = 2 then 'PASS  confirming again moves the date, not the count'
            else 'FAIL  count went to ' || confirms end
  from public.arrival_list('LT','Vilnius') where id='bbbb1111-0000-4000-8000-000000000001';

\echo '── rewriting a trusted step costs it its standing ──'
set request.jwt.claim.sub = 'a4444444-4444-4444-8444-444444444444';
update public.arrival_steps set body = 'Actually you need nothing at all.'
 where id='bbbb1111-0000-4000-8000-000000000001';
select case when not trusted and confirms = 0
            then 'PASS  back to needing checking, and the old votes do not carry over'
            else 'FAIL  trusted=' || trusted || ' confirms=' || confirms end
  from public.arrival_list('LT','Vilnius') where id='bbbb1111-0000-4000-8000-000000000001';

\echo '── the shipped EU steps cannot be rewritten from a phone ──'
update public.arrival_steps set body = 'Ignore all of this.' where scope='eu' and slug='bank';
select case when body not like 'Ignore%' then 'PASS  unchanged' else 'FAIL  a phone rewrote an EU step' end
  from public.arrival_steps where scope='eu' and slug='bank';

\echo '── a step nobody has checked in six months says so ──'
reset role;
insert into public.arrival_steps (id, scope, country, city, slug, title, body, author_id, created_at, revised_at)
  values ('bbbb1111-0000-4000-8000-000000000002','city','LT','Vilnius','bank','Old advice','Was true once.',
          'a1111111-1111-4111-8111-111111111111', now() - interval '400 days', now() - interval '400 days');
insert into public.arrival_confirms (step_id, user_id, still_true, at) values
  ('bbbb1111-0000-4000-8000-000000000002','a2222222-2222-4222-8222-222222222222', true, now() - interval '300 days'),
  ('bbbb1111-0000-4000-8000-000000000002','a3333333-3333-4333-8333-333333333333', true, now() - interval '300 days');
set role authenticated;
set request.jwt.claim.sub = 'a4444444-4444-4444-8444-444444444444';
select case when stale and trusted then 'PASS  trusted, and openly marked as needing a fresh look'
            else 'FAIL  stale=' || stale || ' trusted=' || trusted end
  from public.arrival_list('LT','Vilnius') where id='bbbb1111-0000-4000-8000-000000000002';

\echo '── another city''s steps are not mine ──'
select case when count(*)=0 then 'PASS  Vilnius steps do not appear in Tallinn'
            else 'FAIL  ' || count(*) || ' leaked' end
  from public.arrival_list('EE','Tallinn') where scope <> 'eu';

\echo '── where you have got to is nobody else''s business ──'
select public.arrival_done('bbbb1111-0000-4000-8000-000000000001', true);
select case when done then 'PASS  it is ticked for me' else 'FAIL' end
  from public.arrival_list('LT','Vilnius') where id='bbbb1111-0000-4000-8000-000000000001';
set request.jwt.claim.sub = 'a2222222-2222-4222-8222-222222222222';
select case when not done then 'PASS  and not for anybody else'
            else 'FAIL  somebody else sees my progress' end
  from public.arrival_list('LT','Vilnius') where id='bbbb1111-0000-4000-8000-000000000001';
select case when count(*)=0 then 'PASS  and the row itself is unreadable to them'
            else 'FAIL  ' || count(*) || ' rows visible' end
  from public.arrival_progress where user_id='a4444444-4444-4444-8444-444444444444';

\echo '── the sentence somebody left is what makes it useful ──'
select case when count(*) >= 1 then 'PASS  ' || count(*) || ' note(s) from people who did it'
            else 'FAIL  no notes' end
  from public.arrival_notes('bbbb1111-0000-4000-8000-000000000001');
