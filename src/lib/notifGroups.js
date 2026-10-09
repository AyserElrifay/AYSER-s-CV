/* ─── ONE LINE PER THING THAT HAPPENED ────────────────────────────────
   Ayser: "متخلهاش متكررة". Three people starring the same moment is one
   thing that happened, not three rows; two people accepting your mate
   request on the same day is one line; five messages from Mohamed are
   "Mohamed sent you a message", once. Grouping happens inside a time
   section (Today, This week…), never across them.

       node scripts/check-notif-groups.mjs
*/
// kinds that merge, and what makes two of them "the same thing"
const SAME = {
  vibe: (n) => 'vibe|' + (n.post_id || ''),
  laugh: (n) => 'laugh|' + (n.post_id || ''),
  repost: (n) => 'repost|' + (n.post_id || ''),
  tag: (n) => 'tag|' + (n.post_id || ''),
  mate_accept: () => 'mate_accept',
  message: (n) => 'message|' + (n.actor_id || ''),
  call: (n) => 'call|' + (n.actor_id || ''),
  xp_award: () => 'xp_award',
};

export function groupNotifs(list) {
  const out = [];
  const at = {};
  (list || []).forEach((n) => {
    if (!n) return;
    const keyOf = SAME[n.kind];
    const key = keyOf ? keyOf(n) : 'one|' + n.id;
    if (at[key] === undefined) {
      at[key] = out.length;
      out.push({ key, kind: n.kind, n, items: [n], actors: [], read: !!n.read });
    } else {
      const g = out[at[key]];
      g.items.push(n);
      if (!n.read) g.read = false;
    }
    const g = out[at[key]];
    const who = n.actor || {};
    if (n.actor_id && !g.actors.some((a) => a.id === n.actor_id)) g.actors.push({ id: n.actor_id, name: who.name || '', avatar_url: who.avatar_url || null });
  });
  return out;
}

/* "Mona", "Mona and Ali", "Mona and 3 others" — the words come from the
   caller (t), so every language says it its own way */
export function namesLine(actors, words) {
  const names = (actors || []).map((a) => (a.name || words.someone).trim()).filter(Boolean);
  if (!names.length) return words.someone;
  if (names.length === 1) return names[0];
  if (names.length === 2) return words.and.replace('{a}', names[0]).replace('{b}', names[1]);
  return words.others.replace('{a}', names[0]).replace('{n}', String(names.length - 1));
}
