/* ─── THINGS TO JOIN, STANDING ON THE MAP ─────────────────────────────
   Ayser: "شكل خريطة حلو… اكتفيتز و صورهم عليها و شكلها colourful
   playful".

   Each gathering this week becomes a little card at the real place it
   meets: a bright colour for the kind of thing it is, a drawing of it,
   the day and the time, and how many people have really said they are
   going. No count is padded and nothing is placed where it does not
   meet — a plan without a point stays on the list and off the map.

   Pure, so it can be checked without a map:

       node scripts/check-map-activities.mjs
*/

export const ACTIVITY_LOOK = {
  culture: { emoji: '🎭', from: '#F43F5E', to: '#F59E0B' },
  walk:    { emoji: '🥾', from: '#10B981', to: '#84CC16' },
  sport:   { emoji: '⚽', from: '#3B82F6', to: '#06B6D4' },
  art:     { emoji: '🎨', from: '#A855F7', to: '#EC4899' },
  circle:  { emoji: '💬', from: '#F59E0B', to: '#FB7185' },
  cleanup: { emoji: '🌿', from: '#059669', to: '#34D399' },
  project: { emoji: '🔨', from: '#6366F1', to: '#8B5CF6' },
  run:     { emoji: '🏃', from: '#EF4444', to: '#F97316' },
  coffee:  { emoji: '☕', from: '#B45309', to: '#F59E0B' },
  focus:   { emoji: '📚', from: '#0EA5E9', to: '#6366F1' },
};
const FALLBACK = { emoji: '✨', from: '#7C3AED', to: '#EC4899' };

export const lookOf = (kind) => ACTIVITY_LOOK[kind] || FALLBACK;

/* "Opera night · ليلة أوبرا" carries both languages; the map shows the
   one you read — Arabic to an Arabic reader, the other half to anyone
   else — and the whole title when it has only one. */
export function titleFor(title, lang) {
  const s = String(title || '');
  const parts = s.split(' · ');
  if (parts.length !== 2) return s;
  const arabic = (x) => /[؀-ۿ]/.test(x);
  const [a, b] = parts;
  if (lang === 'ar') return arabic(b) ? b : arabic(a) ? a : s;
  return arabic(b) ? a : arabic(a) ? b : s;
}

/* "Thu 19:30" in the reader's language, in the city's own time — the
   time on the poster at the door, wherever the phone happens to be. */
export function whenFor(iso, lang, tz = 'Africa/Cairo') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const day = new Intl.DateTimeFormat(lang || 'en', { weekday: 'short', timeZone: tz }).format(d);
    const time = new Intl.DateTimeFormat(lang || 'en', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(d);
    return day + ' ' + time;
  } catch (e) { return d.toISOString().slice(11, 16); }
}

export function activityPin(g, lang) {
  const look = lookOf(g.kind);
  const going = Number.isFinite(Number(g.going)) ? Math.max(0, Math.floor(Number(g.going))) : 0;
  /* a small fixed tilt per gathering, so a cluster of cards looks
     dropped on the map by hand rather than printed in a grid */
  let h = 0; for (const ch of String(g.id)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return {
    id: 'ga_' + g.id, srcId: g.id, kind: 'activity',
    lat: g.lat, lng: g.lng,
    emoji: look.emoji, from: look.from, to: look.to,
    tilt: (Math.abs(h) % 9) - 4,
    label: titleFor(g.title, lang),
    when: whenFor(g.starts_at, lang),
    going,
    mine: !!g.im_going,
  };
}
