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
