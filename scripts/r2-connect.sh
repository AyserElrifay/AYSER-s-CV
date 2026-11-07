#!/usr/bin/env bash
# ─── CONNECT CLOUDFLARE R2 (run by setup-backend.yml) ────────────────
# Ayser, November 2026: "stop Supabase bandwidth drain". With the R2
# repository secrets present this:
#   1. finds the media bucket (R2_BUCKET, or the only/likeliest bucket on
#      the account — bucket names are not secret);
#   2. gives the r2-presign function its keys;
#   3. lets the site PUT to the bucket and read it (bucket CORS);
#   4. checks the whole road: a file in, read back from R2_PUBLIC_URL,
#      with the one-year immutable Cache-Control;
#   5. tells the database the public address (app_settings
#      'r2_public_url' — green_set_photo accepts it);
#   6. moves the Studio's highlight videos and posters (app_highlights)
#      out of Supabase Storage, the biggest egress, onto R2. The Supabase
#      copies are left where they are; only the addresses change, and only
#      after the R2 copy is read back.
# Needs: REF, SUPABASE_ACCESS_TOKEN, SITE_ORIGIN, R2_* (env); aws CLI.
set -uo pipefail
IMM='public, max-age=31536000, immutable'
if [ -z "${R2_ACCOUNT_ID:-}" ] || [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ]; then
  echo "R2 not connected yet — add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (and R2_PUBLIC_URL) as repository secrets."
  exit 0
fi
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto AWS_EC2_METADATA_DISABLED=true
EP="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
PUB="${R2_PUBLIC_URL%/}"
s3() { aws --endpoint-url "$EP" "$@"; }

sql() {   # one statement through the Management API; prints the JSON rows
  jq -Rs '{query: .}' <<<"$1" > /tmp/r2q.json
  local code
  code=$(curl -sS -o /tmp/r2q.out -w '%{http_code}' -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary @/tmp/r2q.json) || code=000
  if [ "$code" != 200 ] && [ "$code" != 201 ]; then echo "::warning::query failed (HTTP $code)"; head -c 400 /tmp/r2q.out; echo; return 1; fi
  cat /tmp/r2q.out
}

# 1 · the bucket
B="${R2_BUCKET:-}"
if [ -z "$B" ]; then
  names=$(s3 s3api list-buckets --query 'Buckets[].Name' --output text 2>/tmp/r2err.txt | tr '\t' '\n' | sed '/^$/d' || true)
  if [ -n "$names" ]; then
    echo "R2 buckets on the account: $(echo "$names" | tr '\n' ' ')"
    keep=$(echo "$names" | grep -vi 'ephemeral\|once\|private' || true)
    if [ "$(echo "$keep" | sed '/^$/d' | wc -l)" = 1 ]; then B="$keep"
    else B=$(echo "$keep" | grep -i 'media' | head -1); [ -n "$B" ] || B=$(echo "$keep" | head -1); fi
  else
    echo "::warning::Could not list the R2 buckets (the key may be limited to one bucket) — add R2_BUCKET (the bucket's name) as a repository secret."
    head -c 300 /tmp/r2err.txt; echo
  fi
fi
if [ -z "$B" ]; then echo "::error::No R2 bucket to use — add R2_BUCKET as a repository secret."; exit 1; fi
echo "R2 media bucket: $B"

# 2 · the function's keys
supabase secrets set --project-ref "$REF" \
  R2_ACCOUNT_ID="$R2_ACCOUNT_ID" R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  R2_BUCKET="$B" R2_EPHEMERAL_BUCKET="${R2_EPHEMERAL_BUCKET:-moments-ephemeral}" R2_PUBLIC_URL="$PUB" >/dev/null
echo "R2 keys set for r2-presign."

# 3 · the site may upload to it and read it
cat > /tmp/cors.json <<JSON
{"CORSRules":[{"AllowedOrigins":["$SITE_ORIGIN"],"AllowedMethods":["GET","HEAD","PUT"],"AllowedHeaders":["content-type","cache-control"],"ExposeHeaders":["etag","content-length","content-range","accept-ranges"],"MaxAgeSeconds":86400}]}
JSON
if s3 s3api put-bucket-cors --bucket "$B" --cors-configuration file:///tmp/cors.json 2>/tmp/r2err.txt; then echo "Bucket CORS set for $SITE_ORIGIN."
else echo "::warning::Could not set the bucket's CORS (the key needs Admin Read & Write) — uploads from the site will fail until it is set in Cloudflare → R2 → $B → Settings → CORS."; head -c 300 /tmp/r2err.txt; echo; fi

