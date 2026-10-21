/* ─── A PHOTO FOR EVERY PLACE ─────────────────────────────────────────
   Ayser: "اتأكد إن كل الأماكن ليها صور". Most places in
   src/constants/destinations.js had none of their own, and only found
   one from Wikimedia Commons when somebody opened them — so the map and
   the lists showed an emoji.

   This runs on the GitHub runner (the app's sandbox has no route to
   Commons) and does, once, what the phone did each time, by the same
   rules (src/lib/commonsPhoto.js):

     · the Wikipedia article at that spot — or found by the place's
       name, within 30 km of it — whose title carries the place's words
     · its photo must live on Commons with a licence stated in the
       file's own metadata (a local "fair use" file has none, so it is
       never taken)
     · a photograph, not a logo or a map

   The picture is copied into public/media/places/<id>.jpg at 960px, and
   who took it and under which licence goes into
   public/media/places/credits.json, which the place sheet shows on the
   photo. The ids that have one are written to
   src/constants/placePhotoIds.js, so the lists can use them without
   carrying the credits in the first download.

   A place that already has a photo of Ayser's keeps it. A place with
   no honest match keeps its emoji — a picture of somewhere else would
   be worse than none.

   Usage:  node scripts/import-place-photos.mjs
   Env:    LIMIT=n      only the first n places still without a photo
           DRY_RUN=1    look and report, write nothing
*/
import fs from 'node:fs';
import path from 'node:path';
import { DESTINATIONS } from '../src/constants/destinations.js';
import { pickPage, nameQueries, isNearPlace, creditOf } from '../src/lib/commonsPhoto.js';

const DRY = process.env.DRY_RUN === '1';
const LIMIT = Number(process.env.LIMIT) || Infinity;
const OUT = path.join(process.cwd(), 'public', 'media', 'places');
const CREDITS = path.join(OUT, 'credits.json');
const IDS = path.join(process.cwd(), 'src', 'constants', 'placePhotoIds.js');

const UA = 'MomentsPlaces/1.0 (https://github.com/AyserElrifay/AYSER-s-CV; freely licensed photos of public places, credited)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429) { await sleep(4000 * (i + 1)); continue; }
      if (r.ok) return await r.json();
    } catch (e) { /* try again */ }
    await sleep(1200);
  }
  return null;
}

const toPages = (j) => Object.values((j && j.query && j.query.pages) || {}).map((p) => ({
  title: p.title, pageimage: p.pageimage, thumbnail: p.thumbnail,
  dist: p.coordinates && p.coordinates[0] ? p.coordinates[0].dist : null,
  lat: p.coordinates && p.coordinates[0] ? p.coordinates[0].lat : null,
  lon: p.coordinates && p.coordinates[0] ? p.coordinates[0].lon : null,
}));

const WP = 'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates%7Cpageimages&piprop=thumbnail%7Cname&pithumbsize=960';

async function findPage(d) {
  // the article standing at that spot
  const near = await getJSON(WP + '&generator=geosearch&ggslimit=20&ggsradius=2000&ggscoord=' + d.lat + '%7C' + d.lng + '&codistancefrompoint=' + d.lat + '%7C' + d.lng);
  let page = pickPage(d.name, toPages(near));
  if (page) return page;
  // then by name, from the most exact to the widest it can honestly mean
  for (const q of nameQueries(d.name)) {
    const found = await getJSON(WP + '&generator=search&gsrlimit=8&gsrsearch=' + encodeURIComponent(q) + '&codistancefrompoint=' + d.lat + '%7C' + d.lng);
    const pages = toPages(found).filter((p) => isNearPlace(p, d.lat, d.lng));
    page = pickPage(q, pages);
    if (page) return page;
    await sleep(300);
  }
  return null;
}

async function commonsFile(page) {
  const file = 'File:' + page.pageimage;
  const j = await getJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata%7Curl&iiurlwidth=960'
    + '&iiextmetadatafilter=Artist%7CLicenseShortName&titles=' + encodeURIComponent(file));
  const p = j && j.query && Object.values(j.query.pages || {})[0];
  const im = p && p.imageinfo && p.imageinfo[0];
  const credit = creditOf(im && im.extmetadata);
  if (!im || !credit) return null;            // not on Commons, or no licence stated: never taken
  return { url: im.thumburl || im.url, page: im.descriptionurl, ...credit, title: page.title };
}

const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : {};
const todo = DESTINATIONS.filter((d) => !d.photo && !credits[d.id]).slice(0, LIMIT);
console.log(DESTINATIONS.length + ' places · ' + Object.keys(credits).length + ' already have a Commons photo · ' + todo.length + ' to look for');
if (!DRY) fs.mkdirSync(OUT, { recursive: true });

let got = 0; const none = [];
for (const d of todo) {
  const page = await findPage(d);
  const file = page ? await commonsFile(page) : null;
  if (!file) { none.push(d.id + ' (' + d.name + ')'); continue; }
  if (!DRY) {
    const r = await fetch(file.url, { headers: { 'User-Agent': UA } });
    if (!r.ok) { none.push(d.id + ' (download ' + r.status + ')'); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 8000) { none.push(d.id + ' (too small)'); continue; }
    fs.writeFileSync(path.join(OUT, d.id + '.jpg'), buf);
    credits[d.id] = { a: file.artist, l: file.license, p: file.page, t: file.title };
  }
  got++;
  console.log('  ✓ ' + d.id + ' ← ' + file.title + ' · ' + (file.artist || '?') + ' · ' + file.license);
  await sleep(700);
}

if (!DRY) {
  fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 0));
  const ids = Object.keys(credits).sort();
  fs.writeFileSync(IDS, '/* written by scripts/import-place-photos.mjs: the places that have a\n   freely licensed Commons photo in public/media/places/ (credits.json) */\nexport const PLACE_PHOTO_IDS = ' + JSON.stringify(ids.join(' ')) + ';\n');
}
console.log('\n' + got + ' new photos · ' + none.length + ' places with no honest match:');
none.forEach((x) => console.log('  · ' + x));
