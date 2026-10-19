/* ─── A REAL PHOTO ON EVERY TRIP ──────────────────────────────────────
   Ayser: "حط صور ارجوك ما تسبهاش فضيع كده" — a trip card with only a
   flag on a gradient sells nothing. This finds real photographs of the
   place each trip goes to, copies them into the app's own storage, and
   puts them on the trip.

   The same rule as the Egypt quiz (scripts/import-egypt-photos.mjs),
   not negotiable: a photo goes in only if Wikimedia Commons says, in
   its own metadata, that it is PUBLIC DOMAIN or CC0. Anything else is
   skipped and named in the log. Landscape photos first (a trip card is
   wide), 1080px wide, two per trip.

   It only fills trips that have NO photo — anything the team set in the
   Studio is never touched. It runs on the CI runner, which can reach
   Commons; the app's sandbox cannot.

   Usage:  node scripts/import-offer-photos.mjs
   Env:    SUPABASE_ACCESS_TOKEN   (required)
           PROJECT_REF             (default: the Moments project)
           DRY_RUN=1               look and report, write nothing
*/

const REF = process.env.PROJECT_REF || 'dvddiyztpyyuultndzso';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const DRY = process.env.DRY_RUN === '1';
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }

const ID = (n) => '0ffe0000-0000-4000-8000-0000000000' + n;
/* the trip, and what a photo of it looks like — a few searches each,
   the most exact first */
const WANTED = [
  { id: ID('16'), what: 'Prague', search: ['Charles Bridge Prague', 'Prague Old Town Square', 'Prague skyline'] },
  { id: ID('12'), what: 'Viru bog, Lahemaa', search: ['Viru raba', 'Viru bog', 'Lahemaa National Park'] },
  { id: ID('11'), what: 'Tallinn old town', search: ['Tallinn Old Town', 'Kalamaja Tallinn'] },
  { id: ID('15'), what: 'Lake Como', search: ['Lake Como Bellagio', 'Lago di Como', 'Varenna Lake Como'] },
  { id: ID('14'), what: 'Transfăgărășan & Bâlea', search: ['Transfăgărășan', 'Bâlea Lake', 'Transfagarasan road'] },
  { id: ID('13'), what: 'Brașov & Bran', search: ['Bran Castle', 'Brașov Council Square', 'Brasov old town'] },
  { id: ID('08'), what: 'Wadi Degla', search: ['Wadi Degla', 'Wadi Degla Protectorate', 'Eastern Desert Egypt wadi'] },
  { id: ID('09'), what: 'the Nile in Cairo', search: ['Nile Cairo boats', 'Felucca Nile Cairo', 'Nile river Cairo'] },
  { id: ID('0a'), what: 'climbing & zip line', search: ['zip line', 'rock climbing', 'zipline adventure'] },
  { id: ID('02'), what: 'El Gouna', search: ['El Gouna', 'El Gouna lagoon', 'Hurghada Red Sea beach'] },
  { id: ID('0f'), what: 'Giza & the GEM', search: ['Pyramids of Giza', 'Grand Egyptian Museum'] },
  { id: ID('05'), what: 'Fayoum', search: ['Wadi El Rayan waterfalls', 'Lake Qarun', 'Fayoum oasis'] },
  { id: ID('07'), what: 'Port Said', search: ['Port Said', 'Port Said lighthouse', 'Suez Canal Port Said'] },
];

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'MomentsTrips/1.0 (https://github.com/AyserElrifay/AYSER-s-CV; public-domain photos for trip cards)';
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const get = async (url, opts = {}, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const headers = Object.assign({ 'User-Agent': UA, Accept: '*/*' }, opts.headers || {});
    const r = await fetch(url, Object.assign({}, opts, { headers }));
    if (r.ok) return r;
    if ((r.status === 429 || r.status === 503) && i < tries - 1) { await sleep(2500 * (i + 1)); continue; }
    throw new Error(r.status + ' ' + url.slice(0, 90));
  }
  throw new Error('gave up on ' + url.slice(0, 90));
};

async function candidates(search) {
  const u = API + '?action=query&format=json&origin=*'
    + '&generator=search&gsrnamespace=6&gsrlimit=30'
    + '&gsrsearch=' + encodeURIComponent(search)
    + '&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1080';
  const j = await (await get(u)).json();
  const pages = (j.query && j.query.pages) || {};
  return Object.values(pages).map((p) => {
    const ii = (p.imageinfo && p.imageinfo[0]) || {};
    const m = ii.extmetadata || {};
    const val = (k) => (m[k] && typeof m[k].value === 'string' ? m[k].value.replace(/<[^>]*>/g, '').trim() : '');
    return {
      title: p.title, mime: ii.mime || '', thumb: ii.thumburl || '',
      w: Number(ii.width) || 0, h: Number(ii.height) || 0,
      licence: val('LicenseShortName') || val('UsageTerms'),
      licenceId: (val('License') || '').toLowerCase(),
      copyrighted: val('Copyrighted'),
      author: val('Artist') || val('Credit') || 'unknown',
    };
  });
}

