/* ─── THE FIFTEEN SECONDS OF A SONG YOU ACTUALLY MEANT ───────────────
   A song is three minutes. A story is a few seconds of it. Which few
   is the whole point — nobody attaching a track wants the intro, they
   want the bit that lands, and until now they got whatever the file
   started with.

   ── Where the choice is kept ──
   In the URL, as a media fragment: `…/track.mp3#t=42,57`. That is a
   real W3C Media Fragments URI, not something invented here, and it
   means the window rides along inside `audio_url` through every mapper,
   every table column and every player that already exists. No new
   database columns, nothing for anyone to migrate, and a story posted
   before today still plays exactly as it did.

   Browsers do honour `#t=` on their own, but inconsistently at the end
   of the range and not at all once a clip loops. So the window is also
   enforced here, in code, against the element's own clock: seek to the
   start, and when the end goes past, come back. That is the part that
   makes a fifteen-second loop actually fifteen seconds. */

export const DEFAULT_LEN = 15;   // what you get without asking
export const MIN_LEN = 5;
export const MAX_LEN = 60;       // a minute, and no further

const round1 = (n) => Math.round(n * 10) / 10;

/* Attach a window to a track URL. A window that covers the whole song
   is no window at all, so it comes back clean. */
export function clipUrl(url, start, len) {
  if (!url || typeof url !== 'string') return url;
  const bare = url.split('#')[0];
  const s = Math.max(0, round1(Number(start) || 0));
  const l = Math.max(MIN_LEN, Math.min(MAX_LEN, round1(Number(len) || DEFAULT_LEN)));
  if (s === 0 && l >= MAX_LEN) return bare;
  return bare + '#t=' + s + ',' + round1(s + l);
}

/* Read one back. Anything unparseable means "the whole thing". */
export function parseClip(url) {
  if (!url || typeof url !== 'string') return null;
  const m = /#t=([0-9.]+)(?:,([0-9.]+))?/.exec(url);
  if (!m) return null;
  const start = parseFloat(m[1]);
  const end = m[2] != null ? parseFloat(m[2]) : null;
  if (!isFinite(start) || start < 0) return null;
  if (end != null && (!isFinite(end) || end <= start)) return null;
  return { start, end, len: end != null ? round1(end - start) : null };
}

/* Hold an <audio> (or <video>) element to the window in its own src.
   Returns a cleanup function; safe to call with anything, including
   null, and a no-op when the URL carries no window. */
export function holdToClip(el) {
  if (!el || typeof el.addEventListener !== 'function') return () => {};
  const clip = parseClip(el.currentSrc || el.src || '');
  if (!clip) return () => {};

  const seekToStart = () => {
    try { if (Math.abs(el.currentTime - clip.start) > 0.25) el.currentTime = clip.start; } catch (e) {}
  };
  const onTime = () => {
    if (clip.end != null && el.currentTime >= clip.end) seekToStart();
  };
  /* `loop` sends it back to 0, which is outside the window — so the
     second play-through would be the intro again. */
  const onEnded = seekToStart;

  el.addEventListener('loadedmetadata', seekToStart);
  el.addEventListener('timeupdate', onTime);
  el.addEventListener('ended', onEnded);
  if (el.readyState >= 1) seekToStart();

  return () => {
    el.removeEventListener('loadedmetadata', seekToStart);
    el.removeEventListener('timeupdate', onTime);
    el.removeEventListener('ended', onEnded);
  };
}

/* mm:ss, for the labels on the trimmer. */
export function clock(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
