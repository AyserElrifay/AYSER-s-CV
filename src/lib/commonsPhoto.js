/* ─── A REAL PHOTO OF A REAL PLACE, CREDITED ──────────────────────────
   Third and fourth on the photo list Ayser agreed to: public places get
   a photo only if a freely licensed one really exists — from Wikimedia
   Commons, found through the Wikipedia article AT THAT SPOT — and it is
   shown with who took it and under what licence. Nothing scraped, no
   stock, and a nearby photo of a different building does not count:
   the article's title has to share the place's real words — two of
   them when the name has two ("Cairo Opera House" is not "Cairo
   Tower", "Al-Azhar Park" is not "Al-Azhar Mosque").
   With no match, the place keeps its emoji.

   Asked only when somebody opens a place, and kept on the phone for a
   month (a "no photo" answer too), so the map stays as fast as it was.

   The matching is pure, so it is checked without a network:

       node scripts/check-commons-photo.mjs
*/

const STOP = new Set(['the', 'of', 'and', 'old', 'city', 'town', 'new', 'de', 'la', 'le', 'el', 'al', 'del', 'des', 'du', 'di', 'an', 'in', 'on', 'at', 'st', 'saint', 'les', 'los', 'las']);

const words = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

/* how many of the place's real words the title shares */
const shared = (placeName, title) => {
  const a = new Set(words(placeName));
  return new Set(words(title).filter((w) => a.has(w))).size;
};

/* does this Wikipedia title name this place? its real words — two of
   them when it has two or more */
export function sameName(placeName, title) {
  const need = Math.min(2, words(placeName).length);
  return need > 0 && shared(placeName, title) >= need;
}

/* a photograph, not a logo: Ayser's "Al-Azhar Park" plan showed the
   university's emblem. Emblems, seals, maps and flags are drawings
   (svg/png) or say so in the file name. */
const NOT_PHOTO = /logo|emblem|seal|coat_of_arms|coat of arms|flag|map|icon|symbol|crest|diagram|plan\b|sign/i;
export const isPhoto = (file) => /\.(jpe?g|webp)$/i.test(String(file || '')) && !NOT_PHOTO.test(String(file || ''));

/* the article to trust: names the place, most shared words, then nearest */
export function pickPage(placeName, pages) {
  return (pages || [])
    .filter((p) => p && p.thumbnail && p.thumbnail.source && p.pageimage && isPhoto(p.pageimage) && sameName(placeName, p.title))
    .sort((a, b) => shared(placeName, b.title) - shared(placeName, a.title)
      || (a.dist == null ? 1e9 : a.dist) - (b.dist == null ? 1e9 : b.dist))[0] || null;
}

const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

/* the credit line, from the file's own page on Commons */
export function creditOf(meta) {
  if (!meta) return null;
  const artist = strip(meta.Artist && meta.Artist.value).slice(0, 60);
  const license = strip(meta.LicenseShortName && meta.LicenseShortName.value);
  if (!license) return null;               // no licence stated: not shown at all
  return { artist: artist || null, license };
}

/* v2: a month of "no photo" kept under the old rule must not hide the
   name search from a phone that asked before it existed */
const KEY = 'moments.commons3.';
const MONTH = 30 * 24 * 3600 * 1000;
const recall = (k) => { try { const v = JSON.parse(localStorage.getItem(KEY + k) || 'null'); return v && Date.now() - v.at < MONTH ? v : null; } catch (e) { return null; } };
const keep = (k, photo) => { try { localStorage.setItem(KEY + k, JSON.stringify({ at: Date.now(), photo })); } catch (e) {} };

const getJSON = async (url) => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
  try {
    const r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    return r.ok ? await r.json() : null;
  } catch (e) { return null; } finally { if (timer) clearTimeout(timer); }
};

/* ── AND BY NAME, WHEN THE SPOT FINDS NOTHING ──────────────────────
   Ayser: the plans should have photos of their places. Most had none:
   Madinaty's park has no point on the map at all, and "Maadi corniche"
   or "Zamalek, Nile corniche" have no Wikipedia article standing at
   that spot. So when the spot finds nothing, the name is searched
   for, from the most exact to the widest it can honestly mean:

     "Zamalek, Nile corniche" → that, then "Zamalek", "Nile corniche"
     "Madinaty Central Park"  → that, then "Madinaty"

   The same rule as before decides: the article's title must carry the
   words that were searched for. A wider match is a photo of the AREA,
   and says so — its credit names the article ("Maadi"), so nobody is
   told a district is the bench they will sit on. */
