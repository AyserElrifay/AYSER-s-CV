/* ─── PICKING THE PICTURE A VIDEO SHOWS ───────────────────────────────
   Ayser: "خلي الريل يبقي ليها cover منها automatic بتختاره منها او الي
   بنزل الريل يقدر يعمل edite وهو بينزلها او بعد ما ينزلها و يحطه".

   Three things, in order of how much they matter:

     1. every clip gets a cover automatically, and it must not be a
        black frame — a video that opens on a dark second becomes a
        black tile in the grid and a black card in the feed, which is
        exactly the complaint that started all this;
     2. whoever posts it can choose a different frame while posting;
     3. and change it afterwards, which means pulling frames back out
        of a file that is already on the server.

   (3) is the one with a real obstacle: a canvas that has drawn a video
   from another origin is "tainted" and refuses to be read back. The
   storage bucket sends the header that allows it, so asking for the
   video with crossOrigin set usually works — and when it does not,
   this says so plainly rather than throwing, and the screen offers to
   use a picture from the phone instead.

   The scoring is checkable without a browser:

       node scripts/check-cover.mjs
*/

/* How lit and how varied a frame is. A frame that is all one colour is
   a fade, a wall or a blackout, whatever its brightness — so both
   halves matter, and a picture of a bright white wall is no better a
   cover than a picture of the dark. */
export function frameScore(pixels) {
  if (!pixels || !pixels.length) return 0;
  let sum = 0;
  const lum = new Array(Math.floor(pixels.length / 4));
  for (let i = 0, k = 0; i + 3 < pixels.length; i += 4, k++) {
    const l = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    lum[k] = l;
    sum += l;
  }
  const n = lum.length || 1;
  const mean = sum / n;
  let varc = 0;
  for (let k = 0; k < n; k++) { const d = lum[k] - mean; varc += d * d; }
  const sd = Math.sqrt(varc / n);
  /* Nearly black or nearly white is not a cover at any variance: the
     first is a blackout, the second is a flash. */
  if (mean < 12 || mean > 245) return 0;
  /* Brightness gets you in the door; detail is what wins. */
  return Math.round(sd * 10 + Math.min(mean, 160) / 4);
}

export function pickBest(frames) {
  if (!frames || !frames.length) return -1;
  let best = -1, score = -1;
  frames.forEach((f, i) => {
    const s = typeof f.score === 'number' ? f.score : 0;
    if (s > score) { score = s; best = i; }
  });
  /* Every frame scored zero — a clip that really is black all through.
     Return the first rather than nothing: a cover somebody can see and
     reject beats an empty strip that explains nothing. */
  return best === -1 || score <= 0 ? 0 : best;
}

/* Where along the clip to sample. Never the very first frame (a lot of
   phones start on a dark or half-exposed one) and never the very last
   (it is often a cut to black), so the strip walks the middle. */
export function frameTimes(seconds, count) {
  const dur = Number(seconds);
  const n = Math.max(1, Math.floor(count) || 1);
  if (!Number.isFinite(dur) || dur <= 0) return [0.1];
  const first = Math.min(0.15, dur / 20);
  const last = Math.max(first, dur - Math.min(0.3, dur / 20));
  if (n === 1) return [first + (last - first) / 2];
  const step = (last - first) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round((first + i * step) * 1000) / 1000);
}

/* A cheap fingerprint of a frame, used for one question only: did
   seeking actually move? Two frames that fingerprint the same are the
   same picture. */
export function signature(pixels) {
  if (!pixels || !pixels.length) return '0';
  let s = '';
  const step = Math.max(4, Math.floor(pixels.length / 64 / 4) * 4);
  for (let i = 0; i + 2 < pixels.length; i += step) {
    s += String.fromCharCode(65 + Math.min(25, Math.floor(pixels[i] / 10)));
  }
  return s;
}

/* ── AND THE ACTUAL FRAMES ───────────────────────────────────────────
   Browser-only. Resolves to { frames, blocked } — `blocked` is true
   when the file could not be read back (a tainted canvas), which is a
   different situation from "no frames" and leads somewhere different
   on screen. Never throws: a cover is a nicety, and a nicety must not
   take a post down with it. */
