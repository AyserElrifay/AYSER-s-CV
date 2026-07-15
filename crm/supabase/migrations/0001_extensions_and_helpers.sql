-- =====================================================================
-- 0001 · Extensions + Auth Helper Functions + Access-Token Hook
-- ---------------------------------------------------------------------
-- These helpers are the single source of truth for "who is asking?".
-- Every RLS policy in later migrations calls them, so tenant isolation
-- lives in ONE place and is enforced by the database, not by app code.
-- =====================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";     -- fast text search on names

-- ---------------------------------------------------------------------
-- Read the current request's JWT claims. On Supabase these are populated
-- by the Custom Access Token Hook (public.custom_access_token_hook below)
-- and exposed to Postgres via `request.jwt.claims`.
-- All helpers are STABLE + SECURITY DEFINER-free so they are safe inside
-- RLS policies and never recurse.
-- ---------------------------------------------------------------------

create or replace function public.jwt_claims()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- tenant_id of the caller (NULL for agency/master users, who have no tenant)
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(public.jwt_claims() ->> 'tenant_id', '')::uuid;
$$;

-- role of the caller: master_admin | master_marketer | tenant_admin
--                     | sales_manager | sales_agent | freelancer
create or replace function public.current_role()
returns text
language sql
stable
as $$
  select coalesce(public.jwt_claims() ->> 'user_role', 'anon');
$$;

-- TRUE for agency (master) staff, who may cross tenant boundaries.
create or replace function public.is_master()
returns boolean
language sql
stable
as $$
  select coalesce((public.jwt_claims() ->> 'is_master')::boolean, false);
$$;

-- ---------------------------------------------------------------------
-- Custom Access Token Hook
-- ---------------------------------------------------------------------
-- Registered in Supabase Dashboard → Authentication → Hooks.
-- On every token mint it copies tenant_id / role / is_master from the
-- users table into the JWT, so the helpers above can read them cheaply
-- without touching a table inside an RLS policy (which would recurse).
-- ---------------------------------------------------------------------

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims  jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  u       record;
begin
  select tenant_id, role
    into u
    from public.users
   where id = (event ->> 'user_id')::uuid;

  if found then
    claims := jsonb_set(claims, '{tenant_id}',
                to_jsonb(coalesce(u.tenant_id::text, '')));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(u.role));
    claims := jsonb_set(claims, '{is_master}',
                to_jsonb(u.role in ('master_admin', 'master_marketer')));
  else
    -- May be a freelancer (separate identity table) or a brand-new signup.
    claims := jsonb_set(claims, '{user_role}', to_jsonb('anon'::text));
    claims := jsonb_set(claims, '{is_master}', 'false'::jsonb);
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Small reusable trigger to keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
