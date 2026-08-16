/* ─── A PICTURE, AND A QUESTION ABOUT IT ─────────────────────────────
   Some questions are better looked at than read. "What animal's body
   does the Sphinx have?" is a fine question; the Sphinx sitting there
   while you answer it is a better one.

   So this finds real photographs for the لمّة Egypt pack, copies them
   into the app's own storage, and points the questions at them.

   ── THE RULE, AND IT IS NOT NEGOTIABLE ───────────────────────────
   A photograph goes in only if Wikimedia Commons says, in its own
   metadata, that it is PUBLIC DOMAIN or CC0 — and the script reads
   that field itself rather than trusting a search result. Anything
   under any other licence is skipped and named in the log, however
   good it looks. This is the same line the music library draws, and
   for the same reason: a picture nobody can prove we may use is a
   legal problem waiting for the app to become popular enough to
   notice.

   Pre-1929 photographs are preferred where they exist, because a
   photograph that old is out of copyright everywhere by age rather
   than by anybody's say-so — and because the Sphinx in 1900 looks
   wonderful.

   ── WHY IT COPIES RATHER THAN LINKS ──────────────────────────────
   Hotlinking somebody else's servers for every question of every game
   is rude and slow. The bytes are copied once into the app's own
   media bucket, and the questions point there.

   ── AND IT RUNS ON THE RUNNER ────────────────────────────────────
   The app's own sandbox has no route to Commons. The CI runner does,
   which is where the music library is filled from too.

   Usage:  node scripts/import-egypt-photos.mjs
   Env:    SUPABASE_ACCESS_TOKEN   (required)
           PROJECT_REF             (default: the Moments project)
           DRY_RUN=1               look and report, write nothing
*/

const REF = process.env.PROJECT_REF || 'dvddiyztpyyuultndzso';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DRY = process.env.DRY_RUN === '1';
const PACK = 'eeee5555-0000-4000-8000-000000000001';

if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }

/* Which question gets a picture, and what the picture is of. Only
   questions a photograph genuinely helps: the ones about a thing you
   can see. The Lighthouse of Alexandria is not on the list, because
   nobody has a photograph of it. */
const WANTED = [
  { index: 0,  what: 'the pyramids',    search: 'Pyramids of Giza photograph' },
  { index: 6,  what: 'the Sphinx',      search: 'Great Sphinx of Giza' },
  { index: 8,  what: 'the Rosetta Stone', search: 'Rosetta Stone British Museum' },
  { index: 9,  what: 'the Suez Canal',  search: 'Suez Canal ship' },
  { index: 15, what: 'papyrus',         search: 'Papyrus Book of the Dead' },
  { index: 17, what: 'the Aswan dam',   search: 'Aswan High Dam' },
  { index: 18, what: 'Abu Simbel',      search: 'Abu Simbel temple' },
  { index: 34, what: 'the Nile delta',  search: 'Nile delta satellite NASA' },
];

const API = 'https://commons.wikimedia.org/w/api.php';

const get = async (url, opts) => {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(r.status + ' ' + url.slice(0, 90));
  return r;
};

/* Commons' own words about a file. Everything below is decided from
   this and nothing else. */
async function candidates(search) {
  const u = API + '?action=query&format=json&origin=*'
    + '&generator=search&gsrnamespace=6&gsrlimit=14'
    + '&gsrsearch=' + encodeURIComponent(search)
    + '&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1000';
  const j = await (await get(u, { headers: { 'User-Agent': 'Moments/1.0 (quiz images; contact via repository)' } })).json();
  const pages = (j.query && j.query.pages) || {};
  return Object.values(pages).map((p) => {
    const ii = (p.imageinfo && p.imageinfo[0]) || {};
    const m = ii.extmetadata || {};
    const val = (k) => (m[k] && typeof m[k].value === 'string' ? m[k].value.replace(/<[^>]*>/g, '').trim() : '');
    return {
      title: p.title,
      mime: ii.mime || '',
      thumb: ii.thumburl || '',
      licence: val('LicenseShortName') || val('UsageTerms'),
      licenceId: (val('License') || '').toLowerCase(),
      copyrighted: val('Copyrighted'),
      author: val('Artist') || val('Credit') || 'unknown',
      date: val('DateTimeOriginal') || val('DateTime') || '',
    };
  });
}

