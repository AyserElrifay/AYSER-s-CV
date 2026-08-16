import { drawLens } from '../lensArt';

/* ─── لمّة · TURNING A LIVE FRAME INTO A FACE ────────────────────────
   Kept out of the camera screen on purpose: this is arithmetic — a
   mirror, a crop and an encode — and arithmetic is the part that can
   be run outside a phone and checked. The screen around it does the
   camera; this does the picture.

   Every number here has a reason:

   MIRRORED, because the preview is. A front camera shown unmirrored
   is a stranger, so the preview flips — and if the file did not flip
   with it, the photo you kept would not be the photo you took.

   CROPPED AROUND THE FACE, not the middle of the room. And wider than
   the face itself, because a nemes headcloth is half a head taller and
   a good deal wider than the head inside it; cropping to the face
   would slice the top off the crown every time.

   SMALL. This travels to every phone in the room on every refresh, so
   it is a face at the size a face is shown — around 8 KB — not a
   photograph. If a device's encoder produces something fatter anyway,
   it gets squeezed rather than refused at the far end. */

export const OUT = 224;
export const QUALITY = 0.68;
export const MAX_CHARS = 26000;          // what the server will accept

const canvas = (w, h) => {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
};

/* `source` is anything drawImage accepts — a <video> while the camera
   is live, and a canvas or an image when this is being checked. */
export function bakeFace(source, frameW, frameH, lens, now) {
  if (!source || !frameW || !frameH) return null;

  const off = canvas(frameW, frameH);
  const c = off.getContext('2d');
  c.save();
  c.translate(frameW, 0);
  c.scale(-1, 1);
  c.drawImage(source, 0, 0, frameW, frameH);
  c.restore();
  drawLens(c, frameW, frameH, lens, now || 0);

  const want = lens && lens.s ? lens.s * frameH * 3.0 : frameH * 0.9;
  const side = Math.max(80, Math.min(frameW, frameH, want));
  const cx = (lens && lens.x != null ? lens.x : 0.5) * frameW;
  const cy = (lens && lens.y != null ? lens.y : 0.5) * frameH - side * 0.10;  // headroom for a crown
  const sx = Math.max(0, Math.min(frameW - side, cx - side / 2));
  const sy = Math.max(0, Math.min(frameH - side, cy - side / 2));

  const out = canvas(OUT, OUT);
  out.getContext('2d').drawImage(off, sx, sy, side, side, 0, 0, OUT, OUT);

  let url = out.toDataURL('image/jpeg', QUALITY);
  if (url.length > MAX_CHARS) url = out.toDataURL('image/jpeg', 0.5);
  if (url.length > MAX_CHARS) {
    const small = canvas(160, 160);
    small.getContext('2d').drawImage(out, 0, 0, 160, 160);
    url = small.toDataURL('image/jpeg', 0.5);
  }
  return url;
}
