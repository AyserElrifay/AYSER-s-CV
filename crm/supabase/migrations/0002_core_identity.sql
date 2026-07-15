-- =====================================================================
-- 0002 · Core Identity: tenants + users
-- ---------------------------------------------------------------------
-- One row per company in `tenants`. Every business table carries a
-- tenant_id FK to this table, and RLS keys off it. Agency (master)
-- staff have tenant_id = NULL and see across all tenants.
-- =====================================================================

create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,                 -- sub-portal at /{slug}
  type        text not null default 'developer'
              check (type in ('developer', 'brokerage', 'agency_internal')),
  plan        text not null default 'standard',
  branding    jsonb not null default '{}'::jsonb,   -- logo + colors per portal
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger tenants_touch
  before update on public.tenants
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- users mirrors auth.users (id is the same uuid) and adds the tenant +
-- role that drive every access decision.
--   tenant_id = NULL  → agency/master user (master_admin | master_marketer)
--   tenant_id = <x>   → belongs to company x (tenant_admin | sales_manager
--                        | sales_agent)
-- ---------------------------------------------------------------------

create table if not exists public.users (
  id                 uuid primary key,             -- == auth.users.id
  tenant_id          uuid references public.tenants(id) on delete cascade,
  role               text not null check (role in (
                       'master_admin',
                       'master_marketer',
                       'tenant_admin',
                       'sales_manager',
                       'sales_agent'
                     )),
  full_name          text,
  phone              text,
  is_active          boolean not null default true,
  performance_score  numeric not null default 50   -- 0–100, fed by AI engine
                     check (performance_score between 0 and 100),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Guard the invariant: master roles have no tenant, tenant roles must.
  constraint users_tenant_role_consistency check (
    (role in ('master_admin', 'master_marketer') and tenant_id is null)
    or
    (role in ('tenant_admin', 'sales_manager', 'sales_agent') and tenant_id is not null)
  )
);

create index if not exists users_tenant_idx on public.users (tenant_id);
create index if not exists users_role_idx   on public.users (tenant_id, role);

create trigger users_touch
  before update on public.users
  for each row execute function public.touch_updated_at();
