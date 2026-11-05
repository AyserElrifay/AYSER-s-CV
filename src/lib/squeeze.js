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
export async function squeezeImage(uriOrBlob) {
  if (typeof window === 'undefined' || !window.document) return { uri: uriOrBlob, ext: null, type: null };
  const isWebp = (uriOrBlob && typeof uriOrBlob !== 'string') ? /webp/.test(uriOrBlob.type || '') : /^data:image\/webp/.test(String(uriOrBlob));
  if (isWebp && sizeOf(uriOrBlob) && sizeOf(uriOrBlob) <= MAX_IMAGE_BYTES) return { uri: uriOrBlob, ext: null, type: null };
  let src = uriOrBlob, made = null;
  if (uriOrBlob && typeof uriOrBlob !== 'string') { made = URL.createObjectURL(uriOrBlob); src = made; }
  try {
    const tries = [[1080, 0.72], [1080, 0.6], [900, 0.55], [720, 0.5]];
    let best = null;
    for (const [side, q] of tries) {
      const s = await smallImage(src, side, q);
      if (!s.ext) break;                                  // the browser could not draw it: send it as it was
      best = s;
      if (sizeOf(s.uri) <= MAX_IMAGE_BYTES) break;
    }
    if (!best) return { uri: uriOrBlob, ext: null, type: null };
    return { uri: dataBlob(best.uri), ext: best.ext, type: best.type };
  } finally {
    if (made) { try { URL.revokeObjectURL(made); } catch (e) {} }
  }
}
