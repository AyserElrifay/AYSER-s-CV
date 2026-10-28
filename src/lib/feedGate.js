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
export const FEED_MINUTES = 10;   // Ayser: "قلل وقت الفيد في اليوم"
export const VOLUNTEER_BONUS_MINUTES = 5;

const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/* Doing today's small things earns a little more time — and opens the
   feed again if it had closed (Ayser: "لما تخلص مهام النهارده ممكن
   يفتحلك وقت تاني إضافي"). Each counts once a day. */
export const TASKS = [
  { key: 'reflect', minutes: 5 },   // answered today's question
  { key: 'plan', minutes: 10 },     // said "I'm going" to a plan
  { key: 'todo', minutes: 15 },     // ticked a thing off My day
  { key: 'checkin', minutes: 30 },  // scanned the QR at a real table, circle or event
];

/* ─── WHO GETS HOW LONG ───────────────────────────────────────────────
   Ayser, October 2026 ("Earn your time"): Moments Basic keeps the short
   daily window; Moments+ gets a longer one; Moments Black — and anybody
   who has reached Moments Level 4 by really going out — has no clock at
   all. The tier and the level come from the server (my_membership,
   my_moments_level); they are kept here so the clock is right the moment
   Home opens, before either has answered. */
export const PLUS_MINUTES = 30;
export const OPEN_LEVEL = 4;
const PLAN = 'mm.feedplan.v1';
export function readPlan() {
  try { const v = JSON.parse(localStorage.getItem(PLAN) || 'null'); if (v) return { tier: v.tier || 'FREE', level: Number(v.level) || 1 }; } catch (e) {}
  return { tier: 'FREE', level: 1 };
}
export function writePlan(p) {
  const v = { ...readPlan(), ...p };
  try { localStorage.setItem(PLAN, JSON.stringify(v)); } catch (e) {}
  listeners.forEach((fn) => { try { fn(readGate()); } catch (e) {} });
  return v;
}
export const isUnlimited = (p) => !!p && (p.tier === 'VIP' || (Number(p.level) || 1) >= OPEN_LEVEL);

export function readGate() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && v.day === today()) return { used: Number(v.used) || 0, done: !!v.done, bonus: Number(v.bonus) || 0, earned: Array.isArray(v.earned) ? v.earned : [], at: Number(v.at) || 0 };
  } catch (e) {}
  return { used: 0, done: false, bonus: 0, earned: [], at: 0 };
}
function writeGate(g) {
  g.at = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify({ day: today(), used: g.used, done: g.done, bonus: g.bonus, earned: g.earned, at: g.at })); } catch (e) {}
}
const listeners = new Set();
export const onGate = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export function earnBonus(key) {
  const task = TASKS.find((x) => x.key === key);
  const g = readGate();
  if (!task || g.earned.indexOf(key) >= 0) return g;
  g.earned = g.earned.concat(key); g.bonus += task.minutes * 60; g.done = false;
  writeGate(g);
  listeners.forEach((fn) => { try { fn(g); } catch (e) {} });
  /* said out loud wherever you are: "+15m added to your Moments Feed" (components/BonusToast.js) */
  if (!isUnlimited(readPlan())) { try { window.dispatchEvent(new CustomEvent('mm-feed-bonus', { detail: { key, minutes: task.minutes } })); } catch (e) {} }
  return g;
}
/* "9h 12m" until the feed opens again — at midnight, the phone's own */
export const untilTomorrow = () => {
  const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((m - n) / 60000));
  return { h: Math.floor(mins / 60), m: mins % 60 };
};
export function addSeconds(sec) { const g = readGate(); g.used += sec; writeGate(g); return g; }
export function markSeenAll() { const g = readGate(); g.done = true; writeGate(g); return g; }
export const budgetSeconds = (volunteer, g, plan) => {
  if (isUnlimited(plan)) return Infinity;
  const base = plan && plan.tier === 'BASIC' ? PLUS_MINUTES : FEED_MINUTES;
  return (base + (volunteer ? VOLUNTEER_BONUS_MINUTES : 0)) * 60 + ((g && g.bonus) || 0);
};
