/* ─── WHAT THE CHATS LIST SHOWS ───────────────────────────────────────
   Every plan has a chat, and a weekly plan makes a new one every week,
   so a list that shows them all as equals soon reads "Morning walk,
   Morning walk, Morning walk". Three piles instead:

     coming — plan chats whose plan has not finished, soonest first
     groups — chats that are not a plan (your own squads)
     past   — plans that finished more than 12 hours ago, or were called
              off; folded away under one line, never deleted

       node scripts/check-chat-list.mjs
*/
export const AFTER_MS = 12 * 3600 * 1000;

export function splitChats(squads, now = Date.now()) {
  const coming = []; const groups = []; const past = [];
  (squads || []).forEach((s) => {
    const p = s && s.plan;
    if (!p || !p.starts_at) { groups.push(s); return; }
    const end = Date.parse(p.starts_at) + (Number(p.minutes) || 120) * 60000;
    if (p.cancelled_at || !Number.isFinite(end) || end + AFTER_MS < now) past.push(s);
    else coming.push(s);
  });
  coming.sort((a, b) => Date.parse(a.plan.starts_at) - Date.parse(b.plan.starts_at));
  past.sort((a, b) => Date.parse(b.plan.starts_at) - Date.parse(a.plan.starts_at));
  return { coming, groups, past };
}

/* ── ONE LIST, NEWEST FIRST ──
   People and your own groups together, the way every messaging app
   does it: whoever said something last is on top. A chat nobody has
   written in yet sits under the ones with words in them. */
export function inbox(dms, groups) {
  const rows = [];
  (dms || []).forEach((d) => rows.push({ kind: 'dm', key: 'd' + d.id, at: d.lastAt ? Date.parse(d.lastAt) : 0, item: d }));
  (groups || []).forEach((g) => rows.push({ kind: 'group', key: 'g' + g.id, at: g.lastAt ? Date.parse(g.lastAt) : 0, item: g }));
  return rows.sort((a, b) => (b.at || 0) - (a.at || 0));
}

/* ── THE ONE NUDGE ──
   Somebody you are mates with and have not talked to in a week — or
   ever — gets one quiet card with a hello you can send in one tap.
   Online people first (they can answer now), then whoever it has been
   longest with. One card, never a list; dismissed, it rests for a day. */
export const QUIET_DAYS = 7;
export function quietFriend({ mates, dms, now = Date.now(), online = () => false, dismissed = {} }) {
  const lastWith = {};
  (dms || []).forEach((d) => { if (d.user && d.user.id) lastWith[d.user.id] = d.lastAt ? Date.parse(d.lastAt) : 0; });
  const day = 86400000;
  const cands = (mates || [])
    .filter((m) => m && m.id && !(dismissed[m.id] && now - dismissed[m.id] < day))
    .map((m) => {
      const at = lastWith[m.id] || 0;
      return { mate: m, days: at ? Math.floor((now - at) / day) : null, online: !!online(m.id), at };
    })
    .filter((c) => c.days === null || c.days >= QUIET_DAYS);
  if (!cands.length) return null;
  cands.sort((a, b) => (Number(b.online) - Number(a.online)) || (a.at - b.at));
  return cands[0];
}
