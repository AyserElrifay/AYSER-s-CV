/* ─── PEOPLE OUT TOGETHER, TO SET THE MOOD ───────────────────────────
   Free-licence photos (Pexels) of people out together, used only as a
   mood — behind "start one here", on the welcome — never captioned or
   shown as somebody on Moments. A different one each day, the same one
   all day. */
export const MOODS = Array.from({ length: 12 }, (_, i) => 'mood-' + (i + 1) + '.jpg');
export const moodOfToday = (offset = 0) => MOODS[(Math.floor(Date.now() / 86400000) + offset) % MOODS.length];
