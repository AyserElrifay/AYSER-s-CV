/* ─── SOUND ON A REEL ─────────────────────────────────────────────────
   Every reel played silently. Not because the file had no sound — the
   camera records audio and the upload keeps it — but because every
   player in the app set muted and nothing ever offered to turn it back
   on. From where anybody is sitting that is "my video went up without
   sound", and they are right to call it that.

   A browser will only autoplay a video that starts muted, so the first
   frame still has to be silent. What was missing is everything after:
   a way to turn it on, and the app remembering that you did.

   One preference, shared by every player, so turning the sound on in
   one reel means the next one already has it.                        */

const KEY = 'mm_reel_sound';
const listeners = new Set();
let on = null;   // read lazily, so this file is safe to import anywhere

export function soundOn() {
  if (on === null) {
    try { on = localStorage.getItem(KEY) === '1'; } catch (e) { on = false; }
  }
  return on;
}

export function setSoundOn(next) {
  on = !!next;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
  listeners.forEach((fn) => { try { fn(on); } catch (e) {} });
}

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Wire one <video> to the preference. Handles the part that is easy to
   get wrong: a browser blocks an unmuted play() until the person has
   touched the page, so we ask, and if we are refused we go back to
   muted rather than leaving a video that has stopped playing. */
export function applySound(el) {
  if (!el) return;
  const want = soundOn();
  el.muted = !want;
  el.volume = 1;
  const p = el.play();
  if (p && p.catch) {
    p.catch(() => {
      el.muted = true;
      el.play().catch(() => {});
    });
  }
}

/* Does this file actually carry a soundtrack? Browsers only tell us
   once enough has been decoded, and Safari does not tell us at all, so
   this is "yes / don't know" rather than a promise — used only to keep
   the button from claiming sound that isn't there. */
export function hasAudio(el) {
  if (!el) return true;
  if (typeof el.mozHasAudio === 'boolean') return el.mozHasAudio;
  if (el.audioTracks && typeof el.audioTracks.length === 'number') return el.audioTracks.length > 0;
  if (typeof el.webkitAudioDecodedByteCount === 'number' && el.currentTime > 0.4) {
    return el.webkitAudioDecodedByteCount > 0;
  }
  return true;
}
