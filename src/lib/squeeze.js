import { smallImage, dataBlob } from './storage';

/* ── EVERY PHOTO, SMALL ───────────────────────────────────────────────
   Ayser, November 2026 (the egress alert): a photo leaves the phone as
   WebP, at most 1080px wide, quality 0.72, and at most 120 KB — tried
   again smaller until it fits. A GIF (it moves) and a video are left
   alone; a file already under the limit and already WebP is kept. */
const MAX_IMAGE_BYTES = 120 * 1024;
const sizeOf = (u) => {
  if (u && typeof u !== 'string') return u.size || 0;
  const i = String(u).indexOf(',');
  return /^data:/.test(u) && i > 0 ? Math.floor((u.length - i - 1) * 3 / 4) : 0;
};
/* the Moments Book's server copy: the full one stays on the phone (src/lib/vault.js) */
export const BOOK_THUMB = { maxBytes: 35 * 1024, tries: [[640, 0.6], [560, 0.55], [480, 0.5], [400, 0.45], [320, 0.4]] };
export async function squeezeImage(uriOrBlob, opt) {
  const MAX = (opt && opt.maxBytes) || MAX_IMAGE_BYTES;
  if (typeof window === 'undefined' || !window.document) return { uri: uriOrBlob, ext: null, type: null };
  const isWebp = (uriOrBlob && typeof uriOrBlob !== 'string') ? /webp/.test(uriOrBlob.type || '') : /^data:image\/webp/.test(String(uriOrBlob));
  if (isWebp && sizeOf(uriOrBlob) && sizeOf(uriOrBlob) <= MAX) return { uri: uriOrBlob, ext: null, type: null };
  let src = uriOrBlob, made = null;
  if (uriOrBlob && typeof uriOrBlob !== 'string') { made = URL.createObjectURL(uriOrBlob); src = made; }
  try {
    const tries = (opt && opt.tries) || [[1080, 0.72], [1080, 0.6], [900, 0.55], [720, 0.5]];
    let best = null;
    for (const [side, q] of tries) {
      const s = await smallImage(src, side, q);
      if (!s.ext) break;                                  // the browser could not draw it: send it as it was
      best = s;
      if (sizeOf(s.uri) <= MAX) break;
    }
    if (!best) return { uri: uriOrBlob, ext: null, type: null };
    return { uri: dataBlob(best.uri), ext: best.ext, type: best.type };
  } finally {
    if (made) { try { URL.revokeObjectURL(made); } catch (e) {} }
  }
}
