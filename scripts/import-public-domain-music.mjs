/* Fill the music library with real recordings that are genuinely free,
   and keep filling it.

   Runs on a CI runner (which has the open internet the app's sandbox
   does not) and writes straight to Postgres through the Supabase
   Management API, so nobody has to sit in the app pressing a button.

   THE RULE, and it is not negotiable:
     a recording goes in only if it was published in 1928 or earlier.
   Copyright in a sound recording plus the composition behind it can
   run a very long time, and a licence field in someone's metadata is
   not evidence. The publication year is, and 1928 is early enough that
   both the recording and the work behind it have lapsed essentially
   everywhere.

   That is why Umm Kulthum's famous recordings are NOT here: those are
   1940s-1960s Sono Cairo masters and they are somebody's property. Her
   1920s 78s are a different matter and the year filter lets those
   through on their own.

   Usage:  node scripts/import-public-domain-music.mjs
   Env:    SUPABASE_ACCESS_TOKEN   (required)
           PROJECT_REF             (default: the Moments project)
           TARGET                  how many NEW tracks to add (default 1000)
*/

const REF = process.env.PROJECT_REF || 'dvddiyztpyyuultndzso';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const TARGET = parseInt(process.env.TARGET || '1000', 10);
const MAX_YEAR = 1928;
const CONCURRENCY = 8;        // polite: the Archive is a charity, not a CDN
const PAGE_ROWS = 100;

if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }

/* What to go looking for.

   Arabic and Egyptian material leads, because it is what this app's
   people want to hear and the Archive's 78rpm collections carry a real
   amount of it. Then the records everyone half-knows even if they
   cannot name them: Caruso, Gardel's tangos, the ragtime and swing
   that everything since is built on. */
const QUERIES = [
  // ── Arabic / Egyptian / regional ──
  ['egyptian',            'Classics',    '🇪🇬'],
  ['arabic',              'Classics',    '🪕'],
  ['sayed darwish',       'Classics',    '🇪🇬'],
  ['salama hijazi',       'Classics',    '🇪🇬'],
  ['munira',              'Classics',    '🇪🇬'],
  ['abdel hay',           'Classics',    '🇪🇬'],
  ['oud',                 'Classics',    '🪕'],
  ['baidaphon',           'Classics',    '🪕'],
  ['odeon arabic',        'Classics',    '🪕'],
  ['cairo',               'Classics',    '🇪🇬'],
  ['syrian',              'Classics',    '🪕'],
  ['lebanese',            'Classics',    '🪕'],
  ['turkish',             'Classics',    '🎻'],
  ['persian',             'Classics',    '🪕'],
  ['greek',               'Classics',    '🎻'],
  ['armenian',            'Classics',    '🎻'],
  ['jewish',              'Classics',    '🎻'],
  ['andalusian',          'Classics',    '🪕'],
  // ── the records everyone half-knows ──
  ['caruso',              'Warm',        '🎭'],
  ['gardel',              'Melancholic', '💃'],
  ['tango',               'Melancholic', '💃'],
  ['ragtime',             'Hype',        '🎹'],
  ['scott joplin',        'Hype',        '🎹'],
  ['dixieland',           'Hype',        '🎺'],
  ['louis armstrong',     'Hype',        '🎺'],
  ['bessie smith',        'Melancholic', '🎷'],
  ['jelly roll',          'Hype',        '🎹'],
  ['charleston',          'Hype',        '🕺'],
  ['foxtrot',             'Hype',        '🕺'],
  ['jazz',                'Hype',        '🎺'],
  ['blues',               'Melancholic', '🎷'],
  ['swing',               'Hype',        '🎺'],
  ['happy birthday',      'Classics',    '🎂'],
  // ── strings, keys, voices ──
  ['waltz',               'Dreamy',      '🎼'],
  ['violin',              'Dreamy',      '🎻'],
  ['piano',               'Chill',       '🎹'],
  ['cello',               'Dreamy',      '🎻'],
  ['guitar',              'Chill',       '🎸'],
  ['mandolin',            'Chill',       '🪕'],
  ['accordion',           'Warm',        '🪗'],
  ['harp',                'Dreamy',      '🎼'],
  ['organ',               'Dreamy',      '🎹'],
  ['banjo',               'Hype',        '🪕'],
  ['clarinet',            'Warm',        '🎷'],
  ['trumpet',             'Hype',        '🎺'],
  // ── forms ──
  ['opera',               'Warm',        '🎭'],
  ['aria',                'Warm',        '🎭'],
  ['symphony',            'Dreamy',      '🎼'],
  ['sonata',              'Chill',       '🎼'],
  ['nocturne',            'Dreamy',      '🌙'],
  ['serenade',            'Warm',        '🎻'],
  ['lullaby',             'Dreamy',      '🌙'],
  ['march',               'Hype',        '🥁'],
  ['polka',               'Hype',        '🪗'],
  ['folk',                'Warm',        '🪕'],
  ['hymn',                'Warm',        '🎼'],
  ['chanson',             'Warm',        '🇫🇷'],
  ['flamenco',            'Hype',        '💃'],
  ['spanish',             'Warm',        '🇪🇸'],
  ['italian',             'Warm',        '🇮🇹'],
  ['russian',             'Melancholic', '🎻'],
  ['irish',               'Warm',        '🪕'],
  ['hawaiian',            'Chill',       '🌺'],
];