const GENERIC = new Set(['park', 'central', 'corniche', 'garden', 'gardens', 'square', 'street', 'road', 'beach', 'club', 'cafe', 'nile', 'main', 'gate', 'entrance', 'riverside']);

export function nameQueries(name) {
  const out = [];
  const add = (q) => { q = String(q || '').trim(); if (q && words(q).length && !out.includes(q)) out.push(q); };
  add(name);
  const parts = String(name || '').split(/[,·–—]/).map((x) => x.trim()).filter(Boolean);
  parts.forEach(add);
  parts.forEach((part) => add(part.split(/\s+/).filter((w) => !GENERIC.has(w.toLowerCase())).join(' ')));
  return out;
}

const commonsCredit = async (page) => {
  const file = 'File:' + page.pageimage;
  const info = await getJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
    + '&prop=imageinfo&iiprop=extmetadata%7Curl&iiextmetadatafilter=Artist%7CLicenseShortName&titles=' + encodeURIComponent(file));
  const ii = info && info.query && Object.values(info.query.pages || {})[0];
  const im = ii && ii.imageinfo && ii.imageinfo[0];
  const credit = creditOf(im && im.extmetadata);
  if (!credit) return null;
  return {
    url: page.thumbnail.source,
    page: (im && im.descriptionurl) || ('https://commons.wikimedia.org/wiki/' + encodeURIComponent(file)),
    artist: credit.artist, license: credit.license, title: page.title,
  };
};

const toPages = (j) => Object.values((j && j.query && j.query.pages) || {}).map((p) => ({
  title: p.title, pageimage: p.pageimage, thumbnail: p.thumbnail,
  dist: p.coordinates && p.coordinates[0] ? p.coordinates[0].dist : null,
  lat: p.coordinates && p.coordinates[0] ? p.coordinates[0].lat : null,
  lon: p.coordinates && p.coordinates[0] ? p.coordinates[0].lon : null,
}));

/* A search by name can find a film, a song or a person that shares the
   word ("Merryland"). Only an article that is itself a PLACE counts —
   it has coordinates — and, when the plan has a spot, one within 30 km
   of it: Zamalek in Cairo, not a Zamalek somewhere else. */
const KM = (a, b, c, d) => {
  const r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};
export function isNearPlace(page, lat, lng) {
  if (!page || page.lat == null || page.lon == null) return false;
  if (lat == null || lng == null) return true;
  return KM(lat, lng, page.lat, page.lon) <= 30;
}

/* { url, page, artist, license, title } or null */
export async function placePhoto({ name, lat, lng }) {
  if (!name) return null;
  const hasSpot = lat != null && lng != null;
  const k = name + '|' + (hasSpot ? Number(lat).toFixed(3) + '|' + Number(lng).toFixed(3) : '-');
  const kept = recall(k);
  if (kept) return kept.photo;

  let reached = false;            // did any request get an answer at all?
  if (hasSpot) {
    const j = await getJSON('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*'
      + '&generator=geosearch&ggscoord=' + lat + '%7C' + lng + '&ggsradius=3000&ggslimit=15'
      + '&prop=pageimages%7Ccoordinates&piprop=thumbnail%7Cname&pithumbsize=900&pilicense=free&colimit=15');
    if (j) {
      reached = true;
      const page = pickPage(name, toPages(j));
      if (page) { const photo = await commonsCredit(page); if (photo) { keep(k, photo); return photo; } }
    }
  }
  for (const q of nameQueries(name)) {
    const j = await getJSON('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*'
      + '&generator=search&gsrsearch=' + encodeURIComponent(q) + '&gsrlimit=6'
      + '&prop=pageimages%7Ccoordinates&piprop=thumbnail%7Cname&pithumbsize=900&pilicense=free&colimit=6');
    if (!j) continue;
    reached = true;
    /* and it must be the same KIND of place: a search for "Al-Azhar"
       (park stripped) must not settle on Al-Azhar University */
    const kinds = String(name).toLowerCase().split(/[^a-z]+/).filter((w) => GENERIC.has(w) && !['central', 'main', 'nile'].includes(w));
    const page = pickPage(q, toPages(j).filter((pg) => isNearPlace(pg, hasSpot ? lat : null, hasSpot ? lng : null)
      && kinds.every((w) => String(pg.title).toLowerCase().indexOf(w) >= 0)));
    if (!page) continue;
    const photo = await commonsCredit(page);
    if (photo) { keep(k, photo); return photo; }
  }
  if (reached) keep(k, null);     // offline: ask again next time, keep nothing
  return null;
}
