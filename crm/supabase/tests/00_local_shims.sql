-- CI/local shims: emulate the tiny slice of Supabase our migrations depend
-- on (the `authenticated` role + auth.uid()/auth.jwt()), so the isolation
-- tests can run on any vanilla Postgres. On real Supabase these already
-- exist and this file is NOT applied.
create role authenticated;
create role anon;
create role service_role;

create schema if not exists auth;

-- On Supabase, auth.uid() reads the JWT 'sub' claim. Here we read the same
-- request.jwt.claims GUC our own helpers use.
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;
