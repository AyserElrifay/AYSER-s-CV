-- Row-Level Security, column privileges, and the four application roles.
--
-- The design in one paragraph: the application connects as `unlost_app`, which is
-- NOINHERIT and holds no table privileges of its own. Every request opens a
-- transaction, SET LOCAL ROLE's to one of the four role-specific database roles,
-- and SET LOCAL's the tenant context. A query that forgets either step does not
-- silently read the whole table — it fails with "permission denied", or matches
-- no rows because current_org_id() is NULL.
--
-- Row visibility is RLS. Column visibility is GRANT. They are different
-- mechanisms because they answer different questions: RLS cannot hide a column,
-- and "a Member must never receive a financial field" is a column question.

revoke all on schema public from public;
grant usage on schema public to unlost_role_owner, unlost_role_manager, unlost_role_member, unlost_role_partner, unlost_bootstrap;
grant usage on schema unlost  to unlost_role_owner, unlost_role_manager, unlost_role_member, unlost_role_partner, unlost_app, unlost_bootstrap;

do $$
declare t text;
begin
  foreach t in array array['organizations','users','brand_kits','services','clients','deals','audit_log'] loop
    -- FORCE, not just ENABLE. Without FORCE the table's owner bypasses its own
    -- policies, and every policy below becomes decoration the moment anything
    -- connects with the migration role.
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('revoke all on table %I from public', t);
  end loop;
end $$;

-- --- organizations -----------------------------------------------------------

grant select, update on organizations to unlost_role_owner;
grant select (id, org_id, slug, name, name_ar, default_currency, house_rate_bp,
              margin_healthy_bp, margin_warning_bp, default_locale, numbering_system, created_at)
  on organizations to unlost_role_manager;
-- No house rate, no margin thresholds, no currency: nothing a Member or Partner
-- could assemble into a picture of the agency's economics.
grant select (id, org_id, slug, name, name_ar, default_locale, numbering_system, created_at)
  on organizations to unlost_role_member, unlost_role_partner;
-- Signup inserts the organisation it has just minted an id for; the WITH CHECK
-- means it can only create the org whose context it is already claiming.
grant insert on organizations to unlost_role_owner;

create policy organizations_owner_rw on organizations
  for all to unlost_role_owner
  using (id = unlost.current_org_id())
  with check (id = unlost.current_org_id());

create policy organizations_read on organizations
  for select to unlost_role_manager, unlost_role_member, unlost_role_partner
  using (id = unlost.current_org_id());

-- --- users -------------------------------------------------------------------

-- password_hash is granted to nobody at all. The only thing that reads it is
-- unlost.authenticate_lookup, which runs as unlost_bootstrap.
grant select (id, org_id, email, name, role, locale, is_active, created_at, last_login_at)
  on users to unlost_role_owner, unlost_role_manager;
grant select (id, org_id, email, name, role, locale, is_active, created_at, last_login_at)
  on users to unlost_role_member, unlost_role_partner;
grant insert, update, delete on users to unlost_role_owner;
grant update (last_login_at) on users to unlost_role_manager, unlost_role_member, unlost_role_partner;

create policy users_owner_rw on users
  for all to unlost_role_owner
  using (org_id = unlost.current_org_id())
  with check (org_id = unlost.current_org_id());

create policy users_manager_read on users
  for select to unlost_role_manager
  using (org_id = unlost.current_org_id());

-- A Member or Partner sees exactly one user: themselves.
create policy users_self_read on users
  for select to unlost_role_member, unlost_role_partner
  using (org_id = unlost.current_org_id() and id = unlost.current_user_id());

create policy users_self_touch on users
  for update to unlost_role_manager, unlost_role_member, unlost_role_partner
  using (org_id = unlost.current_org_id() and id = unlost.current_user_id())
  with check (org_id = unlost.current_org_id() and id = unlost.current_user_id());

-- --- brand kits --------------------------------------------------------------

grant select, insert, update on brand_kits to unlost_role_owner;
grant select on brand_kits to unlost_role_manager, unlost_role_member, unlost_role_partner;

create policy brand_kits_owner_rw on brand_kits
  for all to unlost_role_owner
  using (org_id = unlost.current_org_id())
  with check (org_id = unlost.current_org_id());

create policy brand_kits_read on brand_kits
  for select to unlost_role_manager, unlost_role_member, unlost_role_partner
  using (org_id = unlost.current_org_id());

-- --- services ----------------------------------------------------------------

