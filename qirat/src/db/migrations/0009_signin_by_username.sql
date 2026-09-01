-- Signing in as yourself.
--
-- The lookup matched an email address and nothing else. A username is now a way
-- in, so the one sanctioned RLS bypass in the system has to accept either — and
-- it stays the only one: still SECURITY DEFINER, still owned by a login-less
-- role, still reachable through nothing but an EXECUTE grant.

-- The return type and the parameter name both change, and neither can be
-- altered in place, so the function is replaced rather than redefined. Dropping
-- it also drops its grant, which is re-applied below.
drop function if exists qirat.authenticate_lookup(text);

create function qirat.authenticate_lookup(p_identifier text)
returns table (
  user_id              uuid,
  org_id               uuid,
  org_slug             text,
  org_name             text,
  user_role            user_role,
  password_hash        text,
  is_active            boolean,
  user_name            text,
  locale               text,
  must_change_password boolean
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select u.id, u.org_id, o.slug, o.name, u.role, u.password_hash, u.is_active,
         u.name, u.locale, u.must_change_password
  from users u
  join organizations o on o.id = u.org_id
  -- Either credential, one query. Two lookups would answer "does this username
  -- exist?" by which one came back faster.
  where (lower(u.email) = lower(p_identifier) or u.username = lower(p_identifier))
    and u.is_active
$$;

alter function qirat.authenticate_lookup(text) owner to qirat_bootstrap;
revoke all on function qirat.authenticate_lookup(text) from public;
grant execute on function qirat.authenticate_lookup(text) to qirat_app;
