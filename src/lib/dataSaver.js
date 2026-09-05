/* ─── SOMEBODY ELSE'S DATA BUNDLE ────────────────────────────────────
   Ayser: "خلي يبقي في اوبشن data saver عشان متخلص نت الناس بhigh
   quality... و دي ممكن نعملها من الsettings او تختار كوليتي من الفديو
   منول او auto حسب نت باقه ولا WiFi".

   He is describing the difference between an app you can afford to
   have open and one you cannot. A feed that quietly downloads every
   video it scrolls past is the second kind, and in Egypt — where a
   monthly bundle is a real number people watch — that is the whole
   difference between using this app and deleting it.

   What this decides is not a "quality" — see the note at the bottom
   about why that word cannot mean what it usually means here — but
   the two things that actually spend the bundle:

     • whether a video plays by itself when it scrolls past you, and
     • how much of a video is downloaded before you ask for it.

   Three settings, and the middle one is the one that matters:

     high   — always play, always ready. For Wi-Fi and big bundles.
     saver  — never play by itself, download almost nothing until you
              tap. Nothing moves unless you asked it to.
     auto   — the browser is asked what kind of connection this is,
              and saver behaviour is used on a slow or metered one.

   All of it is a pure function of the setting plus what the browser
   reports, so it can be checked without a phone or a network:

       node scripts/check-data-saver.mjs
*/

export const DATA_MODES = ['auto', 'high', 'saver'];
export const DEFAULT_DATA_MODE = 'auto';

/* What the browser will tell us, where it tells us anything at all.
   Safari on iOS reports none of this, which is why "auto" has to fail
   towards playing rather than towards a dead feed: an app that behaves
   as if every connection were 2G is broken in a quieter way. */
export function networkHint(nav) {
  const n = nav || (typeof navigator !== 'undefined' ? navigator : null);
  const c = n && (n.connection || n.mozConnection || n.webkitConnection);
  if (!c) return { known: false, save: false, slow: false, cellular: false };
  const type = String(c.effectiveType || '');
  return {
    known: true,
    /* the person has switched on Data Saver in their own browser or
       phone. That is not a hint, it is an instruction. */
    save: !!c.saveData,
    slow: type === 'slow-2g' || type === '2g' || type === '3g',
    cellular: c.type === 'cellular',
  };
}

export function isSaving(mode, nav) {
  if (mode === 'saver') return true;
  if (mode === 'high') return false;
  const n = networkHint(nav);
  return !!(n.save || n.slow || n.cellular);
}

/* ── WHAT A VIDEO ON A CARD IS ALLOWED TO DO ─────────────────────────
   `hasPoster` is not a detail. A <video preload="none"> with no poster
   is a black rectangle, which is the exact fault we just spent a
   commit removing — so a clip with no still of its own still fetches
   its metadata even in saver mode. That is tens of kilobytes for the
   header and one frame, against the megabytes of the video itself. */
export function videoPolicy(mode, { hasPoster, reducedMotion, nav } = {}) {
  const saving = isSaving(mode, nav);
  return {
    saving,
    /* a clip that starts moving because you scrolled near it is the
       single biggest way a feed spends a bundle */
    autoplay: !saving && !reducedMotion,
    preload: saving ? (hasPoster ? 'none' : 'metadata') : 'metadata',
  };
}

/* ── AND THE WORD "QUALITY", HONESTLY ────────────────────────────────
   Picking 480p or 720p for a clip means the server holds several
   encodings of it and hands over whichever was asked for. We hold
   exactly one file: the one that was uploaded. Nothing in this app can
   offer a smaller version of it, and a menu that pretended to would be
   a lie with a spinner on it.

   What IS true is above: not playing what you did not ask to see, and
   not downloading what you are not watching. That is most of the bill
   on a feed. Real renditions need a transcoding step at upload —
   worth doing, and a different piece of work. */
