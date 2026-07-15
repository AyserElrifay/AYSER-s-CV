\set ON_ERROR_STOP on
\pset pager off

-- Helper: become `authenticated` with a given JWT (sub + tenant + role).
-- We set the same claims our custom_access_token_hook would mint.

\echo '========================================================'
\echo 'TEST 1 — Al-Noor MANAGER sees all 6 Al-Noor leads, 0 Horizon'
\echo '========================================================'
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","tenant_id":"11111111-1111-1111-1111-111111111111","user_role":"sales_manager","is_master":false}', false);
select count(*) as al_noor_manager_visible_leads from public.leads;
reset role;

\echo ''
\echo '========================================================'
\echo 'TEST 2 — Horizon MANAGER must see ONLY its 1 lead (isolation)'
\echo '========================================================'
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c2000000-0000-0000-0000-000000000001","tenant_id":"22222222-2222-2222-2222-222222222222","user_role":"sales_manager","is_master":false}', false);
select count(*)                as horizon_manager_visible_leads,
       bool_or(full_name like '%النور%') as can_see_any_alnoor_name  -- must be false/null
  from public.leads;
reset role;

\echo ''
\echo '========================================================'
\echo 'TEST 3 — Al-Noor AGENT (Karim) sees 0 leads BEFORE rotation'
\echo '========================================================'
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000003","tenant_id":"11111111-1111-1111-1111-111111111111","user_role":"sales_agent","is_master":false}', false);
select count(*) as karim_visible_leads_before from public.leads;
reset role;

\echo ''
\echo '========================================================'
\echo 'TEST 4 — Manager runs the rotation engine'
\echo '========================================================'
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000002","tenant_id":"11111111-1111-1111-1111-111111111111","user_role":"sales_manager","is_master":false}', false);
select public.rotate_leads_round_robin('d3000000-0000-0000-0000-000000000001') as leads_assigned;
reset role;

\echo ''
\echo '========================================================'
\echo 'TEST 5 — Karim now sees only HIS assigned leads (a subset)'
\echo '========================================================'
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b1000000-0000-0000-0000-000000000003","tenant_id":"11111111-1111-1111-1111-111111111111","user_role":"sales_agent","is_master":false}', false);
select count(*) as karim_visible_leads_after from public.leads;
reset role;

\echo ''
\echo '========================================================'
\echo 'TEST 6 — Distribution split across the 2 Al-Noor agents'
\echo '========================================================'
select u.full_name, count(*) as assigned
  from public.lead_assignments a
  join public.users u on u.id = a.assignee_id
 where a.status = 'active'
 group by u.full_name
 order by u.full_name;

\echo ''
\echo '========================================================'
\echo 'TEST 7 — MASTER sees leads across BOTH tenants (7 total)'
\echo '========================================================'
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-0000-0000-000000000001","tenant_id":"","user_role":"master_admin","is_master":true}', false);
select count(*) as master_visible_leads from public.leads;
reset role;

\echo ''
\echo '========================================================'
\echo 'TEST 8 — Horizon agent sees Al-Noor network inventory in supermarket'
\echo '========================================================'
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c2000000-0000-0000-0000-000000000002","tenant_id":"22222222-2222-2222-2222-222222222222","user_role":"sales_agent","is_master":false}', false);
select count(*) as network_units_visible from public.units;
reset role;
