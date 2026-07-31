/* Fill the music library with real recordings that are genuinely free.

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
   1920s 78s are a different matter and the year filter will let those
   through on their own if the Archive has them.

   Usage: node scripts/import-public-domain-music.mjs
   Needs:  SUPABASE_ACCESS_TOKEN, PROJECT_REF
*/

const REF = process.env.PROJECT_REF || 'dvddiyztpyyuultndzso';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const MAX_YEAR = 1928;

if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }

/* What to go looking for. Arabic and Egyptian material is first
   because it is what this app's people actually want to hear, and the
   Archive's 78rpm collections carry a real amount of it — Sayed
   Darwish, Salama Hijazi, early tarab, the Baidaphon and Odeon
   catalogues. */
const QUERIES = [
  { q: 'sayed darwish',   mood: 'Classics', emoji: '🇪🇬' },
  { q: 'egyptian',        mood: 'Classics', emoji: '🇪🇬' },
  { q: 'arabic',          mood: 'Classics', emoji: '🪕' },
  { q: 'oud',             mood: 'Classics', emoji: '🪕' },
  { q: 'baidaphon',       mood: 'Classics', emoji: '🪕' },
  { q: 'turkish',         mood: 'Classics', emoji: '🎻' },
  { q: 'happy birthday',  mood: 'Classics', emoji: '🎂' },
  { q: 'jazz',            mood: 'Classics', emoji: '🎺' },
  { q: 'tango',           mood: 'Classics', emoji: '💃' },
  { q: 'blues',           mood: 'Melancholic', emoji: '🎷' },
  { q: 'waltz',           mood: 'Dreamy',   emoji: '🎼' },
  { q: 'ragtime',         mood: 'Hype',     emoji: '🎹' },
  { q: 'march',           mood: 'Hype',     emoji: '🥁' },
  { q: 'opera',           mood: 'Warm',     emoji: '🎭' },
  { q: 'violin',          mood: 'Dreamy',   emoji: '🎻' },
  { q: 'piano',           mood: 'Chill',    emoji: '🎹' },
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
    } catch (e) { /* retry */ }
    await new Promise((s) => setTimeout(s, 800 * (i + 1)));
  }
  return null;
}

const have = new Set(
  (await sql(`select audio_url from public.tracks where audio_url is not null`) || [])
    .map((r) => r.audio_url));
console.log(`already in the library: ${have.size}`);

const rows = [];

for (const { q, mood, emoji } of QUERIES) {
  const search = `collection:(georgeblood OR 78rpm) AND mediatype:audio AND year:[1900 TO ${MAX_YEAR}] AND (${q})`;
  const res = await j('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(search) +
    '&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&rows=14&sort[]=downloads+desc&output=json');
  const docs = (res && res.response && res.response.docs) || [];
  let kept = 0;

  for (const d of docs) {
    const meta = await j('https://archive.org/metadata/' + encodeURIComponent(d.identifier));
    if (!meta) continue;
    const year = parseInt((meta.metadata && meta.metadata.year) || d.year || '0', 10);
    if (!year || year > MAX_YEAR) continue;              // the line we do not cross
    const file = (meta.files || []).find((f) => /\.mp3$/i.test(f.name || ''));
    if (!file) continue;
    const url = 'https://archive.org/download/' + d.identifier + '/' + encodeURIComponent(file.name);
    if (have.has(url)) continue;
    have.add(url);
    const artist = Array.isArray(d.creator) ? d.creator[0] : d.creator;
    rows.push({
      title: String(d.title || file.title || 'Untitled').slice(0, 80),
      artist: String(artist || 'Unknown').slice(0, 60),
      audio_url: url,
      cover_emoji: emoji,
      mood,
      license: 'Public Domain (' + year + ')',
      attribution: String(d.title || 'Recording') + ' · ' + year + ' · Internet Archive (Public Domain)',
      source_url: 'https://archive.org/details/' + d.identifier,
      duration_sec: file.length ? Math.round(parseFloat(file.length)) : null,
    });
    kept++;
  }
  console.log(`${q.padEnd(18)} → ${kept} kept of ${docs.length} found`);
}

if (!rows.length) { console.log('nothing new to add'); process.exit(0); }

/* uploader_id has to be a real profile. Look up the owner by email
   through auth.users rather than hardcoding a uuid that could change. */
const values = rows.map((r) => `(
  (select p.id from public.profiles p join auth.users u on u.id = p.id
   where lower(u.email) = 'ayseryourlifecoach@gmail.com' limit 1),
  true, true, ${esc(r.title)}, ${esc(r.artist)}, ${esc(r.audio_url)}, ${esc(r.cover_emoji)},
  ${esc(r.mood)}, ${esc(r.license)}, ${esc(r.attribution)}, ${esc(r.source_url)},
  ${r.duration_sec == null ? 'null' : r.duration_sec})`).join(',\n');

const out = await sql(`
insert into public.tracks
  (uploader_id, is_official, is_approved, title, artist, audio_url, cover_emoji,
   mood, license, attribution, source_url, duration_sec)
values
${values}
on conflict do nothing
returning id;`);

console.log(`inserted ${Array.isArray(out) ? out.length : 0} tracks`);
const total = await sql(`select count(*)::int as n from public.tracks`);
console.log('library now holds', (total && total[0] && total[0].n) || '?', 'tracks');
