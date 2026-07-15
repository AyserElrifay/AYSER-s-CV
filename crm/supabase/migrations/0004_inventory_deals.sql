-- =====================================================================
-- 0004 · Real-Estate Inventory (Developer Supermarket) + Deals
-- ---------------------------------------------------------------------
-- Projects are owned by a developer tenant. Units live inside projects.
-- `visibility` controls whether a project shows only to its owner, to
-- the whole seller network, or fully public.
-- =====================================================================

create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  location      text,
  geo           jsonb,                          -- { lat, lng, area }
  delivery_date date,
  payment_plans jsonb not null default '[]'::jsonb,
  media         jsonb not null default '[]'::jsonb,   -- images, brochure, video
  is_published  boolean not null default false,
  visibility    text not null default 'network' check (visibility in
                  ('private',   -- owning tenant only
                   'network',   -- every seller on the platform
                   'public')),  -- anyone
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists projects_tenant_idx     on public.projects (tenant_id);
create index if not exists projects_visibility_idx on public.projects (visibility, is_published);

create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Units
-- ---------------------------------------------------------------------
create table if not exists public.units (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  code        text not null,                    -- developer's unit code
  type        text,                             -- apartment | villa | retail | office
  area_sqm    numeric,
  bedrooms    int,
  floor       int,
  price       numeric not null check (price >= 0),
  status      text not null default 'available' check (status in
                ('available', 'reserved', 'sold', 'held')),
  attributes  jsonb not null default '{}'::jsonb,   -- view, finishing, orientation...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint units_unique_code_per_project unique (project_id, code)
);

create index if not exists units_project_status_idx
  on public.units (project_id, status, price);

create trigger units_touch
  before update on public.units
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Deals: a lead + a unit, closed by an agent or freelancer.
-- ---------------------------------------------------------------------
create table if not exists public.deals (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  lead_id         uuid not null references public.leads(id) on delete restrict,
  unit_id         uuid references public.units(id) on delete set null,
  closed_by_type  text check (closed_by_type in ('sales_agent', 'freelancer')),
  closed_by_id    uuid,
  amount          numeric not null check (amount >= 0),
  status          text not null default 'reservation' check (status in
                    ('reservation', 'contracted', 'cancelled', 'completed')),
  closed_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists deals_tenant_idx on public.deals (tenant_id, status);
create index if not exists deals_lead_idx   on public.deals (lead_id);

create trigger deals_touch
  before update on public.deals
  for each row execute function public.touch_updated_at();
