-- =====================================================================
-- 0003 · Leads + Rotation Policies + Assignments + Activities
-- ---------------------------------------------------------------------
-- The operational heart. Leads belong to a tenant; assignments record
-- who is working a lead right now; policies configure the AI rotation
-- engine; activities are the append-only audit of every touch.
-- =====================================================================

-- Rotation policies come first: leads/assignments reference them.
create table if not exists public.rotation_policies (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  name             text not null,
  mode             text not null default 'round_robin' check (mode in (
                     'round_robin',    -- fair, by turn
                     'weighted',       -- by agent performance/weight
                     'ai_recommended'  -- AI suggests best agent per lead
                   )),
  max_per_agent    int  not null default 10 check (max_per_agent > 0),
  sla_minutes      int  not null default 30 check (sla_minutes > 0),
  recycle_enabled  boolean not null default true,
  active_hours     jsonb,                    -- optional working-hours window
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists rotation_policies_tenant_idx
  on public.rotation_policies (tenant_id);

create trigger rotation_policies_touch
  before update on public.rotation_policies
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  import_job_id  uuid,                        -- FK added in 0006 to avoid cycle
  full_name      text not null,
  phone          text not null,               -- normalized to E.164 on ingest
  email          text,
  source         text,                        -- Facebook / Google / Landing...
  campaign       text,
  budget_min     numeric,
  budget_max     numeric,
  interest       jsonb not null default '{}'::jsonb,  -- area, unit type, purpose
  quality_score  numeric check (quality_score between 0 and 100),
  stage          text not null default 'new' check (stage in (
                   'new', 'assigned', 'contacted', 'qualified',
                   'negotiation', 'won', 'lost', 'recycled')),
  is_duplicate   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Same phone can't exist twice inside one company.
  constraint leads_unique_phone_per_tenant unique (tenant_id, phone)
);

create index if not exists leads_tenant_stage_idx   on public.leads (tenant_id, stage);
create index if not exists leads_tenant_quality_idx on public.leads (tenant_id, quality_score desc);
create index if not exists leads_name_trgm_idx      on public.leads using gin (full_name gin_trgm_ops);

create trigger leads_touch
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Lead assignments: who holds the lead, since when, until when.
-- assignee is polymorphic (a sales_agent user OR a freelancer), so we
-- store type + id rather than a single FK.
-- ---------------------------------------------------------------------
create table if not exists public.lead_assignments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  lead_id        uuid not null references public.leads(id) on delete cascade,
  assignee_type  text not null check (assignee_type in ('sales_agent', 'freelancer')),
  assignee_id    uuid not null,               -- users.id or freelancers.id
  policy_id      uuid references public.rotation_policies(id) on delete set null,
  assigned_by    text not null default 'auto' check (assigned_by in ('auto', 'manual', 'ai')),
  ai_reason      text,                         -- human-readable why (AI mode)
  status         text not null default 'active' check (status in
                   ('active', 'expired', 'recycled', 'completed')),
  assigned_at    timestamptz not null default now(),
  expires_at     timestamptz                   -- SLA deadline; NULL = no expiry
);

create index if not exists lead_assignments_lead_idx
  on public.lead_assignments (lead_id);
create index if not exists lead_assignments_assignee_idx
  on public.lead_assignments (assignee_type, assignee_id, status);

-- Invariant: at most ONE active assignment per lead. Enforces the
-- "first active assignment owns the lead" rule from the design doc and
-- stops two agents/freelancers fighting over the same lead.
create unique index if not exists lead_assignments_one_active_per_lead
  on public.lead_assignments (lead_id)
  where status = 'active';

-- ---------------------------------------------------------------------
-- Lead activities: append-only audit (calls, notes, stage changes...).
-- ---------------------------------------------------------------------
create table if not exists public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  type        text not null,                   -- call | whatsapp | note | stage_change...
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx
  on public.lead_activities (lead_id, created_at desc);
