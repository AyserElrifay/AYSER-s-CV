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

/* the article to trust: names the place, most shared words, then nearest */
export function pickPage(placeName, pages) {
  return (pages || [])
    .filter((p) => p && p.thumbnail && p.thumbnail.source && p.pageimage && sameName(placeName, p.title))
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

const KEY = 'moments.commons.';
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

/* { url, page, artist, license, file } or null */
export async function placePhoto({ name, lat, lng }) {
  if (!name || lat == null || lng == null) return null;
  const k = name + '|' + Number(lat).toFixed(3) + '|' + Number(lng).toFixed(3);
  const kept = recall(k);
  if (kept) return kept.photo;

  const geo = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*'
    + '&generator=geosearch&ggscoord=' + lat + '%7C' + lng + '&ggsradius=3000&ggslimit=15'
    + '&prop=pageimages%7Ccoordinates&piprop=thumbnail%7Cname&pithumbsize=900&pilicense=free&colimit=15';
  const j = await getJSON(geo);
  if (!j) return null;                      // offline: ask again next time, keep nothing
  const pages = Object.values((j.query && j.query.pages) || {}).map((p) => ({
    title: p.title, pageimage: p.pageimage, thumbnail: p.thumbnail,
    dist: p.coordinates && p.coordinates[0] ? p.coordinates[0].dist : null,
  }));
  const page = pickPage(name, pages);
  if (!page) { keep(k, null); return null; }

  const file = 'File:' + page.pageimage;
  const info = await getJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
    + '&prop=imageinfo&iiprop=extmetadata%7Curl&iiextmetadatafilter=Artist%7CLicenseShortName&titles=' + encodeURIComponent(file));
  const ii = info && info.query && Object.values(info.query.pages || {})[0];
  const im = ii && ii.imageinfo && ii.imageinfo[0];
  const credit = creditOf(im && im.extmetadata);
  if (!credit) { keep(k, null); return null; }
  const photo = {
    url: page.thumbnail.source,
    page: (im && im.descriptionurl) || ('https://commons.wikimedia.org/wiki/' + encodeURIComponent(file)),
    artist: credit.artist, license: credit.license, title: page.title,
  };
  keep(k, photo);
  return photo;
}
