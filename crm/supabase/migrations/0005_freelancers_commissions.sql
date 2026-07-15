-- =====================================================================
-- 0005 · Freelance Network + Subscriptions + Commissions
-- ---------------------------------------------------------------------
-- Freelancers are a SEPARATE identity from users: they work across many
-- tenants, so they are not scoped to one tenant_id. They join either on
-- a monthly subscription (guaranteed lead quota) or commission-only.
-- =====================================================================

create table if not exists public.freelancers (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid unique,               -- == auth.users.id (login)
  full_name          text not null,
  phone              text unique not null,
  model              text not null check (model in (
                       'subscription',   -- pays monthly, receives leads
                       'commission_only' -- free, earns on close
                     )),
  tier               text not null default 'bronze'
                     check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  performance_score  numeric not null default 50
                     check (performance_score between 0 and 100),
  is_verified        boolean not null default false,   -- KYC before leads
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists freelancers_auth_idx on public.freelancers (auth_user_id);

create trigger freelancers_touch
  before update on public.freelancers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------
create table if not exists public.freelancer_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  freelancer_id       uuid not null references public.freelancers(id) on delete cascade,
  plan                text not null,             -- basic | pro | elite
  monthly_lead_quota  int  not null check (monthly_lead_quota >= 0),
  price               numeric not null check (price >= 0),
  status              text not null default 'active' check (status in
                        ('active', 'past_due', 'cancelled')),
  period_start        date not null,
  period_end          date not null,
  created_at          timestamptz not null default now(),

  constraint subscriptions_period_valid check (period_end >= period_start)
);

create index if not exists subscriptions_freelancer_idx
  on public.freelancer_subscriptions (freelancer_id, status);

-- ---------------------------------------------------------------------
-- Commissions: generated per deal, one row per beneficiary.
-- ---------------------------------------------------------------------
create table if not exists public.commissions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.tenants(id) on delete set null,
  deal_id           uuid not null references public.deals(id) on delete cascade,
  beneficiary_type  text not null check (beneficiary_type in
                      ('freelancer', 'sales_agent', 'agency')),
  beneficiary_id    uuid,                        -- freelancers.id / users.id / NULL
  rate              numeric not null check (rate >= 0),   -- agreed percentage
  amount            numeric not null check (amount >= 0), -- computed payout
  status            text not null default 'pending' check (status in
                      ('pending', 'approved', 'paid', 'disputed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists commissions_deal_idx        on public.commissions (deal_id);
create index if not exists commissions_beneficiary_idx on public.commissions (beneficiary_type, beneficiary_id, status);

create trigger commissions_touch
  before update on public.commissions
  for each row execute function public.touch_updated_at();