# 4 · the whole road, once
OK_ROAD=0
if [ -z "$PUB" ]; then echo "::warning::R2_PUBLIC_URL is empty — the bucket has no public address for the app to show files from."
else
  echo "moments $(date -u +%FT%TZ)" > /tmp/ping.txt
  if s3 s3 cp /tmp/ping.txt "s3://$B/__health/ping.txt" --content-type text/plain --cache-control "$IMM" --only-show-errors; then
    hdr=$(curl -sS -D - -o /dev/null -H "Origin: $SITE_ORIGIN" "$PUB/__health/ping.txt?t=$(date +%s)" | tr -d '\r')
    st=$(echo "$hdr" | head -1)
    echo "public read: $st"
    echo "$hdr" | grep -i '^cache-control:' || true
    echo "$hdr" | grep -i '^access-control-allow-origin:' || echo "(no allow-origin yet — CORS may take a minute)"
    echo "$st" | grep -q ' 200' && OK_ROAD=1 || echo "::warning::$PUB does not serve the bucket — check R2 → $B → Settings → Public access (r2.dev or a custom domain) matches R2_PUBLIC_URL."
  else echo "::warning::Could not write to the bucket $B with these keys."; fi
fi

# 5 · the database learns the address (plan photos may live there)
if [ "$OK_ROAD" = 1 ]; then
  sql "insert into public.app_settings (key, value) values ('r2_public_url', to_jsonb('$PUB'::text)) on conflict (key) do update set value = excluded.value, updated_at = now()" >/dev/null && echo "app_settings.r2_public_url = $PUB"
fi

# 6 · the highlights leave Supabase Storage
if [ "$OK_ROAD" = 1 ]; then
  rows=$(sql "select coalesce(json_agg(json_build_object('id', id, 'm', media_url, 'p', poster_url)), '[]'::json) as j from public.app_highlights where media_url like 'https://%.supabase.co/storage/v1/object/public/%' or poster_url like 'https://%.supabase.co/storage/v1/object/public/%'" | jq -c '.[0].j // []') || rows='[]'
  echo "highlights still on Supabase: $(jq length <<<"$rows")"
  move() {   # Supabase public url → R2 url (printed), or nothing
    local u="$1" path key f ct
    [[ "$u" =~ ^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/([A-Za-z0-9._/-]+)$ ]] || return 1
    path="${BASH_REMATCH[1]}"; key="highlights/$path"; f=/tmp/hl.bin
    case "${path,,}" in *.mp4) ct=video/mp4;; *.webm) ct=video/webm;; *.mov) ct=video/quicktime;; *.webp) ct=image/webp;; *.png) ct=image/png;; *.jpg|*.jpeg) ct=image/jpeg;; *) ct=application/octet-stream;; esac
    curl -sSfL -o "$f" "$u" || return 1
    s3 s3 cp "$f" "s3://$B/$key" --content-type "$ct" --cache-control "$IMM" --only-show-errors || return 1
    [ "$(curl -sS -o /dev/null -w '%{http_code}' -r 0-0 "$PUB/$key")" = 206 ] || [ "$(curl -sS -o /dev/null -w '%{http_code}' "$PUB/$key")" = 200 ] || return 1
    echo "$PUB/$key"
  }
  n=0
  for row in $(jq -c '.[]' <<<"$rows"); do
    id=$(jq -r .id <<<"$row"); m=$(jq -r '.m // ""' <<<"$row"); p=$(jq -r '.p // ""' <<<"$row")
    [[ "$id" =~ ^[0-9a-f-]{36}$ ]] || continue
    nm="$m"; np="$p"
    if [[ "$m" == *.supabase.co/storage/* ]]; then nm=$(move "$m") || nm="$m"; fi
    if [[ "$p" == *.supabase.co/storage/* ]]; then np=$(move "$p") || np="$p"; fi
    if [ "$nm" != "$m" ] || [ "$np" != "$p" ]; then
      sql "update public.app_highlights set media_url = \$u\$$nm\$u\$, poster_url = nullif(\$u\$$np\$u\$, '') where id = '$id'" >/dev/null && n=$((n + 1))
    fi
  done
  echo "highlights moved to R2: $n"
fi
