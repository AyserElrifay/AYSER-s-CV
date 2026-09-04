/* ─── HOW LONG IS THIS VIDEO ──────────────────────────────────────────
   The card on the feed said "▶ WATCH · undefined". Not once, not on a
   broken post — on every video ever posted, because the chip was built
   as `'▶ WATCH · ' + post.duration` and nothing anywhere ever put a
   duration on a post. A row came out of the database, went through
   toCard, and the field simply was not there; JavaScript turned the
   missing thing into the word for it and printed it on the picture.

   So: a real length, kept on the post, and a label made from it here.
   Nothing else in the app should have to remember that 605 seconds is
   "10:05" and that 3725 is "1:02:05".

   Returns null when there is no length to show — which is the whole
   point, because a card with no duration must say "▶ WATCH" and not
   the word undefined. */
export function clockLabel(seconds) {
  const s = Math.round(Number(seconds));
  if (!Number.isFinite(s) || s <= 0) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  return h ? h + ':' + pad(m) + ':' + pad(sec) : m + ':' + pad(sec);
}

/* What to write on a video's chip. One place, so the "· 10:05" half can
   disappear without the "▶ WATCH" half disappearing with it. */
export function watchLabel(seconds) {
  const d = clockLabel(seconds);
  return d ? '▶ WATCH · ' + d : '▶ WATCH';
}
