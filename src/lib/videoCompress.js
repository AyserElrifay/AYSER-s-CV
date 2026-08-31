/* ─── MAKING A BIG VIDEO SMALL ENOUGH TO POST ─────────────────────────
   A 120MB clip off the camera roll came back "Could not start the
   upload (HTTP 413)" — the server refused it before a single byte went
   anywhere. Telling somebody to go and trim their own video is not an
   answer; the app should do it.

   So we re-encode: play the file, draw it into a canvas at a sane size,
   and record that back out at a bitrate chosen so the result lands
   under the size the server takes — with the original's own audio track
   carried across, because a compressed video that lost its sound is a
   different bug, not a fix.

   THREE THINGS THIS IS CAREFUL ABOUT

   It happens in real time. There is no way around that in a browser:
   one second of video takes one second to re-encode. So it reports
   progress and it can be cancelled.

   It never silently loses the sound. If the browser will not hand us
   the audio track, and the file has audio, we do not compress at all —
   we hand back the original and let the caller decide.

   It checks its own work. WebKit has shipped versions where a canvas
   capture records perfectly valid, perfectly black video. So the
   result is decoded, measured and looked at before it is trusted; if
   anything is off, the original is what gets uploaded.               */

export const REEL_MAX_SECONDS = 180;        // three minutes
const TARGET_BYTES = 36 * 1024 * 1024;      // comfortably inside every limit
const MAX_LONG_SIDE = 1280;
const AUDIO_BPS = 96000;
const MAX_VIDEO_BPS = 2500000;
const MIN_VIDEO_BPS = 900000;

const isWeb = () => typeof document !== 'undefined' && typeof window !== 'undefined';

/* Load a file into a <video> and wait until it can tell us about
   itself. Some containers report Infinity for duration until you seek
   to the end, which is the one trick this needs to know. */
export function probeVideo(src) {
  return new Promise((resolve) => {
    if (!isWeb()) return resolve(null);
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    let done = false;
    const finish = (out) => {
      if (done) return;
      done = true;
      if (typeof src !== 'string') { try { URL.revokeObjectURL(url); } catch (e) {} }
      resolve(out);
    };
    el.onerror = () => finish(null);
    el.onloadedmetadata = () => {
      if (el.duration === Infinity || Number.isNaN(el.duration)) {
        // force it to work the real length out
        el.currentTime = 1e6;
        el.ontimeupdate = () => {
          el.ontimeupdate = null;
          el.currentTime = 0;
          finish({ seconds: el.duration, width: el.videoWidth, height: el.videoHeight });
        };
        return;
      }
      finish({ seconds: el.duration, width: el.videoWidth, height: el.videoHeight });
    };
    setTimeout(() => finish(null), 9000);
    el.src = url;
  });
}

/* Is this worth re-encoding, and can we? */
export function needsCompressing(bytes, seconds) {
  if (seconds != null && seconds > REEL_MAX_SECONDS + 0.5) return true;
  return bytes > TARGET_BYTES;
}

/* ─── WHAT TO DO WITH A VIDEO SOMEBODY CHOSE ─────────────────────────
   Pulled out as one pure function for one reason: this decision was
   wrong for months and nothing could catch it, because catching it
   needed a real twenty-minute file in a real browser.

   What it got wrong: a reel is capped at three minutes, and the cap
   was applied to the long-form Video tab as well. Anything longer went
   to the compressor, which re-records by playing the file back in real
   time and stops at the cap — so posting a ten-minute video meant
   waiting ten minutes to get three minutes of it, or being told "a
   reel goes up to 3" about a video posted to the tab whose whole point
   is that it is long.

   Long-form does not shrink and does not cut. It goes as it is, and
   only the real ceiling on the bucket can stop it.

   'send' upload what was chosen · 'shrink' re-encode first ·
   'refuse' say why, in megabytes.                                    */
export function videoPlan({ bytes, seconds, longForm, maxBytes }) {
  if (longForm) {
    return (maxBytes && bytes > maxBytes) ? { action: 'refuse', why: 'too-big' } : { action: 'send' };
  }
  if (seconds != null && seconds > REEL_MAX_SECONDS + 0.5) return { action: 'shrink', why: 'too-long' };
  return bytes > TARGET_BYTES ? { action: 'shrink', why: 'too-big' } : { action: 'send' };
}

/* Exported so the check can assert against the real numbers rather
   than a copy of them that drifts. */
export const VIDEO_LIMITS = { REEL_MAX_SECONDS, TARGET_BYTES };

const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  const want = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const m of want) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
  }
  return null;
};

/* Look at a frame of the finished file. A recording that is technically
   perfect and entirely black is a real thing browsers do, and shipping
   one would be worse than not compressing at all. */
function frameLooksReal(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { URL.revokeObjectURL(url); } catch (e) {}
      resolve(ok);
    };
    el.onerror = () => finish(false);
    el.onloadeddata = () => {
      const go = () => {
        try {
          const c = document.createElement('canvas');
          c.width = 64; c.height = 64;
          const ctx = c.getContext('2d');
          ctx.drawImage(el, 0, 0, 64, 64);
          const d = ctx.getImageData(0, 0, 64, 64).data;
          let lit = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 12 || d[i + 1] > 12 || d[i + 2] > 12) lit++;
          }
          finish(lit > 64 * 64 * 0.02);      // 2% of the frame is not black
        } catch (e) { finish(true); }        // can't look → don't condemn it
      };
      if (el.duration && el.duration > 0.6) {
        el.onseeked = go;
        try { el.currentTime = Math.min(0.8, el.duration / 2); } catch (e) { go(); }
      } else go();
    };
    setTimeout(() => finish(false), 8000);
    el.src = url;
  });
}

