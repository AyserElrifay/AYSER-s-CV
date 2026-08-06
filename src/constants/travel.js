/* ─── TRAVEL PLANS ───────────────────────────────────────────────────
   "I'm in Romania this August — who's around?" A plan is a post whose
   point is the trip behind it: a headline, where, when, and what the
   person is actually up for. That last part is what turns a plan into a
   conversation instead of an announcement, so it is a list of real
   things people do together rather than a free-text box nobody fills in.

   Both the composer and the feed card read from here, so a plan is
   written and displayed from one list — a tag can never show up as a
   raw id because the two files drifted apart. */

export const UP_FOR = [
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'walk', label: 'Walking the city', emoji: '🚶' },
  { id: 'nature', label: 'Nature & hikes', emoji: '🌲' },
  { id: 'music', label: 'Live music', emoji: '🎸' },
  { id: 'food', label: 'Food hunting', emoji: '🍜' },
  { id: 'drink', label: 'A drink & stories', emoji: '🍻' },
  { id: 'camp', label: 'Camping', emoji: '⛺' },
  { id: 'photo', label: 'Photo walks', emoji: '📷' },
  { id: 'sport', label: 'Sport & gym', emoji: '🏀' },
  { id: 'roadtrip', label: 'Road trips', emoji: '🚐' },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* The next eighteen months, as { key: '2026-08', label: 'Aug 2026' }.
   Built from today, so the list is never stale and nobody can pick a
   month that has already been and gone. */
export const monthOptions = () => {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    out.push({ key, label: MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear() });
  }
  return out;
};

export const monthLabel = (key) => {
  if (!key || typeof key !== 'string') return '';
  const parts = key.split('-');
  const i = parseInt(parts[1], 10) - 1;
  if (!(i >= 0 && i < 12)) return '';
  return MONTHS_SHORT[i] + ' ' + parts[0];
};

/* "Aug 2026", or "Aug — Sep 2026" when there are two ends to it. */
export const planWhen = (plan) => {
  if (!plan) return '';
  const a = monthLabel(plan.from), b = monthLabel(plan.to);
  if (a && b && a !== b) return a + ' → ' + b;
  return a || b || '';
};

export const upForLabel = (id) => {
  const f = UP_FOR.find((u) => u.id === id);
  return f ? f.emoji + ' ' + f.label : String(id || '');
};