export async function grabFrames(src, count = 6, { crossOrigin } = {}) {
  if (typeof document === 'undefined' || !src) return { frames: [], blocked: false };
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  if (crossOrigin) el.crossOrigin = 'anonymous';
  el.src = src;

  const ready = await new Promise((resolve) => {
    let done = false;
    const ok = () => { if (!done) { done = true; resolve(true); } };
    const no = () => { if (!done) { done = true; resolve(false); } };
    el.onloadeddata = ok;
    el.onerror = no;
    setTimeout(no, 8000);
  });
  if (!ready || !el.videoWidth) { try { el.src = ''; } catch (e) {} return { frames: [], blocked: false }; }

  const times = frameTimes(el.duration, count);
  const w = Math.min(360, el.videoWidth);
  const h = Math.max(1, Math.round(w * (el.videoHeight / el.videoWidth)));
  const big = document.createElement('canvas');
  big.width = w; big.height = h;
  const bx = big.getContext('2d');
  const small = document.createElement('canvas');
  small.width = 48; small.height = Math.max(1, Math.round(48 * (h / w)));
  const sx = small.getContext('2d', { willReadFrequently: true });

  const frames = [];
  let blocked = false;
  for (const t of times) {
    const seeked = await new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      el.onseeked = () => fin(true);
      el.onerror = () => fin(false);
      setTimeout(() => fin(false), 4000);
      try { el.currentTime = t; } catch (e) { fin(false); }
    });
    if (!seeked) continue;
    try {
      bx.drawImage(el, 0, 0, w, h);
      sx.drawImage(el, 0, 0, small.width, small.height);
      const data = sx.getImageData(0, 0, small.width, small.height).data;  // throws if tainted
      frames.push({ t, url: big.toDataURL('image/jpeg', 0.85), score: frameScore(data), sig: signature(data) });
    } catch (e) {
      blocked = true;     // cross-origin: we can show the video, not read it
      break;
    }
  }

  /* ── WHEN SEEKING DOES NOTHING ────────────────────────────────────
     A clip recorded by the browser's own MediaRecorder has no seek
     index in it. Setting currentTime on one appears to work — the
     event fires, no error — and hands back the same frame every time.
     A strip of six identical pictures is worse than no strip: it looks
     like a choice and is not one.

     So: if every frame came out identical, take them the only other
     way there is, by playing the clip and grabbing as it goes. Fast
     enough to be worth it on the short clips this happens to; skipped
     on long ones, where seeking works anyway and a play-through would
     mean minutes of waiting. */
  const same = frames.length > 1 && frames.every((f) => f.sig === frames[0].sig);
  if (same && Number.isFinite(el.duration) && el.duration > 0 && el.duration <= 90) {
    const played = await sampleWhilePlaying(el, times, { bx, w, h, sx, small, big });
    if (played.length > 1) { frames.length = 0; played.forEach((f) => frames.push(f)); }
  }

  try { el.src = ''; } catch (e) {}
  return { frames, blocked };
}

/* Playing is the fallback, not the plan: it takes real time, so it runs
   at eight times speed and gives up after a clip's length plus a
   little. Muted, off-screen, and the element is thrown away after. */
async function sampleWhilePlaying(el, times, kit) {
  const out = [];
  const wanted = times.slice();
  try {
    el.muted = true;
    el.playbackRate = 8;
    el.currentTime = 0;
    await el.play();
  } catch (e) { return out; }
  await new Promise((resolve) => {
    const done = () => { try { el.pause(); } catch (e) {} resolve(); };
    const tick = () => {
      while (wanted.length && el.currentTime >= wanted[0]) {
        const t = wanted.shift();
        try {
          kit.bx.drawImage(el, 0, 0, kit.w, kit.h);
          kit.sx.drawImage(el, 0, 0, kit.small.width, kit.small.height);
          const data = kit.sx.getImageData(0, 0, kit.small.width, kit.small.height).data;
          out.push({ t, url: kit.big.toDataURL('image/jpeg', 0.85), score: frameScore(data), sig: signature(data) });
        } catch (e) { wanted.length = 0; }
      }
      if (!wanted.length) done();
    };
    el.ontimeupdate = tick;
    el.onended = done;
    setTimeout(done, Math.min(30000, (el.duration / 8) * 1000 + 4000));
  });
  el.ontimeupdate = null;
  el.onended = null;
  return out;
}
