/* Keep the film catalogue real and current.

   Runs on CI, same as the music importer, and writes into public.films
   through the Supabase Management API. The app then reads films from
   our own table — so no catalogue key ever ships in the browser and the
   app works even if an upstream API is down.

   We host no film and stream no film. A row here is a catalogue entry:
   a title, a poster, a synopsis, and the score the catalogue itself
   publishes. Where to actually watch it is a link to the service that
   legally carries it, which is the only lawful way to do this and also
   the only honest one.

   TWO SOURCES, and the first one needs no key at all:

     Apple's public iTunes Search API — open, no registration, and the
     artwork it returns is the artwork Apple publishes for linking to
     the store. This is what fills the shelf on a fresh install.

     TMDB — richer (backdrops, real audience scores, proper genres) but
     it needs a free key. If TMDB_KEY is set we pull that too and it
     wins on the titles it covers; if it isn't, the catalogue is still
     full rather than empty.

   Usage: node scripts/import-films.mjs
   Env:   SUPABASE_ACCESS_TOKEN (required)
          TMDB_KEY              (optional — themoviedb.org, free)
          PROJECT_REF, PAGES
*/

const REF = process.env.PROJECT_REF || 'dvddiyztpyyuultndzso';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const TMDB = process.env.TMDB_KEY || '';
const PAGES = parseInt(process.env.PAGES || '6', 10);
const IMG = 'https://image.tmdb.org/t/p';

/* Apple ids and TMDB ids share one column, so Apple's are pushed above
   any id TMDB will ever hand out. Nothing can collide. */
const APPLE_BASE = 1000000000000;

if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }

const esc = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''").slice(0, 2000) + "'";
const arr = (a) => !a || !a.length ? 'null'
  : "array[" + a.map((x) => esc(x)).join(',') + "]::text[]";
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

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

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Moments/1.0 (film catalogue)' } });
      if (r.ok) return await r.json();
      if (r.status === 429 || r.status >= 500) await sleep(2500);
    } catch (e) { /* retry */ }
    await sleep(700 * (i + 1));
  }
  return null;
}

const seen = new Set();
const rows = [];
const push = (row) => {
  if (!row || !row.id || seen.has(row.id) || !row.title) return;
  seen.add(row.id);
  rows.push(row);
};

/* ── APPLE · no key, works everywhere ─────────────────────────────── */

const hasArabic = (s) => /[؀-ۿ]/.test(String(s || ''));

/* What people here actually look for, in both stores. The Egyptian
   store first, because an Egyptian app whose film shelf is only
   Hollywood is somebody else's app. */
const APPLE_TERMS = [
  'فيلم', 'عادل امام', 'احمد حلمي', 'كوميدي', 'دراما', 'رومانسي', 'اكشن',
  'محمد رمضان', 'يسرا', 'منى زكي', 'احمد السقا', 'مصري', 'عربي',
  'comedy', 'drama', 'action', 'thriller', 'adventure', 'animation',
  'romance', 'horror', 'science fiction', 'family', 'crime', 'fantasy',
  'documentary', 'war', 'mystery', 'sport', 'music', 'history',
];
const APPLE_STORES = ['eg', 'us', 'gb', 'ae'];

/* Apple's genre names aren't the app's. "Action & Adventure" would
   never match the Action chip, so a shelf tap would come back empty
   from a catalogue that was actually full. Each Apple name carries its
   own label plus whatever the app calls the same thing. */
const APPLE_GENRE = {
  'Action & Adventure': ['Action', 'Adventure'],
  'Sci-Fi & Fantasy': ['Science Fiction', 'Fantasy'],
  'Kids & Family': ['Family', 'Animation'],
  'Comedy': ['Comedy'],
  'Drama': ['Drama'],
  'Romance': ['Romance'],
  'Horror': ['Horror'],
  'Thriller': ['Thriller'],
  'Documentary': ['Documentary'],
  'Animation': ['Animation'],
  'Classics': ['Classics'],
  'Independent': ['Independent'],
  'Foreign': ['Foreign'],
  'Music Documentaries': ['Music', 'Documentary'],
  'Music Videos': ['Music'],
  'Sports': ['Sport'],
  'Western': ['Western'],
  'Holiday': ['Family'],
  'Special Interest': [],
  'Made for TV': [],
};
const appleGenres = (name) => {
  if (!name) return [];
  const mapped = APPLE_GENRE[name];
  const out = mapped ? mapped.slice() : [name];
  if (mapped && !out.includes(name) && name !== 'Special Interest' && name !== 'Made for TV') out.push(name);
  return out;
};