const yearOf = (s) => {
  const m = String(s || '').match(/\b(1[6-9]\d\d|20\d\d)\b/);
  return m ? parseInt(m[1], 10) : null;
};

/* Public domain or CC0, said by Commons itself. Everything else — CC BY,
   CC BY-SA, "fair use", no licence at all — is a no. */
function isFree(c) {
  if (!/^image\/(jpeg|png)$/.test(c.mime)) return false;
  const id = c.licenceId;
  const name = (c.licence || '').toLowerCase();
  const pd = id === 'pd' || id === 'cc0' || id.startsWith('pd-')
    || /^public domain/.test(name) || /^cc0/.test(name)
    || (c.copyrighted || '').toLowerCase() === 'false';
  return !!pd;
}

const score = (c) => {
  const y = yearOf(c.date);
  // out of copyright by age beats out of copyright by declaration
  if (y && y <= 1928) return 0;
  if (/nasa|usgov/i.test(c.licence + ' ' + c.licenceId + ' ' + c.author)) return 1;
  return 2;
};

async function serviceKey() {
  const r = await get('https://api.supabase.com/v1/projects/' + REF + '/api-keys?reveal=true', {
    headers: { Authorization: 'Bearer ' + TOKEN },
  });
  const keys = await r.json();
  const k = (keys || []).find((x) => x.name === 'service_role');
  if (!k || !k.api_key) throw new Error('no service_role key returned');
  return k.api_key;
}

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error('SQL ' + r.status + ': ' + body.slice(0, 300));
  return body;
}

async function upload(key, path, bytes) {
  const r = await fetch('https://' + REF + '.supabase.co/storage/v1/object/' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      apikey: key,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: bytes,
  });
  if (!r.ok) throw new Error('upload ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

(async () => {
  console.log(DRY ? '── looking only, writing nothing ──\n' : '── finding pictures for the Egypt pack ──\n');
  const key = DRY ? null : await serviceKey();
  const took = [];

  for (const w of WANTED) {
    let list = [];
    try { list = await candidates(w.search); } catch (e) { console.log('q' + w.index + ' ' + w.what + ': search failed — ' + e.message); continue; }
    const free = list.filter(isFree).sort((a, b) => score(a) - score(b));
    const skipped = list.length - free.length;

    if (!free.length) {
      console.log('q' + String(w.index).padStart(2) + '  ' + w.what.padEnd(18)
        + 'nothing provably free among ' + list.length + ' results — left without a picture');
      continue;
    }
    const pick = free[0];
    const y = yearOf(pick.date);
    console.log('q' + String(w.index).padStart(2) + '  ' + w.what.padEnd(18)
      + (pick.licence || 'public domain') + (y ? ' · ' + y : '')
      + '  ' + pick.title.replace(/^File:/, '').slice(0, 54)
      + '   (' + skipped + ' skipped as not free)');

    if (DRY) { took.push({ w, pick }); continue; }

    try {
      const bytes = Buffer.from(await (await get(pick.thumb)).arrayBuffer());
      const path = 'media/egypt/q' + w.index + '.jpg';
      await upload(key, path, bytes);
      const url = 'https://' + REF + '.supabase.co/storage/v1/object/public/' + path;
      await sql("update public.questions set media_url = '" + url + "', media_type = 'image'"
        + " where pack_id = '" + PACK + "' and order_index = " + w.index + ";");
      took.push({ w, pick, url, bytes: bytes.length });
      console.log('      → ' + Math.round(bytes.length / 1024) + ' KB, in place');
    } catch (e) {
      console.log('      → could not be copied: ' + e.message);
    }
  }

  console.log('\n' + took.length + ' of ' + WANTED.length + ' questions have a picture.');
  if (took.length) {
    console.log('\nWhat was used, and under what:');
    took.forEach(({ w, pick }) => {
      console.log('  q' + w.index + '  ' + pick.title.replace(/^File:/, ''));
      console.log('       ' + (pick.licence || 'public domain') + ' · ' + (pick.author || 'unknown').slice(0, 70));
    });
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