const esc = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''").slice(0, 300) + "'";

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch (e) { return []; }
}

async function j(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'moments-music-import' } });
      if (r.ok) return await r.json();
      if (r.status === 429) await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
    } catch (e) { /* retry */ }
    await new Promise((s) => setTimeout(s, 600 * (i + 1)));
  }
  return null;
}

/* Run a list of jobs a few at a time. Sequential was the reason 128
   tracks took four minutes; a thousand would have taken half an hour. */
async function pool(items, worker, size = CONCURRENCY) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { const r = await worker(items[idx]); if (r) out.push(r); } catch (e) { /* skip one, keep going */ }
    }
  }));
  return out;
}

const have = new Set(
  (await sql(`select audio_url from public.tracks where audio_url is not null`) || [])
    .map((r) => r.audio_url));
console.log(`already in the library: ${have.size}`);
console.log(`target: ${TARGET} new tracks\n`);

const OWNER = `(select p.id from public.profiles p join auth.users u on u.id = p.id
   where lower(u.email) = 'ayseryourlifecoach@gmail.com' limit 1)`;

let added = 0;
let pending = [];

async function flush() {
  if (!pending.length) return;
  // chunked so a single statement never gets unwieldy
  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const values = chunk.map((r) => `(${OWNER}, true, true, ${esc(r.title)}, ${esc(r.artist)},
      ${esc(r.audio_url)}, ${esc(r.cover_emoji)}, ${esc(r.mood)}, ${esc(r.license)},
      ${esc(r.attribution)}, ${esc(r.source_url)}, ${r.duration_sec == null ? 'null' : r.duration_sec})`).join(',');
    const res = await sql(`
      insert into public.tracks
        (uploader_id, is_official, is_approved, title, artist, audio_url, cover_emoji,
         mood, license, attribution, source_url, duration_sec)
      values ${values}
      on conflict do nothing
      returning id;`);
    added += Array.isArray(res) ? res.length : 0;
  }
  pending = [];
}

outer:
for (const [q, mood, emoji] of QUERIES) {
  for (let page = 1; page <= 4; page++) {                 // up to 400 candidates per query
    if (added + pending.length >= TARGET) break outer;

    const search = `collection:(georgeblood OR 78rpm) AND mediatype:audio AND year:[1900 TO ${MAX_YEAR}] AND (${q})`;
    const res = await j('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(search) +
      `&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&rows=${PAGE_ROWS}&page=${page}` +
      '&sort[]=downloads+desc&output=json');
    const docs = (res && res.response && res.response.docs) || [];
    if (!docs.length) break;                              // no more pages for this query

    const got = await pool(docs, async (d) => {
      const meta = await j('https://archive.org/metadata/' + encodeURIComponent(d.identifier));
      if (!meta) return null;
      const year = parseInt((meta.metadata && meta.metadata.year) || d.year || '0', 10);
      if (!year || year > MAX_YEAR) return null;          // the line we do not cross
      const file = (meta.files || []).find((f) => /\.mp3$/i.test(f.name || ''));
      if (!file) return null;
      const url = 'https://archive.org/download/' + d.identifier + '/' + encodeURIComponent(file.name);
      if (have.has(url)) return null;
      have.add(url);
      const artist = Array.isArray(d.creator) ? d.creator[0] : d.creator;
      return {
        title: String(d.title || file.title || 'Untitled').slice(0, 80),
        artist: String(artist || 'Unknown').slice(0, 60),
        audio_url: url,
        cover_emoji: emoji,
        mood,
        license: 'Public Domain (' + year + ')',
        attribution: String(d.title || 'Recording') + ' · ' + year + ' · Internet Archive (Public Domain)',
        source_url: 'https://archive.org/details/' + d.identifier,
        duration_sec: file.length ? Math.round(parseFloat(file.length)) : null,
      };
    });

    pending.push(...got);
    console.log(`${q.padEnd(18)} p${page}  +${got.length}  (queued ${pending.length}, added ${added})`);
    if (pending.length >= 200) await flush();
    if (docs.length < PAGE_ROWS) break;                   // that was the last page
  }
}

await flush();

const total = await sql(`select count(*)::int as n from public.tracks`);
console.log(`\nadded ${added} new tracks`);
console.log('library now holds', (total && total[0] && total[0].n) || '?', 'tracks');
