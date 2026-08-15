#!/usr/bin/env bash
# ─── RUN_ME.sql HAS TO SURVIVE BEING RUN TWICE ───────────────────────
#
# It says "safe to re-run" at the top. It was not, twice over, and both
# times the failure was invisible until somebody ran it:
#
#   ERROR: check constraint "notifications_kind_check" … violated by
#          some row               ← an early NARROW list, later widened
#   ERROR: 42P16: cannot drop columns from view
#                                 ← an early NARROW view, later widened
#
# Both have the same shape: something defined early, redefined wider
# later, and validated against the state the LATER definition produced.
# A first run passes. Every run after it dies — and because one failed
# statement takes the whole file down, everything below that line
# silently never applies. That is how لمّة sat in the repository for
# days while the app truthfully reported it was not switched on.
#
# So: build a database from the real schema files, apply RUN_ME.sql, and
# then apply it AGAIN. The second run is the whole point.
#
#   bash scripts/check-sql-twice.sh
#
# Needs a local PostgreSQL 16. Skips (0) if there isn't one, so it can
# sit in CI without pretending to have checked something it didn't.

set -uo pipefail

# ─── A SKIP HAS TO BE LOUD ───────────────────────────────────────────
# This check needs a database. On a laptop without one, skipping is
# right. On the build machine it is not: the first time it ran in CI it
# finished in three seconds, said nothing, and passed — a check that
# cannot fail is not a check, and nobody would have noticed for weeks.
#
# So the build sets SQL_CHECK_REQUIRED=1, and there a skip is a
# failure, with the reason printed.
skip () {
  echo "$1"
  if [ "${SQL_CHECK_REQUIRED:-}" = "1" ]; then
    echo
    echo "This build requires the setup file to be really checked, and it was not."
    exit 1
  fi
  exit 0
}

PGBIN=/usr/lib/postgresql/16/bin
[ -x "$PGBIN/initdb" ] || skip "No local PostgreSQL 16 at $PGBIN — skipping."

# Postgres refuses to run as root, so everything below runs as the
# postgres user. Which way that is reached depends on where this is: as
# root, su; on a build machine where the account has passwordless sudo,
# sudo. Neither available means no database, and no database means this
# skips rather than pretending.
if [ "$(id -u)" = "0" ]; then
  as_postgres () { su postgres -c "$1"; }
elif sudo -n true >/dev/null 2>&1; then
  as_postgres () { sudo -n -u postgres bash -c "$1"; }
else
  skip "Cannot become the postgres user here (no root, no passwordless sudo) — skipping."
fi

DATA=/var/tmp/lamma-sqlcheck
SOCK=/var/tmp
PORT=55433

cleanup() { as_postgres "$PGBIN/pg_ctl -D $DATA/data stop -m immediate" >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$DATA"; mkdir -p "$DATA"; chmod 777 "$DATA"
as_postgres "$PGBIN/initdb -D $DATA/data -U postgres" >/dev/null 2>&1 || { cat "$DATA/log" 2>/dev/null | tail -5; skip "initdb failed — skipping."; }
as_postgres "$PGBIN/pg_ctl -D $DATA/data -o '-k $SOCK -p $PORT -c listen_addresses=' -l $DATA/log start" >/dev/null 2>&1
for _ in $(seq 1 20); do
  as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -c 'select 1'" >/dev/null 2>&1 && break
  sleep 1
done

as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -c 'create database moments'" >/dev/null 2>&1

# Supabase gives every project an auth schema; the files assume it.
cat > "$DATA/auth.sql" <<'SQL'
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key, email text, raw_user_meta_data jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;
create or replace function auth.jwt() returns jsonb language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create or replace function auth.email() returns text language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.email', true), '') $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon;           exception when duplicate_object then null; end $$;
do $$ begin create role service_role;   exception when duplicate_object then null; end $$;
-- Supabase ships this publication; the file adds tables to it.
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, created_at timestamptz default now(), metadata jsonb
);
-- Supabase's own helper, same signature: the path minus the filename.
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$
    select case when strpos(name, '/') = 0 then array[]::text[]
                else (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
           end $$;
create or replace function storage.filename(name text) returns text
  language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name,'/'),1)] $$;
SQL
chmod 644 "$DATA/auth.sql"
as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -q -f $DATA/auth.sql" >/dev/null 2>&1

cp supabase/*.sql "$DATA/" && chmod 644 "$DATA"/*.sql

# The base schema, oldest first, so RUN_ME has the tables it edits.
for f in schema.sql schema_v2_live.sql schema_v3_fix.sql schema_v4_broker.sql \
         schema_v5_groups.sql schema_v6_ads.sql schema_v7_music.sql schema_v8_mates.sql \
         schema_v9_engagement.sql schema_v10_destinations.sql schema_v11_notifications.sql \
         schema_v12_trips.sql schema_v13_engagement2.sql; do
  [ -f "$DATA/$f" ] && as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -q -f $DATA/$f" >/dev/null 2>&1
done

run_lenient () {   # keep going past errors, the way a database that has
                   # lived through several versions of this file got to
                   # where it is
  as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -q -v ON_ERROR_STOP=0 -f $DATA/RUN_ME.sql" 2>&1
}
run_strict () {
  as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -q -v ON_ERROR_STOP=1 -f $DATA/RUN_ME.sql" 2>&1
}

# Two lenient passes settle the database into the state a real one is in:
# everything the file can create, created. Ordering problems that only
# bite an empty database are a different bug and are not what this is
# looking for.
echo "── settling the database ──"
run_lenient >/dev/null 2>&1
run_lenient >/dev/null 2>&1
echo "done."

# THE ONE THAT MATTERS. Against a database this file has already been
# applied to, it must run start to finish without a single error —
# because on the real project, one error means everything below that
# line silently does not happen.
echo "── running it again, and this time nothing may fail ──"
OUT=$(run_strict); RC=$?
if [ $RC -ne 0 ]; then
  echo "$OUT" | grep -iE "ERROR" | head -5
  echo
  echo "RUN_ME.sql says it is safe to re-run, and is not."
  echo "Something early is being validated against what something later did."
  echo "Everything below the failing line never applies."
  exit 1
fi

echo "clean."
echo
echo "RUN_ME.sql applies to an already-set-up database with no error."
