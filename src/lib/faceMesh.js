/* ─── THE FACE, NOT JUST WHERE IT IS ──────────────────────────────────
   Ayser, wearing the beard: "محتاجة تنزل أكتر على حسب الوش وتبقى 3D،
   عملية وفيزيائيًا مظبوطة". The cascade in faceDetect.js knows one
   thing — a square where a face is. It cannot know that the head is
   tilted, turned, or where the chin ends, so a beard floated in front
   of the face like a sticker.

   This reads the face itself: MediaPipe's face landmarker (Apache-2.0),
   478 points, from which come the things a lens needs —
     · where the face is and how wide (cheek to cheek)
     · roll: the eye line's tilt, so a hat tilts with the head
     · yaw: how far the head is turned, so the art narrows as it turns
     · the chin, the eyes and the forehead, so each lens sits on its
       own part of the face (placeOnFace in lensArt.js)

   ── Weight, honestly ──
   13 MB (a 3.7 MB model and a 9.5 MB runtime), and so: fetched from our
   own origin only the first time somebody picks a lens, kept by the
   service worker across releases (sw.js, FACE_CACHE), never in the
   app's own download. Nothing here may stop the camera: if any of it
   fails, `ready()` stays false and the cascade does the job it did
   before. */

let landmarker = null;
let loading = null;
let failed = false;

const base = () => {
  if (typeof window === 'undefined') return '';
  const b = (window.location.pathname.match(/^(.*\/)/) || ['/'])[0];
  return b.replace(/\/+$/, '') + '/mediapipe';
};

export function meshReady() { return !!landmarker; }

export async function loadFaceMesh() {
  if (landmarker) return true;
  if (failed) return false;
  if (loading) return loading;
  loading = (async () => {
    try {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(base());
      const make = (delegate) => FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: base() + '/face_landmarker.task', delegate },
        runningMode: 'VIDEO', numFaces: 1,
      });
      // the GPU where there is one; some phones refuse it, and the CPU is fine
      try { landmarker = await make('GPU'); } catch (e) { landmarker = await make('CPU'); }
      return true;
    } catch (e) {
      failed = true;
      return false;
    } finally { loading = null; }
  })();
  return loading;
}

const P = (lm, i) => lm[i];
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/* One reading, in the same units the cascade used — x, y in 0..1 of the
   frame, size as a fraction of the frame HEIGHT — plus what only the
   points can say. All coordinates are of the camera's own frame (not
   mirrored); the caller flips them for the front camera. */
let lastTs = 0;
export function readFace(video) {
  if (!landmarker || !video || !video.videoWidth) return null;
  let ts = performance.now();
  if (ts <= lastTs) ts = lastTs + 1;     // the landmarker wants time to move forward
  lastTs = ts;
  let res;
  try { res = landmarker.detectForVideo(video, ts); } catch (e) { return null; }
  const lm = res && res.faceLandmarks && res.faceLandmarks[0];
  if (!lm) return null;
  const W = video.videoWidth, H = video.videoHeight;
  const px = (p) => ({ x: p.x * W, y: p.y * H });
  // the outer corners of the eyes, the cheeks, the nose, the chin, the brow
  const eL = px(P(lm, 33)), eR = px(P(lm, 263));
  const cL = px(P(lm, 234)), cR = px(P(lm, 454));
  const nose = px(P(lm, 1)), chin = px(P(lm, 152)), brow = px(P(lm, 10));
  const mouth = mid(px(P(lm, 13)), px(P(lm, 14)));
  const eyes = mid(eL, eR);
  const width = Math.hypot(cR.x - cL.x, cR.y - cL.y);
  const roll = Math.atan2(eR.y - eL.y, eR.x - eL.x);
  // how far the nose sits off the line between the cheeks: −1 … 1
  const cm = mid(cL, cR);
  const turn = Math.max(-1, Math.min(1, ((nose.x - cm.x) * Math.cos(roll) + (nose.y - cm.y) * Math.sin(roll)) / (width / 2)));
  const n = (p) => ({ x: p.x / W, y: p.y / H });
  /* The art in lensArt.js is drawn around one model face (its F table):
     eyes 0.14 above the middle, chin 0.62 below, in units of the face's
     width. Fit that model to THIS face — its eyes on these eyes, its chin
     on this chin, along the head's own up-and-down — and every piece of
     art lands on its part of the face: the beard on the jaw, the ears on
     the head, the nose on the nose. */
  const EYES = -0.14, CHIN = 0.62;
  const down = { x: -Math.sin(roll), y: Math.cos(roll) };          // the face's own "down"
  const reach = (chin.x - eyes.x) * down.x + (chin.y - eyes.y) * down.y;   // eyes to chin, along it
  const unitV = Math.max(1, reach / (CHIN - EYES));
  const unitH = width * 0.95;                                      // cheek to cheek ≈ temple to temple
  const mid0 = { x: eyes.x - down.x * EYES * unitV, y: eyes.y - down.y * EYES * unitV };
  const c = n(mid0);
  return {
    x: c.x, y: c.y,
    size: Math.hypot(chin.x - brow.x, chin.y - brow.y) / H,   // brow to chin, of the height
    width: unitH / H,
    ky: unitV / unitH,                                        // this face's height for its width
    roll, yaw: Math.asin(turn) ,
    eyes: n(eyes), chin: n(chin), brow: n(brow), mouth: n(mouth), nose: n(nose),
    mesh: true,
  };
}

/* Readings jitter; a beard that shivers is worse than one a beat late.
   Positions ease like the cascade's tracker, angles ease the short way
   round, and a lost face holds for a moment before letting go. */
export function makeMeshTracker({ ease = 0.45, holdMs = 700 } = {}) {
  let cur = null; let seenAt = 0;
  const mix = (a, b, k) => a + (b - a) * k;
  const mixP = (a, b, k) => ({ x: mix(a.x, b.x, k), y: mix(a.y, b.y, k) });
  return {
    reset() { cur = null; },
    push(f) {
      const now = Date.now();
      if (!f) { if (cur && now - seenAt > holdMs) cur = null; return cur; }
      seenAt = now;
      if (!cur) { cur = f; return cur; }
      const k = ease;
      cur = {
        ...f,
        x: mix(cur.x, f.x, k), y: mix(cur.y, f.y, k), size: mix(cur.size, f.size, k), width: mix(cur.width, f.width, k), ky: mix(cur.ky, f.ky, k),
        roll: cur.roll + Math.atan2(Math.sin(f.roll - cur.roll), Math.cos(f.roll - cur.roll)) * k,
        yaw: mix(cur.yaw, f.yaw, k),
        eyes: mixP(cur.eyes, f.eyes, k), chin: mixP(cur.chin, f.chin, k), brow: mixP(cur.brow, f.brow, k),
        mouth: mixP(cur.mouth, f.mouth, k), nose: mixP(cur.nose, f.nose, k),
      };
      return cur;
    },
  };
}

/* the front camera's picture is mirrored: flip x, and the angles with it */
export function mirrorFace(f) {
  if (!f) return f;
  const fx = (p) => (p ? { x: 1 - p.x, y: p.y } : p);
  return { ...f, x: 1 - f.x, roll: -f.roll, yaw: -f.yaw, eyes: fx(f.eyes), chin: fx(f.chin), brow: fx(f.brow), mouth: fx(f.mouth), nose: fx(f.nose) };
}