/* Public domain or CC0, said by Commons itself; a real photograph
   (no maps, plans, logos or paintings), at least 1200px wide, wider
   than tall */
function isFree(c) {
  if (c.mime !== 'image/jpeg') return false;
  if (c.w < 1200 || c.w < c.h * 1.15) return false;
  if (/map|plan|logo|coat of arms|flag|diagram|painting|drawing|postcard|stamp/i.test(c.title)) return false;
  const id = c.licenceId; const name = (c.licence || '').toLowerCase();
  return id === 'pd' || id === 'cc0' || id.startsWith('pd-') || /^public domain/.test(name) || /^cc0/.test(name)
    || (c.copyrighted || '').toLowerCase() === 'false';
}

async function serviceKey() {
  const r = await get('https://api.supabase.com/v1/projects/' + REF + '/api-keys?reveal=true', { headers: { Authorization: 'Bearer ' + TOKEN } });
  const k = ((await r.json()) || []).find((x) => x.name === 'service_role');
  if (!k || !k.api_key) throw new Error('no service_role key returned');
  return k.api_key;
}
async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error('SQL ' + r.status + ': ' + body.slice(0, 300));
  return body;
}
async function upload(key, path, bytes) {
  const r = await fetch('https://' + REF + '.supabase.co/storage/v1/object/' + path, {
    method: 'POST', headers: { Authorization: 'Bearer ' + key, apikey: key, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: bytes,
  });
  if (!r.ok) throw new Error('upload ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

(async () => {
  console.log(DRY ? '── looking only, writing nothing ──\n' : '── finding photos for the trips ──\n');
  const empty = JSON.parse(await sql("select coalesce(json_agg(id), '[]') as ids from public.offers where photos is null or photos = '{}'"))[0].ids || [];
  const key = DRY ? null : await serviceKey();
  let done = 0; const used = [];
  for (const w of WANTED) {
    if (empty.indexOf(w.id) < 0) { console.log(w.what.padEnd(26) + 'already has a photo — left alone'); continue; }
    const seen = new Set(); let free = []; let looked = 0;
    for (const q of w.search) {
      if (free.length >= 2) break;
      let list = [];
      try { list = await candidates(q); } catch (e) { console.log(w.what.padEnd(26) + 'search failed — ' + e.message); continue; }
      looked += list.length;
      list.filter(isFree).forEach((c) => { if (!seen.has(c.title)) { seen.add(c.title); free.push(c); } });
      await sleep(800);
    }
    free = free.slice(0, 2);
    if (!free.length) { console.log(w.what.padEnd(26) + 'nothing provably free among ' + looked + ' results — left as it is'); continue; }
    if (DRY) { free.forEach((c) => used.push({ w, c })); console.log(w.what.padEnd(26) + free.map((c) => c.title.replace(/^File:/, '').slice(0, 40)).join(' · ')); continue; }
    const urls = [];
    for (let i = 0; i < free.length; i++) {
      try {
        await sleep(1200);
        const bytes = Buffer.from(await (await get(free[i].thumb)).arrayBuffer());
        const path = 'media/offers/' + w.id + '-' + (i + 1) + '.jpg';
        await upload(key, path, bytes);
        urls.push('https://' + REF + '.supabase.co/storage/v1/object/public/' + path);
        used.push({ w, c: free[i] });
      } catch (e) { console.log('   could not copy ' + free[i].title + ': ' + e.message); }
    }
    if (!urls.length) continue;
    await sql("update public.offers set photos = array[" + urls.map((u) => "'" + u + "'").join(',') + "]::text[]"
      + " where id = '" + w.id + "' and (photos is null or photos = '{}');");
    done++;
    console.log(w.what.padEnd(26) + urls.length + ' photo(s) in place');
  }
  console.log('\n' + done + ' trip(s) got photos.');
  if (used.length) {
    console.log('\nWhat was used, and under what:');
    used.forEach(({ w, c }) => console.log('  ' + w.what + ' — ' + c.title.replace(/^File:/, '') + ' · ' + (c.licence || 'public domain') + ' · ' + c.author.slice(0, 60)));
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
