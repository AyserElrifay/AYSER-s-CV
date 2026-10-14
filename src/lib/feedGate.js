/* ─── THE FEED HAS A DAILY WINDOW ─────────────────────────────────────
   Ayser's spec: the Moments feed is open for a short time each day.
   When the time is up — or once you have reached the end of the day's
   moments — it closes until tomorrow with a friendly line: put the
   phone down and go live it. Plans, the map, chats, posting and
   Reflection are never closed; only the scrolling is.

   Counted on this phone, while the feed is really on screen. It is a
   wellbeing nudge, not a rule anybody could be hurt by getting around,
   so it does not need the server. Volunteers get a few minutes more
   (Ayser: "لو حد بيتطوع كتير نفتحله وقت زيادة شوية صغيرين"). */

const KEY = 'mm.feedgate.v1';
export const FEED_MINUTES = 15;
export const VOLUNTEER_BONUS_MINUTES = 5;

const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export function readGate() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && v.day === today()) return { used: Number(v.used) || 0, done: !!v.done };
  } catch (e) {}
  return { used: 0, done: false };
}
function writeGate(g) {
  try { localStorage.setItem(KEY, JSON.stringify({ day: today(), used: g.used, done: g.done })); } catch (e) {}
}
export function addSeconds(sec) { const g = readGate(); g.used += sec; writeGate(g); return g; }
export function markSeenAll() { const g = readGate(); g.done = true; writeGate(g); return g; }
export const budgetSeconds = (volunteer) => (FEED_MINUTES + (volunteer ? VOLUNTEER_BONUS_MINUTES : 0)) * 60;
