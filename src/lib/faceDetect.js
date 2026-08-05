/* ─── FINDING THE FACE ────────────────────────────────────────────────
   A lens that you have to drag onto your own head is not a lens, it is
   a sticker. For it to be a lens the app has to know where the face is
   and follow it.

   ── Why this detector and not a model ──
   Every off-the-shelf option was too heavy to put in front of somebody
   on mobile data. Measured, unpacked:

     @vladmandic/face-api   23 MB
     MediaPipe face_detection  6 MB   (5.8 MB of that is WASM)
     face-api.js             4.7 MB
     blazeface + tfjs        1.7 MB + runtime + weights from someone
                                    else's CDN

   This is pico — Nenad Markus's cascade detector — at 234 KB of cascade
   and about a page of arithmetic. No WASM, no tfjs, no third-party CDN
   at runtime, and it works in Safari on an iPhone, which is the whole
   reason the others were unusable: iOS has no built-in face detection
   to fall back on.

   MIT licensed (Copyright 2013 Nenad Markus), which matters here —
   nothing goes in this app that we don't have the right to ship. The
   algorithm below is his; the loading, the smoothing and the way it is
   fed video are ours.

   ── It is fetched, not bundled ──
   234 KB in the main bundle would be paid by everybody, including the
   people who never open the camera. It is fetched from our own origin
   the first time a lens is switched on, and the service worker keeps
   it after that.

   ── Honest failure ──
   If the cascade can't be fetched, or nothing is found, `find()` simply
   returns null and whatever is using it falls back to placing the lens
   by hand — which is exactly what the app did before this file existed.
   Nothing here is allowed to be the reason the camera stops working. */

let classify = null;      // the unpacked cascade
let loading = null;       // in-flight fetch, so two callers share one

/* Where the cascade lives. `baseUrl` matters because the app is served
   from a sub-path on Pages, not from the root. */
function cascadeUrl() {
  if (typeof window === 'undefined') return null;
  const base = (window.location.pathname.match(/^(.*\/)/) || ['/'])[0];
  return base.replace(/\/+$/, '') + '/facefinder.bin';
}

/* ── Nenad Markus's cascade format ── */
function unpackCascade(bytes) {
  const dv = new DataView(new ArrayBuffer(4));
  const i32 = (p) => {
    dv.setUint8(0, bytes[p]); dv.setUint8(1, bytes[p + 1]);
    dv.setUint8(2, bytes[p + 2]); dv.setUint8(3, bytes[p + 3]);
    return dv.getInt32(0, true);
  };
  const f32 = (p) => {
    dv.setUint8(0, bytes[p]); dv.setUint8(1, bytes[p + 1]);
    dv.setUint8(2, bytes[p + 2]); dv.setUint8(3, bytes[p + 3]);
    return dv.getFloat32(0, true);
  };

  let p = 8;                       // version + training data, skipped
  const tdepth = i32(p); p += 4;
  const ntrees = i32(p); p += 4;

  const codes = [];
  const preds = [];
  const thresh = [];
  const leaves = Math.pow(2, tdepth);
  for (let t = 0; t < ntrees; t++) {
    codes.push(0, 0, 0, 0);
    Array.prototype.push.apply(codes, Array.from(bytes.slice(p, p + 4 * leaves - 4)));
    p += 4 * leaves - 4;
    for (let i = 0; i < leaves; i++) { preds.push(f32(p)); p += 4; }
    thresh.push(f32(p)); p += 4;
  }

  const tcodes = new Int8Array(codes);
  const tpreds = new Float32Array(preds);
  const tthresh = new Float32Array(thresh);
  const pow2 = leaves >> 0;

  return function classifyRegion(r, c, s, pixels, ldim) {
    r = 256 * r;
    c = 256 * c;
    let root = 0;
    let o = 0.0;
    for (let i = 0; i < ntrees; i++) {
      let idx = 1;
      for (let j = 0; j < tdepth; j++) {
        idx = 2 * idx + (
          pixels[((r + tcodes[root + 4 * idx + 0] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 1] * s) >> 8)]
          <= pixels[((r + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 3] * s) >> 8)]
        );
      }
      o += tpreds[pow2 * i + idx - pow2];
      if (o <= tthresh[i]) return -1;
      root += 4 * pow2;
    }
    return o - tthresh[ntrees - 1];
  };
}

/* Fetch + unpack, once. Returns false rather than throwing when the
   cascade can't be had. */
export async function loadFaceDetector() {
  if (classify) return true;
  if (loading) return loading;
  loading = (async () => {
    try {
      const url = cascadeUrl();
      if (!url) return false;
      const res = await fetch(url);
      if (!res.ok) return false;
      const buf = await res.arrayBuffer();
      classify = unpackCascade(new Uint8Array(buf));
      return true;
    } catch (e) {
      return false;
    } finally { loading = null; }
  })();
  return loading;
}

export function detectorReady() { return !!classify; }

/* Greyscale the frame once into a reusable buffer. Detection runs on
   luma only, and allocating a new array 30 times a second is how a
   camera preview starts dropping frames. */
let work = null;   // { canvas, ctx, w, h, gray }

/* Anything the canvas can draw: a live <video>, a captured frame, a
   still photo. Reading only `videoWidth` would have tied this to live
   preview for no reason — finding the face in a photo somebody just
   took is the same problem. */
function sourceSize(src) {
  if (!src) return [0, 0];
  return [
    src.videoWidth || src.naturalWidth || src.width || 0,
    src.videoHeight || src.naturalHeight || src.height || 0,
  ];
}

