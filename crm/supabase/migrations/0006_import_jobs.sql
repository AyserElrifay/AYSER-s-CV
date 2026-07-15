-- =====================================================================
-- 0006 · AI Import Jobs
-- ---------------------------------------------------------------------
-- One row per Excel/CSV upload made through the AI chat assistant.
-- Stores the natural-language command, the AI's column mapping, and the
-- ingest stats — so every import is auditable and re-runnable.
-- Also closes the FK cycle: leads.import_job_id → import_jobs.id.
-- =====================================================================

create table if not exists public.import_jobs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  uploaded_by    uuid not null references public.users(id) on delete restrict,
  file_url       text not null,
  original_name  text,
  chat_context   jsonb,          -- the natural-language command the marketer typed
  column_mapping jsonb,          -- how the AI mapped sheet columns → lead fields
  stats          jsonb,          -- { total, inserted, duplicates, invalid }
  status         text not null default 'pending' check (status in
                   ('pending',          -- file received
                    'mapping_review',   -- AI proposed mapping, awaiting confirm
                    'processing',        -- writing rows
                    'done',
                    'failed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists import_jobs_tenant_idx on public.import_jobs (tenant_id, status);

create trigger import_jobs_touch
  before update on public.import_jobs
  for each row execute function public.touch_updated_at();

-- Now that import_jobs exists, wire the deferred FK from leads.
alter table public.leads
  drop constraint if exists leads_import_job_fk;
alter table public.leads
  add constraint leads_import_job_fk
  foreign key (import_job_id) references public.import_jobs(id) on delete set null;