/* ── the re-encode ─────────────────────────────────────────────────
   Returns { blob, ext, contentType, seconds, from, to } when it worked,
   or null when the honest answer is "use the original". Never throws
   for an ordinary failure — a compressor that breaks posting is worse
   than one that does nothing. */
export async function compressVideo(src, opts) {
  const o = opts || {};
  const onProgress = o.onProgress || (() => {});
  const signal = o.signal;
  const maxSeconds = o.maxSeconds || REEL_MAX_SECONDS;
  if (!isWeb() || typeof MediaRecorder === 'undefined') return null;

  const mime = pickMime();
  if (!mime) return null;

  const srcBytes = typeof src === 'string' ? 0 : (src.size || 0);
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  const el = document.createElement('video');
  el.src = url;
  /* NOT muted. A muted element hands out a silent audio track — the
     capture is of the element's OUTPUT, and a muted element outputs
     silence — so muting it here would have produced exactly the
     soundless re-encode this module promises to refuse, while passing
     its own "is there an audio track" check. Nobody hears it because
     the sound is routed into the recorder and never to the speakers,
     which is what the audio graph below is for. */
  el.muted = false;
  el.volume = 1;
  el.playsInline = true;
  el.preload = 'auto';

  let audioCtx = null;
  const cleanup = () => {
    try { el.pause(); } catch (e) {}
    el.src = '';
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
    if (typeof src !== 'string') { try { URL.revokeObjectURL(url); } catch (e) {} }
  };

  try {
    await new Promise((resolve, reject) => {
      el.onloadedmetadata = resolve;
      el.onerror = () => reject(new Error('cannot read that video'));
      setTimeout(() => reject(new Error('took too long to open')), 12000);
    });

    const srcW = el.videoWidth, srcH = el.videoHeight;
    if (!srcW || !srcH) { cleanup(); return null; }
    const full = Number.isFinite(el.duration) ? el.duration : maxSeconds;
    const seconds = Math.min(full, maxSeconds);
    if (!(seconds > 0.3)) { cleanup(); return null; }

    /* THE AUDIO. The soundtrack is pulled through an audio graph rather
       than off the element's own captured stream: the graph gives a
       real track whatever the element's volume is doing, and because it
       is never connected to the speakers, re-encoding stays silent to
       whoever is sitting there. If the file has sound and we cannot
       carry it, we do not compress at all — losing the sound to save
       bytes is not a trade anybody asked for. */
    let audioTracks = [];
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        const source = audioCtx.createMediaElementSource(el);
        const sink = audioCtx.createMediaStreamDestination();
        source.connect(sink);                 // to the recorder, and nowhere else
        audioTracks = sink.stream.getAudioTracks();
      }
    } catch (e) { audioTracks = []; }
    if (!audioTracks.length) {
      // fall back to the element's own capture, where the browser has it
      try {
        const grab = el.captureStream || el.mozCaptureStream;
        if (grab) audioTracks = grab.call(el).getAudioTracks();
      } catch (e) { audioTracks = []; }
    }
    if (!audioTracks.length) {
      // does it have sound at all? if we can't tell, assume it does
      const probablySilent = el.mozHasAudio === false
        || (el.audioTracks && el.audioTracks.length === 0);
      if (!probablySilent) { cleanup(); return null; }
    }

    const scale = Math.min(1, MAX_LONG_SIDE / Math.max(srcW, srcH));
    const w = Math.round(srcW * scale / 2) * 2;
    const h = Math.round(srcH * scale / 2) * 2;

    const budget = Math.max(0, TARGET_BYTES * 8 - AUDIO_BPS * seconds);
    const videoBps = Math.max(MIN_VIDEO_BPS, Math.min(MAX_VIDEO_BPS, Math.floor(budget / seconds)));

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!canvas.captureStream) { cleanup(); return null; }
    const out = canvas.captureStream(30);
    audioTracks.forEach((t) => { try { out.addTrack(t); } catch (e) {} });

    const rec = new MediaRecorder(out, {
      mimeType: mime,
      videoBitsPerSecond: videoBps,
      audioBitsPerSecond: AUDIO_BPS,
    });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      try { ctx.drawImage(el, 0, 0, w, h); } catch (e) {}
    };

    const finished = new Promise((resolve) => { rec.onstop = resolve; });
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      try { if (rec.state !== 'inactive') rec.stop(); } catch (e) {}
    };

    let cancelled = false;
    const onAbort = () => { cancelled = true; stop(); };
    if (signal) signal.addEventListener('abort', onAbort);

    el.currentTime = 0;
    if (audioCtx && audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch (e) {} }
    await el.play();
    draw();
    rec.start(1000);

    const tick = setInterval(() => {
      onProgress(Math.max(0, Math.min(1, el.currentTime / seconds)));
      if (el.currentTime >= seconds - 0.05) stop();
    }, 250);
    el.onended = stop;

    await finished;
    clearInterval(tick);
    if (signal) signal.removeEventListener('abort', onAbort);
    cleanup();
    if (cancelled) return null;

    const type = (rec.mimeType || mime).split(';')[0];
    const blob = new Blob(chunks, { type });
    const ext = /mp4/.test(type) ? 'mp4' : /quicktime/.test(type) ? 'mov' : 'webm';

    // it has to be smaller, and it has to be real
    if (!blob.size) return null;
    if (srcBytes && blob.size >= srcBytes && full <= maxSeconds) return null;
    if (!(await frameLooksReal(blob))) return null;
    const check = await probeVideo(blob);
    if (!check || !check.width) return null;

    onProgress(1);
    return { blob, ext, contentType: type, seconds, from: srcBytes, to: blob.size };
  } catch (e) {
    cleanup();
    return null;
  }
}
