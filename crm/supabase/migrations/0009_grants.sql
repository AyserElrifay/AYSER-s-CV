-- =====================================================================
-- 0009 · Role Grants
-- ---------------------------------------------------------------------
-- RLS decides WHICH ROWS a role may see; GRANTs decide whether the role
-- may touch the table at all. Both are required. The `authenticated`
-- role gets table access, but every row is still filtered by the RLS
-- policies in 0007. `anon` gets nothing.
-- =====================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

grant usage, select
  on all sequences in schema public
  to authenticated;

-- Engine + helper functions the app calls.
grant execute on function public.rotate_leads_round_robin(uuid) to authenticated;
grant execute on function public.expire_stale_assignments()     to authenticated;

-- Keep future tables/sequences covered automatically.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
