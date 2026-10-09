/* ─── NO VIDEO CARD IS EVER A BLACK RECTANGLE ────────────────────────
   Ayser, twice now: "ليه الفديوز من بره لونها اسود", and then "الفديوهات
   ... ما ينفعش يبقي اسود — خد صوره من الفديو".

   A clip posted from the studio gets a cover made for it at upload.
   Three kinds never did:

     · one whose cover upload failed. The post still went up, which is
       right — a missing still is not a reason to lose somebody's video
       — but it went up with nothing to show.
     · anything that arrived another way: imported, seeded, or posted
       before covers existed at all.
     · and in data saver, any of the above, because the whole point of
       saver is not to fetch the clip — so there is nothing on screen
       to fetch a frame FROM.

   In all three the card drew a black box. Black reads as broken, or
   worse, as a video that failed, so people do not tap it.

   So the still is taken from the video itself, here, in the browser,
   once per clip ever. It costs the first second or so of the file —
   far less than the autoplay the saver is there to prevent — and the
   result is kept, so the second time that clip is seen it costs
   nothing at all.

   Two rules this follows:

     · ONE AT A TIME. Ten video cards in a feed all deciding to decode
       at once is exactly the bill saver mode exists to avoid, so they
       queue.
     · A FAILURE IS SILENT AND REMEMBERED. A clip whose frames cannot
       be read (a tainted canvas, a codec the browser will not decode)
       is marked as such and never tried again, and the card falls back
       to something that is at least not black.

       node scripts/check-poster.mjs
*/
import { grabFrames, pickBest } from './frames.js';   // the extension lets the checks import this in plain node

const KEY = 'mm.poster.v1';
const MAX = 60;              // posters kept; a still is ~8-20KB as a data URL

const mem = new Map();       // id → data URL
const dead = new Set();      // ids whose frames cannot be read
let disk = null;

function load() {
  if (disk) return disk;
  disk = {};
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(KEY);
    if (raw) disk = JSON.parse(raw) || {};
  } catch (e) { disk = {}; }
  return disk;
}

function save() {
  try {
    const d = load();
    const keys = Object.keys(d);
    /* oldest out first. Insertion order is good enough here: this is a
       cache, and the cost of being wrong is one re-decode. */
    while (keys.length > MAX) delete d[keys.shift()];
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(d));
  } catch (e) { /* a full or blocked store is not an error worth having */ }
}

/* What we already have for this clip, with no work and no network. */
export function cachedPoster(id) {
  if (!id) return null;
  if (mem.has(id)) return mem.get(id);
  const d = load()[id];
  if (d) { mem.set(id, d); return d; }
  return null;
}

export function posterFailed(id) { return dead.has(id); }

/* ── THE QUEUE ──────────────────────────────────────────────────────
   One decode at a time, app-wide. */
let chain = Promise.resolve();
function queued(fn) {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

/* Take a still from a clip that has none. Resolves to a data URL, or
   null — never throws, because a cover is a nicety and a nicety must
   not take a card down with it. */
export function derivePoster(id, mediaUrl, { frames = 3 } = {}) {
  if (!id || !mediaUrl || typeof document === 'undefined') return Promise.resolve(null);
  const have = cachedPoster(id);
  if (have) return Promise.resolve(have);
  if (dead.has(id)) return Promise.resolve(null);

  return queued(async () => {
    const again = cachedPoster(id);
    if (again) return again;
    if (dead.has(id)) return null;
    let got;
    try {
      /* three, not six. This is not the cover picker — it only has to
         find one frame that is not the black one at the very start. */
      got = await grabFrames(mediaUrl, frames, { crossOrigin: true });
    } catch (e) { got = { frames: [] }; }
    const list = (got && got.frames) || [];
    if (!list.length) { dead.add(id); return null; }
    const best = pickBest(list);
    const url = best >= 0 ? list[best].url : list[0].url;
    if (!url) { dead.add(id); return null; }
    mem.set(id, url);
    const d = load(); d[id] = url; save();
    return url;
  });
}

/* Called when the author picks a different cover, or one is uploaded:
   the derived guess must not outlive the real answer. */
export function forgetPoster(id) {
  if (!id) return;
  mem.delete(id);
  dead.delete(id);
  try { const d = load(); delete d[id]; save(); } catch (e) {}
}

/* ── AND WHEN EVEN THAT FAILS ───────────────────────────────────────
   A clip the browser will not decode still must not be a black hole.
   The card gets a colour of its own instead — stable for a given post,
   so the same clip is the same colour every time rather than flashing
   a new one on each scroll. Dark enough for white text to sit on it.

   This is deliberately not grey: grey reads as "loading", and this is
   not loading, it is the final state. */
export function posterTint(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return 'hsl(' + hue + ', 32%, 24%)';
}