function grayscale(video, targetWidth) {
  const [vw, vh] = sourceSize(video);
  if (!vw || !vh) return null;
  const w = targetWidth;
  const h = Math.round((vh / vw) * w);
  if (!work || work.w !== w || work.h !== h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    work = { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }), w, h, gray: new Uint8Array(w * h) };
  }
  work.ctx.drawImage(video, 0, 0, w, h);
  const d = work.ctx.getImageData(0, 0, w, h).data;
  const g = work.gray;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    // the usual luma weights, in integer arithmetic
    g[j] = (d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28) >> 8;
  }
  return work;
}

function iou(a, b) {
  const overR = Math.max(0, Math.min(a[0] + a[2] / 2, b[0] + b[2] / 2) - Math.max(a[0] - a[2] / 2, b[0] - b[2] / 2));
  const overC = Math.max(0, Math.min(a[1] + a[2] / 2, b[1] + b[2] / 2) - Math.max(a[1] - a[2] / 2, b[1] - b[2] / 2));
  return overR * overC / (a[2] * a[2] + b[2] * b[2] - overR * overC);
}

/* Every cluster, then the strongest — not the cluster around whichever
   single window happened to score highest.

   That distinction turned out to matter. Anchoring on the top window
   meant one stray detection could capture the cluster and the real face
   never got counted, and it showed up backwards: widening the search
   made detection WORSE, because the extra scales produced more strays
   for the anchor to land on. Whole clusters compared by total score
   don't have that failure.

   The total is a sum, as in pico's own clusterer: one window liking a
   region is a maybe, six overlapping windows liking it is a face. */
function clusterBest(dets, threshold) {
  if (!dets.length) return null;
  dets.sort((a, b) => b[3] - a[3]);
  const taken = new Array(dets.length).fill(false);
  let winner = null;
  for (let i = 0; i < dets.length; i++) {
    if (taken[i]) continue;
    let r = 0, c = 0, s = 0, q = 0, n = 0;
    for (let j = i; j < dets.length; j++) {
      if (taken[j]) continue;
      if (iou(dets[i], dets[j]) > threshold) {
        taken[j] = true;
        r += dets[j][0]; c += dets[j][1]; s += dets[j][2]; q += dets[j][3]; n++;
      }
    }
    if (n && (!winner || q > winner[3])) winner = [r / n, c / n, s / n, q];
  }
  return winner;
}

/* A face, in fractions of the frame: { x, y, size } with x/y the centre
   and size the diameter, all 0–1 so the caller never has to care what
   resolution we sampled at. null when there isn't one.

   Every number below was measured, and every first guess was wrong. A
   1.15 scale step and a 0.12 shift stepped straight over the face; a
   minimum quality of 40 rejected everything.

   The settled grid — 240px wide, windows from 12% of the frame, a 0.06
   shift, a 1.1 scale step — measured across four scenes:

       face filling the frame    41
       face at half the frame    34
       a blank striped wall       0
       average                   39ms

   A coarser 0.1 shift ran in 10ms but scored real faces at only 10–13,
   which is too close to nothing to threshold safely. 39ms is too slow
   for every frame at 30fps and does not need to be: detection runs a
   few times a second and the tracker eases between, which is also what
   stops a hat shivering.

   `minQuality` sits at 15 — far above the 0 a wall scores and far below
   the 34 a real face does. A lens that jumps onto a doorframe is much
   worse than one that waits a beat.

   Known limit: a face smaller than about 12% of the frame height isn't
   found. For a selfie that never happens; for someone across a room it
   does, and the lens stays where you put it. */
export function findFace(video, { minQuality = 15, width = 240 } = {}) {
  if (!classify || !video) return null;
  const img = grayscale(video, width);
  if (!img) return null;

  const shiftfactor = 0.06;
  const scalefactor = 1.1;
  const minsize = Math.max(24, Math.round(img.h * 0.12));
  const maxsize = Math.round(img.h * 0.95);

  const dets = [];
  let scale = minsize;
  while (scale <= maxsize) {
    const step = Math.max(shiftfactor * scale, 1) >> 0;
    const off = (scale / 2 + 1) >> 0;
    for (let r = off; r <= img.h - off; r += step) {
      for (let c = off; c <= img.w - off; c += step) {
        const q = classify(r, c, scale, img.gray, img.w);
        if (q > 0.0) dets.push([r, c, scale, q]);
      }
    }
    scale *= scalefactor;
  }
  const best = clusterBest(dets, 0.2);
  if (!best || best[3] < minQuality) return null;
  return { x: best[1] / img.w, y: best[0] / img.h, size: best[2] / img.h, q: best[3] };
}

/* ── Holding still ──
   Raw detections jitter by a few pixels every frame, and a hat that
   shivers on your head looks worse than one that sits where you put it.
   This eases toward each new reading, and — importantly — keeps the
   last good position for a moment when a frame comes back empty, so a
   blink or a turn doesn't make the lens vanish and reappear. */
export function makeFaceTracker({ ease = 0.35, holdMs = 700 } = {}) {
  let cur = null;
  let lastSeen = 0;
  return {
    push(face) {
      const now = Date.now();
      if (face) {
        lastSeen = now;
        if (!cur) cur = { ...face };
        else {
          cur.x += (face.x - cur.x) * ease;
          cur.y += (face.y - cur.y) * ease;
          cur.size += (face.size - cur.size) * ease;
        }
      } else if (cur && now - lastSeen > holdMs) {
        cur = null;
      }
      return cur ? { ...cur } : null;
    },
    get() { return cur ? { ...cur } : null; },
    reset() { cur = null; lastSeen = 0; },
  };
}
