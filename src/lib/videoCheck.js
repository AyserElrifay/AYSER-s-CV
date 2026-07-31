/* ─── IS THIS CLIP ACTUALLY SHOWING ANYTHING? ─────────────────────────
   Some reels recorded by Safari's own MediaRecorder come out as a file
   that plays perfectly and shows nothing — a valid container, valid
   duration, correct dimensions, and every frame black. Nothing can play
   them, because there is nothing in them.

   The old check asked whether the video had loaded: `videoWidth > 0 &&
   readyState >= 2`. A black file passes both. It has a width, it has
   frames, it is "ready" — so the check never fired on the exact case it
   was written for, and those reels sat there as a black rectangle with
   a like button on it, which reads as the app being broken.

   So ask the real question instead: put a frame on a canvas and look at
   it. Two samples a second apart, because a clip that genuinely opens
   on a dark shot shouldn't be condemned for its first frame.

   Fails open, always. A cross-origin video taints the canvas and makes
   `getImageData` throw; a browser without canvas can't sample at all.
   In every one of those cases we say nothing and let the clip play —
   wrongly telling somebody their video is broken is worse than staying
   quiet. */

const BLACK = 14;        // 0–255; below this a channel counts as black
const LIT = 0.02;        // fraction of pixels that must be lit to pass

function sampleIsBlank(video) {
  try {
    if (typeof document === 'undefined') return null;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const cv = document.createElement('canvas');
    cv.width = 32;
    cv.height = 32;
    const c = cv.getContext('2d', { willReadFrequently: true });
    if (!c) return null;
    c.drawImage(video, 0, 0, 32, 32);
    const d = c.getImageData(0, 0, 32, 32).data;   // throws if tainted
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > BLACK || d[i + 1] > BLACK || d[i + 2] > BLACK) lit++;
    }
    return lit / (d.length / 4) < LIT;
  } catch (e) {
    return null;                                   // can't tell — say nothing
  }
}

/* Watch a video element and call `onBlank()` only if we're confident it
   is showing nothing at all. Returns a cleanup function. */
export function watchForBlankVideo(video, onBlank) {
  if (!video || typeof window === 'undefined') return () => {};
  let stopped = false;
  const timers = [];

  const check = () => {
    if (stopped) return;
    const first = sampleIsBlank(video);
    if (first !== true) return;                    // fine, or unknowable
    timers.push(setTimeout(() => {
      if (stopped) return;
      // still nothing a second later, and it has actually been playing
      if (sampleIsBlank(video) === true && video.currentTime > 0.15) onBlank();
    }, 1100));
  };

  // give it a moment to get past the first frame before judging it
  timers.push(setTimeout(check, 1400));
  timers.push(setTimeout(check, 3200));

  return () => { stopped = true; timers.forEach(clearTimeout); };
}

/* A reel is a video. The old test asked whether the URL ended in
   `.mp4`, which quietly failed for anything stored without an
   extension — and a failed test meant no video element at all, so the
   screen went black with nothing to explain it. Trust what the row
   says first, and fall back to the filename only when nothing else
   tells us. */
export function looksPlayable(uri, knownVideo) {
  if (!uri || typeof uri !== 'string') return false;
  if (knownVideo) return true;
  return /\.(webm|mp4|mov|m4v|m3u8)(\?|#|$)/i.test(uri);
}
