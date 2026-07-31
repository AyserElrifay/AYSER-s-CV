/* Keep the film catalogue real and current.

   Runs on CI, same as the music importer, and writes into public.films
   through the Supabase Management API. The app then reads films from
   our own table — so the catalogue key never ships in the browser and
   the app works even if the upstream API is down.

   We host no film and stream no film. A row here is a catalogue entry:
   a title, a poster, a synopsis, and the score the catalogue itself
   publishes. Where to actually watch it is a link to the service that
   legally carries it, which is the only lawful way to do this and also
   the only honest one.

   Usage: node scripts/import-films.mjs
   Env:   SUPABASE_ACCESS_TOKEN (required)
          TMDB_KEY              (required — themoviedb.org, free)
          PROJECT_REF, PAGES
*/

const REF = process.env.PROJECT_REF || 'dvddiyztpyyuultndzso';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const TMDB = process.env.TMDB_KEY;
const PAGES = parseInt(process.env.PAGES || '6', 10);
const IMG = 'https://image.tmdb.org/t/p';

if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }
if (!TMDB) {
  console.error('TMDB_KEY missing — get a free key at themoviedb.org/settings/api');
  console.error('then add it as the TMDB_KEY repository secret.');
  process.exit(1);
}

const esc = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''").slice(0, 2000) + "'";
const arr = (a) => !a || !a.length ? 'null'
  : "array[" + a.map((x) => esc(x)).join(',') + "]::text[]";

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${t.slice(0, 400)}`);
  try { return JSON.parse(t); } catch (e) { return []; }
}

async function tmdb(path, params = {}) {
  const q = new URLSearchParams({ api_key: TMDB, ...params }).toString();
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://api.themoviedb.org/3${path}?${q}`);
      if (r.ok) return await r.json();
      if (r.status === 429) await new Promise((s) => setTimeout(s, 2500));
    } catch (e) { /* retry */ }
    await new Promise((s) => setTimeout(s, 700 * (i + 1)));
  }
  return null;
}

const genreMap = new Map();
for (const lang of ['en-US', 'ar']) {
  const g = await tmdb('/genre/movie/list', { language: lang });
  ((g && g.genres) || []).forEach((x) => { if (!genreMap.has(x.id)) genreMap.set(x.id, x.name); });
}

/* Trending worldwide, plus what's actually watched in Egypt and the
   region — a film list for this app should not be only Hollywood. */
const SOURCES = [
  ['/trending/movie/week', {}],
  ['/movie/popular', {}],
  ['/movie/top_rated', {}],
  ['/discover/movie', { with_original_language: 'ar', sort_by: 'popularity.desc' }],
  ['/discover/movie', { region: 'EG', sort_by: 'popularity.desc' }],
];

const seen = new Set();
const rows = [];

for (const [path, params] of SOURCES) {
  for (let page = 1; page <= PAGES; page++) {
    const j = await tmdb(path, { ...params, page: String(page), language: 'en-US' });
    const results = (j && j.results) || [];
    if (!results.length) break;
    for (const m of results) {
      if (!m.id || seen.has(m.id) || !m.title) continue;
      if (m.adult) continue;
      seen.add(m.id);
      rows.push({
        id: m.id,
        title: m.title,
        year: m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null,
        overview: m.overview || null,
        poster_url: m.poster_path ? IMG + '/w500' + m.poster_path : null,
        backdrop_url: m.backdrop_path ? IMG + '/w780' + m.backdrop_path : null,
        genres: (m.genre_ids || []).map((g) => genreMap.get(g)).filter(Boolean),
        rating: typeof m.vote_average === 'number' ? Math.round(m.vote_average * 10) / 10 : null,
        language: m.original_language || null,
        popularity: typeof m.popularity === 'number' ? Math.round(m.popularity * 100) / 100 : null,
      });
    }
    console.log(`${path} p${page} → ${rows.length} collected`);
  }
}

if (!rows.length) { console.log('nothing to write'); process.exit(0); }

let written = 0;
for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100);
  const values = chunk.map((r) => `(${r.id}, ${esc(r.title)}, ${r.year || 'null'}, ${esc(r.overview)},
    ${esc(r.poster_url)}, ${esc(r.backdrop_url)}, ${arr(r.genres)}, ${r.rating == null ? 'null' : r.rating},
    ${esc(r.language)}, ${r.popularity == null ? 'null' : r.popularity}, now())`).join(',');
  const out = await sql(`
    insert into public.films
      (id, title, year, overview, poster_url, backdrop_url, genres, rating, language, popularity, updated_at)
    values ${values}
    on conflict (id) do update set
      title = excluded.title, year = excluded.year, overview = excluded.overview,
      poster_url = excluded.poster_url, backdrop_url = excluded.backdrop_url,
      genres = excluded.genres, rating = excluded.rating,
      popularity = excluded.popularity, updated_at = now()
    returning id;`);
  written += Array.isArray(out) ? out.length : 0;
}

const total = await sql('select count(*)::int as n from public.films');
console.log(`\nwrote ${written} films`);
console.log('catalogue now holds', (total && total[0] && total[0].n) || '?', 'films');
