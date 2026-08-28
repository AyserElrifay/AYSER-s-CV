#!/usr/bin/env bash
# ─── A PRIVATE GROUP HAS TO ACTUALLY BE PRIVATE ──────────────────────
#
# A group's wall is where somebody says something to their people and
# not to everybody. That promise is kept by row-level security, and a
# policy that reads correctly and behaves differently is the only kind
# of bug that matters here — nobody would ever see it, which is exactly
# what makes it bad.
#
# So this builds a real PostgreSQL from the real files, then acts as
# four different people — an owner, an admin, a member and a stranger —
# and checks what each of them can and cannot do. Every assertion in
# supabase/checks/group_rules.sql prints PASS or FAIL, and one FAIL
# fails the build.
#
#     bash scripts/check-group-rules.sh
#
# Needs a local PostgreSQL 16. Skips (0) if there isn't one — and, like
# its sibling, a skip is a FAILURE when SQL_CHECK_REQUIRED=1, because a
# check that quietly cannot run is not a check.
set -uo pipefail

skip () {
  echo "$1"
  if [ "${SQL_CHECK_REQUIRED:-}" = "1" ]; then
    echo
    echo "This build requires the group rules to be really checked, and they were not."
    exit 1
  fi
  exit 0
}

PGBIN=/usr/lib/postgresql/16/bin
[ -x "$PGBIN/initdb" ] || skip "No local PostgreSQL 16 at $PGBIN — skipping."

if [ "$(id -u)" = "0" ]; then
  as_postgres () { su postgres -c "$1"; }
elif sudo -n true >/dev/null 2>&1; then
  as_postgres () { sudo -n -u postgres bash -c "$1"; }
else
  skip "Cannot become the postgres user here (no root, no passwordless sudo) — skipping."
fi

DATA=/var/tmp/moments-group-rules
SOCK=/var/tmp
PORT=55434

cleanup() { as_postgres "$PGBIN/pg_ctl -D $DATA/data stop -m immediate" >/dev/null 2>&1 || true; }
trap cleanup EXIT

rm -rf "$DATA"; mkdir -p "$DATA"; chmod 777 "$DATA"
as_postgres "$PGBIN/initdb -D $DATA/data -U postgres" >/dev/null 2>&1 || skip "initdb failed — skipping."
as_postgres "$PGBIN/pg_ctl -D $DATA/data -o '-k $SOCK -p $PORT -c listen_addresses=' -l $DATA/log start" >/dev/null 2>&1
for _ in $(seq 1 20); do
  as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -c 'select 1'" >/dev/null 2>&1 && break
  sleep 1
done
as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -c 'create database moments'" >/dev/null 2>&1

# The same Supabase stand-ins its sibling uses, lifted from that file so
# there is one copy of them and not two that drift apart.
sed -n '/^cat > "\$DATA\/auth.sql" <<.SQL.$/,/^SQL$/p' scripts/check-sql-twice.sh | sed '1d;$d' > "$DATA/auth.sql"
[ -s "$DATA/auth.sql" ] || skip "Could not lift the auth stand-ins out of check-sql-twice.sh — skipping."
chmod 644 "$DATA/auth.sql"
as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -q -f $DATA/auth.sql" >/dev/null 2>&1

cp supabase/*.sql "$DATA/" && chmod 644 "$DATA"/*.sql
for f in schema.sql schema_v2_live.sql schema_v3_fix.sql schema_v4_broker.sql \
         schema_v5_groups.sql schema_v6_ads.sql schema_v7_music.sql schema_v8_mates.sql \
         schema_v9_engagement.sql schema_v10_destinations.sql schema_v11_notifications.sql \
         schema_v12_trips.sql schema_v13_engagement2.sql; do
  [ -f "$DATA/$f" ] && as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -q -v ON_ERROR_STOP=0 -f $DATA/$f" >/dev/null 2>&1
done
as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -q -v ON_ERROR_STOP=0 -f $DATA/RUN_ME.sql" >/dev/null 2>&1
as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -q -v ON_ERROR_STOP=0 -f $DATA/RUN_ME.sql" >/dev/null 2>&1

cp supabase/checks/group_rules.sql "$DATA/rules.sql"; chmod 644 "$DATA/rules.sql"
OUT=$(as_postgres "$PGBIN/psql -h $SOCK -p $PORT -U postgres -d moments -X -q -v ON_ERROR_STOP=0 -f $DATA/rules.sql" 2>&1)
echo "$OUT"

# A run that produced no PASS at all did not test anything.
if ! echo "$OUT" | grep -q "PASS"; then
  echo
  echo "The group rules check ran and asserted nothing. Treating that as a failure."
  exit 1
fi
if echo "$OUT" | grep -q "FAIL"; then
  echo
  echo "A group rule does not hold. Somebody can see or do something they should not."
  exit 1
fi
echo
echo "Every group rule holds: a stranger cannot read a private wall, and an owner cannot be removed."
