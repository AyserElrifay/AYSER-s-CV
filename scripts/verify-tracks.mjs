/* Every song in the library, actually checked.

   Tracks come from public archives, and archives move things: a URL
   that worked the day it was imported can be a 404 a month later. The
   app then looks broken — you press play on a real song and nothing
   happens, which is worse than the song not being there at all.

   So we ask each one. A HEAD request per track, a handful at a time;
   anything that answers 404/410 (or refuses every time) is marked dead
   and stops being offered. Nothing is deleted — a dead link can come
   back, and the row still carries who made it and when.

   Usage: node scripts/verify-tracks.mjs
   Env:   SUPABASE_ACCESS_TOKEN (required), PROJECT_REF, LIMIT
*/

const REF = process.env.PROJECT_REF || 'dvddiyztpyyuultndzso';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const LIMIT = parseInt(process.env.LIMIT || '4000', 10);
const CONCURRENCY = 8;

if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch (e) { return []; }
}

/* Is this file actually there? A HEAD is enough and costs nothing;
   some hosts refuse HEAD, so a refusal falls back to a ranged GET of
   the first byte before we call anything dead. */
async function alive(url) {
  const once = async (method, headers) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, 12000);
    try {
      const r = await fetch(url, { method, headers, redirect: 'follow', signal: ctrl.signal });
      return r.status;
    } catch (e) { return 0; } finally { clearTimeout(timer); }
  };
  let code = await once('HEAD');
  if (code === 405 || code === 501 || code === 0) code = await once('GET', { Range: 'bytes=0-1' });
  if (code >= 200 && code < 400) return true;
  if (code === 404 || code === 410 || code === 403) return false;
  // anything else (429, 5xx, a timeout) is the archive having a bad day,
  // not proof the song is gone — leave it alone
  return null;
}

// the column only needs to exist once
await sql("alter table public.tracks add column if not exists dead boolean not null default false;");
await sql("alter table public.tracks add column if not exists checked_at timestamptz;");

const rows = await sql(`select id, title, audio_url from public.tracks
                        where audio_url is not null
                        order by coalesce(checked_at, '1970-01-01'::timestamptz) asc
                        limit ${LIMIT};`);
console.log(`checking ${rows.length} tracks`);

let dead = 0, ok = 0, unsure = 0, i = 0;
const deadIds = [], liveIds = [];

async function worker() {
  while (i < rows.length) {
    const row = rows[i++];
    const verdict = await alive(row.audio_url);
    if (verdict === true) { ok++; liveIds.push(row.id); }
    else if (verdict === false) { dead++; deadIds.push(row.id); console.log('dead:', row.title); }
    else unsure++;
    if ((ok + dead + unsure) % 100 === 0) console.log(`  …${ok + dead + unsure}/${rows.length}`);
    await sleep(60);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const chunk = (a, n) => a.length ? Array.from({ length: Math.ceil(a.length / n) }, (_, k) => a.slice(k * n, k * n + n)) : [];

for (const ids of chunk(deadIds, 200)) {
  await sql(`update public.tracks set dead = true, checked_at = now()
             where id in (${ids.map((x) => `'${x}'`).join(',')});`);
}
for (const ids of chunk(liveIds, 200)) {
  await sql(`update public.tracks set dead = false, checked_at = now()
             where id in (${ids.map((x) => `'${x}'`).join(',')});`);
}

const left = await sql('select count(*)::int as n from public.tracks where dead = false;');
console.log(`\nalive ${ok} · dead ${dead} · inconclusive ${unsure}`);
console.log('playable library now holds', (left && left[0] && left[0].n) || '?', 'tracks');
