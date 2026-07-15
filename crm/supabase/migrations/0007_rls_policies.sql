-- =====================================================================
-- 0007 · Row-Level Security — the isolation contract
-- ---------------------------------------------------------------------
-- Tenant isolation is enforced HERE, at the database, so a bug in app
-- code can never leak one company's data to another. Every policy keys
-- off the JWT helpers from migration 0001:
--   public.current_tenant_id() · public.current_role() · public.is_master()
--
-- Rule summary:
--   • master_admin / master_marketer  → cross-tenant full access
--   • tenant_admin / sales_manager     → everything within their tenant
--   • sales_agent                      → only leads assigned to them
--   • freelancer                       → own row + network/public inventory
-- =====================================================================

-- Convenience predicates (STABLE, JWT-only → safe in policies, no recursion).
create or replace function public.is_tenant_manager()
returns boolean language sql stable as $$
  select public.current_role() in ('tenant_admin', 'sales_manager');
$$;

create or replace function public.is_sales_agent()
returns boolean language sql stable as $$
  select public.current_role() = 'sales_agent';
$$;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere. (Deny-by-default the moment it's on.)
-- ---------------------------------------------------------------------
alter table public.tenants                  enable row level security;
alter table public.users                    enable row level security;
alter table public.rotation_policies        enable row level security;
alter table public.leads                    enable row level security;
alter table public.lead_assignments         enable row level security;
alter table public.lead_activities          enable row level security;
alter table public.projects                 enable row level security;
alter table public.units                    enable row level security;
alter table public.deals                    enable row level security;
alter table public.freelancers              enable row level security;
alter table public.freelancer_subscriptions enable row level security;
alter table public.commissions              enable row level security;
alter table public.import_jobs              enable row level security;

-- =====================================================================
-- TENANTS
-- =====================================================================
create policy tenants_master_all on public.tenants
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

-- A tenant user may read only their own company record.
create policy tenants_self_read on public.tenants
  for select to authenticated
  using (id = public.current_tenant_id());

-- =====================================================================
-- USERS
-- =====================================================================
create policy users_master_all on public.users
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

-- Read teammates within the same tenant.
create policy users_same_tenant_read on public.users
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- Managers may manage users inside their own tenant.
create policy users_manager_write on public.users
  for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_manager())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_manager());

-- =====================================================================
-- ROTATION POLICIES
-- =====================================================================
create policy rotation_master_all on public.rotation_policies
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

create policy rotation_tenant_read on public.rotation_policies
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy rotation_manager_write on public.rotation_policies
  for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_manager())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_manager());

-- =====================================================================
-- LEADS
-- =====================================================================
create policy leads_master_all on public.leads
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

-- Managers see all leads in their tenant.
create policy leads_manager_read on public.leads
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_manager());

create policy leads_manager_write on public.leads
  for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_manager())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_manager());

-- Sales agents see ONLY leads actively assigned to them.
create policy leads_agent_read on public.leads
  for select to authenticated
  using (
    public.is_sales_agent()
    and tenant_id = public.current_tenant_id()
    and id in (
      select lead_id from public.lead_assignments
      where assignee_type = 'sales_agent'
        and assignee_id = auth.uid()
        and status = 'active'
    )
  );

-- Agents may update the stage/notes of their assigned leads (not create/delete).
create policy leads_agent_update on public.leads
  for update to authenticated
  using (
    public.is_sales_agent()
    and tenant_id = public.current_tenant_id()
    and id in (
      select lead_id from public.lead_assignments
      where assignee_type = 'sales_agent'
        and assignee_id = auth.uid()
        and status = 'active'
    )
  )
  with check (tenant_id = public.current_tenant_id());

-- =====================================================================
-- LEAD ASSIGNMENTS
-- =====================================================================
create policy assignments_master_all on public.lead_assignments
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

create policy assignments_manager_all on public.lead_assignments
  for all to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_manager())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_manager());

-- Agents read their own assignments.
create policy assignments_agent_read on public.lead_assignments
  for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and assignee_type = 'sales_agent'
    and assignee_id = auth.uid()
  );

-- Freelancers read their own assignments (assignee is a freelancers.id).
create policy assignments_freelancer_read on public.lead_assignments
  for select to authenticated
  using (
    assignee_type = 'freelancer'
    and assignee_id in (
      select id from public.freelancers where auth_user_id = auth.uid()
    )
  );

-- =====================================================================
-- LEAD ACTIVITIES
-- =====================================================================
create policy activities_master_all on public.lead_activities
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

create policy activities_manager_read on public.lead_activities
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_manager());

-- Any tenant member may log an activity on a lead in their tenant.
create policy activities_member_insert on public.lead_activities
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid());

-- Agents read activities on their own assigned leads.
create policy activities_agent_read on public.lead_activities
  for select to authenticated
  using (
    public.is_sales_agent()
    and lead_id in (
      select lead_id from public.lead_assignments
      where assignee_type = 'sales_agent'
        and assignee_id = auth.uid()
        and status = 'active'
    )
  );

-- =====================================================================
-- PROJECTS  (Developer Supermarket)
-- =====================================================================
create policy projects_master_all on public.projects
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

-- Owner tenant manages its own projects.
create policy projects_owner_all on public.projects
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Published network/public inventory is readable by ANY authenticated seller
-- (agents in other tenants + freelancers) so it can appear in the supermarket.
create policy projects_network_read on public.projects
  for select to authenticated
  using (is_published and visibility in ('network', 'public'));

-- =====================================================================
-- UNITS  (visible when their project is visible)
-- =====================================================================
create policy units_master_all on public.units
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

create policy units_owner_all on public.units
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy units_network_read on public.units
  for select to authenticated
  using (
    project_id in (
      select id from public.projects
      where is_published and visibility in ('network', 'public')
    )
  );

-- =====================================================================
-- DEALS
-- =====================================================================
create policy deals_master_all on public.deals
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

create policy deals_tenant_all on public.deals
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Freelancers read deals they closed.
create policy deals_freelancer_read on public.deals
  for select to authenticated
  using (
    closed_by_type = 'freelancer'
    and closed_by_id in (
      select id from public.freelancers where auth_user_id = auth.uid()
    )
  );

-- =====================================================================
-- FREELANCERS  (cross-tenant identity)
-- =====================================================================
create policy freelancers_master_all on public.freelancers
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

-- A freelancer reads/updates only their own profile.
create policy freelancers_self on public.freelancers
  for all to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- =====================================================================
-- FREELANCER SUBSCRIPTIONS
-- =====================================================================
create policy subscriptions_master_all on public.freelancer_subscriptions
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

create policy subscriptions_self_read on public.freelancer_subscriptions
  for select to authenticated
  using (
    freelancer_id in (
      select id from public.freelancers where auth_user_id = auth.uid()
    )
  );

-- =====================================================================
-- COMMISSIONS
-- =====================================================================
create policy commissions_master_all on public.commissions
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

create policy commissions_tenant_read on public.commissions
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_manager());

-- Freelancer reads commissions owed to them.
create policy commissions_freelancer_read on public.commissions
  for select to authenticated
  using (
    beneficiary_type = 'freelancer'
    and beneficiary_id in (
      select id from public.freelancers where auth_user_id = auth.uid()
    )
  );

-- =====================================================================
-- IMPORT JOBS
-- =====================================================================
create policy import_jobs_master_all on public.import_jobs
  for all to authenticated
  using (public.is_master())
  with check (public.is_master());

create policy import_jobs_tenant_read on public.import_jobs
  for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_manager());