grant select, insert, update, delete on services to unlost_role_owner;
-- An account manager needs the whole band: it is what the pricing slider moves
-- within, and it is internal by design.
grant select on services to unlost_role_manager;
-- A Member gets the task template and the name. No floor, no ceiling, no cost.
grant select (id, org_id, name, name_ar, task_template, is_active, created_at)
  on services to unlost_role_member;

create policy services_owner_rw on services
  for all to unlost_role_owner
  using (org_id = unlost.current_org_id())
  with check (org_id = unlost.current_org_id());

create policy services_read on services
  for select to unlost_role_manager, unlost_role_member
  using (org_id = unlost.current_org_id());

-- --- clients -----------------------------------------------------------------

grant select, insert, update, delete on clients to unlost_role_owner;
grant select, insert, update on clients to unlost_role_manager;
grant select (id, org_id, name, name_ar, country, created_at) on clients to unlost_role_member;

create policy clients_owner_rw on clients
  for all to unlost_role_owner
  using (org_id = unlost.current_org_id())
  with check (org_id = unlost.current_org_id());

create policy clients_manager_rw on clients
  for all to unlost_role_manager
  using (org_id = unlost.current_org_id())
  with check (org_id = unlost.current_org_id());

create policy clients_member_read on clients
  for select to unlost_role_member
  using (org_id = unlost.current_org_id());

-- --- deals -------------------------------------------------------------------

grant select, insert, update, delete on deals to unlost_role_owner;
grant select, insert, update on deals to unlost_role_manager;
-- A Member has no row policy on deals, so this grant currently exposes nothing.
-- It is here so that when Phase 3 gives Members visibility of the deal a task
-- belongs to, the financial columns are already unreachable — the grant, not a
-- future select list, is what keeps them out.
grant select (id, org_id, client_id, service_id, owner_user_id, title,
              delivery_date, status, created_at, updated_at)
  on deals to unlost_role_member;

create policy deals_owner_rw on deals
  for all to unlost_role_owner
  using (org_id = unlost.current_org_id())
  with check (org_id = unlost.current_org_id());

-- An account manager sees their own pipeline and nobody else's.
create policy deals_manager_rw on deals
  for all to unlost_role_manager
  using (org_id = unlost.current_org_id() and owner_user_id = unlost.current_user_id())
  with check (org_id = unlost.current_org_id() and owner_user_id = unlost.current_user_id());

-- --- audit log ---------------------------------------------------------------

-- Everyone appends; only the Owner reads. Nobody updates or deletes — see 0003.
grant insert on audit_log
  to unlost_role_owner, unlost_role_manager, unlost_role_member, unlost_role_partner;
grant select on audit_log to unlost_role_owner;

create policy audit_append on audit_log
  for insert to unlost_role_owner, unlost_role_manager, unlost_role_member, unlost_role_partner
  with check (org_id = unlost.current_org_id());

create policy audit_owner_read on audit_log
  for select to unlost_role_owner
  using (org_id = unlost.current_org_id());

-- --- the one sanctioned bypass -----------------------------------------------

-- Sign-in is the single moment where tenant context cannot exist yet: the email
-- address is all we have, and which organisation it belongs to is the question
-- being asked. This function answers exactly that and nothing else.
--
-- It runs as unlost_bootstrap, which cannot log in, holds no other privilege, and
-- is reachable only through this function. Everything else in the system —
-- signup included — runs under ordinary tenant context.
create or replace function unlost.authenticate_lookup(p_email text)
returns table (
  user_id       uuid,
  org_id        uuid,
  org_slug      text,
  org_name      text,
  user_role     user_role,
  password_hash text,
  is_active     boolean,
  user_name     text,
  locale        text
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select u.id, u.org_id, o.slug, o.name, u.role, u.password_hash, u.is_active, u.name, u.locale
  from users u
  join organizations o on o.id = u.org_id
  where lower(u.email) = lower(p_email)
    and u.is_active
$$;

grant select on users, organizations to unlost_bootstrap;

create policy users_bootstrap_read on users
  for select to unlost_bootstrap using (true);
create policy organizations_bootstrap_read on organizations
  for select to unlost_bootstrap using (true);

-- Ownership is the whole point of the SECURITY DEFINER. Left owned by whoever
-- ran the migration, this function would execute with that role's privileges --
-- typically a superuser, which bypasses RLS entirely rather than through the
-- narrow, login-less role below.
alter function unlost.authenticate_lookup(text) owner to unlost_bootstrap;

revoke all on function unlost.authenticate_lookup(text) from public;
grant execute on function unlost.authenticate_lookup(text) to unlost_app;