async function fromApple() {
  for (const country of APPLE_STORES) {
    for (const term of APPLE_TERMS) {
      const url = 'https://itunes.apple.com/search?media=movie&entity=movie'
        + '&country=' + country
        + '&limit=' + Math.min(200, PAGES * 25)
        + '&term=' + encodeURIComponent(term);
      const j = await getJSON(url);
      const list = (j && j.results) || [];
      let rank = list.length;
      for (const m of list) {
        if (!m.trackId || !m.trackName) continue;
        // no adult titles, ever
        if (/adult|nc-17|x-rated/i.test(m.contentAdvisoryRating || '')) continue;
        const art = m.artworkUrl100 || m.artworkUrl60 || null;
        push({
          id: APPLE_BASE + Number(m.trackId),
          title: m.trackName,
          year: m.releaseDate ? parseInt(String(m.releaseDate).slice(0, 4), 10) : null,
          overview: m.longDescription || m.shortDescription || null,
          // Apple serves any size from the same path — ask for one worth looking at
          poster_url: art ? art.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/600x600bb.jpg') : null,
          backdrop_url: art ? art.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/1200x1200bb.jpg') : null,
          genres: appleGenres(m.primaryGenreName),
          rating: null,                       // Apple publishes no score — we invent none
          language: hasArabic(m.trackName) || country === 'eg' ? 'ar' : 'en',
          popularity: Math.round((rank / Math.max(1, list.length)) * 100) / 10,
        });
        rank -= 1;
      }
      console.log(`apple ${country} "${term}" → ${rows.length} collected`);
      await sleep(1200);                       // Apple throttles hard — go at its pace
    }
  }
}

/* ── TMDB · richer, when the key is there ─────────────────────────── */

async function tmdb(path, params = {}) {
  const q = new URLSearchParams({ api_key: TMDB, ...params }).toString();
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://api.themoviedb.org/3${path}?${q}`);
      if (r.ok) return await r.json();
      if (r.status === 429) await sleep(2500);
    } catch (e) { /* retry */ }
    await sleep(700 * (i + 1));
  }
  return null;
}

async function fromTmdb() {
  const genreMap = new Map();
  for (const lang of ['en-US', 'ar']) {
    const g = await tmdb('/genre/movie/list', { language: lang });
    ((g && g.genres) || []).forEach((x) => { if (!genreMap.has(x.id)) genreMap.set(x.id, x.name); });
  }

  const SOURCES = [
    ['/trending/movie/week', {}],
    ['/movie/popular', {}],
    ['/movie/top_rated', {}],
    ['/discover/movie', { with_original_language: 'ar', sort_by: 'popularity.desc' }],
    ['/discover/movie', { region: 'EG', sort_by: 'popularity.desc' }],
  ];

  for (const [path, params] of SOURCES) {
    for (let page = 1; page <= PAGES; page++) {
      const j = await tmdb(path, { ...params, page: String(page), language: 'en-US' });
      const results = (j && j.results) || [];
      if (!results.length) break;
      for (const m of results) {
        if (!m.id || !m.title || m.adult) continue;
        push({
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
      console.log(`tmdb ${path} p${page} → ${rows.length} collected`);
    }
  }
}

/* TMDB first when we have it, so its richer rows claim the titles they
   cover; Apple then fills everything TMDB didn't. */
if (TMDB) await fromTmdb();
else console.log('No TMDB_KEY — filling the catalogue from Apple alone (this works fine).');
await fromApple();

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
