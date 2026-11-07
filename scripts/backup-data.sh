#!/usr/bin/env bash
# ─── THE DATA, KEPT SOMEWHERE ELSE (weekly) ──────────────────────────
# Ayser, November 2026: "ابعتلي فايل كامل … عشان لو حصلت حاجة". The code
# lives in git; this keeps what people made — accounts, posts, bookings,
# chats, the Studio's settings. The free Supabase plan keeps no backups.
#
# Writes one file, restore.sql: for every table in `public`, its rows as
# JSON inside an INSERT, so the whole thing goes back with one run (after
# supabase/RUN_ME.sql has built the empty tables):
#     insert into public.x select * from json_populate_recordset(null::public.x, $mmbk$[…]$mmbk$) on conflict do nothing;
# Accounts (auth.users) are kept WITHOUT their passwords: after a restore
# everybody signs in with "forgot password" — a password hash is not
# something to carry around in a backup file.
#
# Usage: backup-data.sh OUT_DIR
#   SQL_RUNNER=api   (default) Supabase Management API: SUPABASE_ACCESS_TOKEN + REF
#   SQL_RUNNER=psql  a local database: PSQL="psql -h … -d …" (for testing)
set -euo pipefail
OUT="${1:?out dir}"
mkdir -p "$OUT"
SQL_RUNNER="${SQL_RUNNER:-api}"
PAGE=2000

# run one query whose single column is JSON; print that JSON
q() {
  if [ "$SQL_RUNNER" = psql ]; then
    $PSQL -tAq -c "$1"
  else
    local code
    jq -Rs '{query: .}' <<<"$1" > "$OUT/.q.json"
    for i in 1 2 3; do
      code=$(curl -sS -o "$OUT/.r.json" -w '%{http_code}' -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary @"$OUT/.q.json") || code=000
      [ "$code" = 200 ] || [ "$code" = 201 ] && break
      sleep $((i * 5))
    done
    if [ "$code" != 200 ] && [ "$code" != 201 ]; then echo "query failed (HTTP $code):" >&2; head -c 600 "$OUT/.r.json" >&2; echo >&2; exit 1; fi
    jq -c '.[0].j' "$OUT/.r.json"
  fi
}

R="$OUT/restore.sql"
{
  echo "-- Moments data backup, $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "-- Restore: build the tables first (supabase/RUN_ME.sql), then run this whole file in the SQL editor."
  echo "set session_replication_role = replica;   -- no triggers while the rows go back"
} > "$R"

dump() {   # dump SCHEMA.TABLE [column list]
  local t="$1" cols="${2:-*}" off=0 n total=0 page
  while :; do
    page=$(q "select coalesce(json_agg(x), '[]'::json) as j from (select $cols from $t order by ctid limit $PAGE offset $off) x")
    n=$(jq 'length' <<<"$page")
    [ "$n" -gt 0 ] || break
    case "$page" in *'$mmbk$'*) echo "a row in $t contains the quote tag — stopping" >&2; exit 1;; esac
    if [ "$cols" = "*" ]; then
      printf 'insert into %s select * from json_populate_recordset(null::%s, $mmbk$%s$mmbk$) on conflict do nothing;\n' "$t" "$t" "$page" >> "$R"
    else
      printf 'insert into %s (%s) select %s from json_populate_recordset(null::%s, $mmbk$%s$mmbk$) on conflict do nothing;\n' "$t" "$cols" "$cols" "$t" "$page" >> "$R"
    fi
    total=$((total + n)); off=$((off + PAGE))
    [ "$n" -eq "$PAGE" ] || break
  done
  printf '%-40s %s\n' "$t" "$total" >> "$OUT/counts.txt"
}

: > "$OUT/counts.txt"
# accounts first (everything else points at them), without passwords
want="'id','aud','role','email','phone','email_confirmed_at','phone_confirmed_at','raw_app_meta_data','raw_user_meta_data','created_at','updated_at','is_anonymous'"
ucols=$(q "select coalesce(json_agg(column_name order by ordinal_position), '[]'::json) as j from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name in ($want)" | jq -r 'join(", ")')
[ -n "$ucols" ] && dump auth.users "$ucols"
for t in $(q "select coalesce(json_agg(table_name order by table_name), '[]'::json) as j from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'" | jq -r '.[]'); do
  dump "public.\"$t\""
done
echo "set session_replication_role = origin;" >> "$R"
rm -f "$OUT/.q.json" "$OUT/.r.json"
echo "tables: $(wc -l < "$OUT/counts.txt")  rows: $(awk '{s+=$2} END {print s}' "$OUT/counts.txt")  size: $(du -h "$R" | cut -f1)"
