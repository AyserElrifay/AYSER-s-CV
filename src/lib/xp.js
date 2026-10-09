/* ─── COMMUNITY XP, READ LIKE A GAME SCORE ────────────────────────────
   The number is the database's (profiles.community_xp — earned by
   checking in at gatherings, see RUN_ME.sql "COMMUNITY XP"). This only
   names the level it falls in and how far it is to the next.

       node scripts/check-xp.mjs
*/
export const LEVELS = [
  { key: 'newcomer', at: 0 },
  { key: 'neighbour', at: 100 },
  { key: 'regular', at: 300 },
  { key: 'local', at: 700 },
  { key: 'pillar', at: 1500 },
  { key: 'legend', at: 3000 },
];

export function levelOf(xp) {
  const n = Math.max(0, Math.floor(Number(xp) || 0));
  let i = 0;
  while (i + 1 < LEVELS.length && n >= LEVELS[i + 1].at) i++;
  const here = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const progress = next ? (n - here.at) / (next.at - here.at) : 1;
  return { xp: n, key: here.key, index: i, next: next ? next.key : null, toNext: next ? next.at - n : 0, progress: Math.max(0, Math.min(1, progress)) };
}

/* "I'm here" can be tapped from 20 minutes before the start to the end,
   when you said you are going and the plan has a point on the map */
export function canCheckIn(g, now = Date.now()) {
  if (!g || !g.im_going || g.checked_in || g.lat == null || g.lng == null) return false;
  const start = Date.parse(g.starts_at);
  if (!Number.isFinite(start)) return false;
  const end = start + Math.max(Number(g.minutes) || 120, 30) * 60000;
  return now >= start - 20 * 60000 && now <= end;
}
