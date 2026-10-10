/* ─── WHO AND WHAT TO SUGGEST, AND IN WHAT ORDER ──────────────────────
   Ayser asked: interests first, then location? And mutual friends.
   The answer we settled on, for an app whose whole point is meeting:

     LOCATION IS THE GATE, NOT A SCORE. A perfect match forty kilometres
     away is not a plan anybody goes to. So first: is it reachable —
     here now / this week nearby, then your city, then your country.
     The circle widens on its own, so with seventy people the list is
     never empty.

     INSIDE THE GATE, PEOPLE: mutual friends first — a stranger with
     three friends in common is somebody you can say hello to; a
     stranger who only shares a hobby can feel like being watched —
     then shared interests, then who is around right now.

     INSIDE THE GATE, PLANS: friends going first ("two of your friends
     are going" is what makes people actually go), then whether it is
     the kind of thing you love, then how soon. And one place in the
     first few is kept for something you would not have picked —
     otherwise your interests become a wall.

   Every card says WHY it is there, in plain words, from real counts.

   Pure, so it is checked without a phone:

       node scripts/check-recommend.mjs
*/

export const NEAR_KM = 25;

const words = (s) => String(s || '').toLowerCase().split(/[,،;|/]+/)
  .map((x) => x.replace(/[^\p{L}\p{N} ]/gu, '').trim()).filter((x) => x.length > 2);

/* the hobbies two people share, as the other person wrote them */
export function sharedHobbies(mine, theirs) {
  const mineSet = new Set(words(mine));
  const raw = String(theirs || '').split(/[,،;|/]+/).map((x) => x.trim()).filter(Boolean);
  return raw.filter((h) => {
    const w = h.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
    return w.length > 2 && mineSet.has(w);
  }).map((h) => h.replace(/^[^\p{L}\p{N}]+/u, '').trim());
}

const same = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/* 0 near you (here now or this week, within NEAR_KM when we know),
   1 your city, 2 your country, 3 elsewhere */
export function placeTier(p, me) {
  const nearSeen = p.seen === 'now' || p.seen === 'recent';
  if (nearSeen && (p.km == null || p.km <= NEAR_KM)) return 0;
  if (me && same(p.city, me.city)) return 1;
  if (me && same(p.country, me.country)) return 2;
  return 3;
}

export function rankPeople(list, me) {
  return (list || []).map((p, i) => {
    const shared = sharedHobbies(me && me.hobbies, p.hobbies);
    const mutuals = Number(p.mutuals) || 0;
    const score = Math.min(mutuals, 3) * 4 + Math.min(shared.length, 3) * 2
      + (p.seen === 'now' ? 2 : p.seen === 'recent' ? 1 : 0);
    const why = mutuals ? { k: 'mutual', n: mutuals } : shared.length ? { k: 'shared', what: shared[0] } : null;
    return { ...p, tier: placeTier(p, me), score, why, i };
  }).sort((a, b) => a.tier - b.tier || b.score - a.score || a.i - b.i);
}

/* a plan's kind → the words in somebody's hobbies that mean they'd love it */
const KIND_LOVES = {
  walk: /hik|walk|trek|mountain|camp|nature|مشي|تمشية/i,
  run: /run|jog|marathon|gym|fitness|جري/i,
  coffee: /coffee|caf|قهوة/i,
  sport: /football|soccer|padel|tennis|sport|basket|volley|كورة/i,
  culture: /cultur|art|music|opera|theat|museum|histor|film/i,
  art: /art|draw|paint|photo|design|craft/i,
  circle: /language|talk|book|read|chat|meet/i,
  focus: /stud|read|work|focus|book|مذاكر/i,
  cleanup: /volunt|green|nature|eco|clean|garden|بيئة/i,
  project: /volunt|build|make|garden|project/i,
  movie: /film|movie|cinema|سينما|فيلم/i,
};
export const lovesKind = (hobbies, kind) => !!(KIND_LOVES[kind] && KIND_LOVES[kind].test(String(hobbies || '')));

/* plans already inside the gate (the map's own edges); `now` for tests */
export function rankPlans(plans, me, now = Date.now()) {
  const hobbies = me && me.hobbies;
  const ranked = (plans || []).map((g, i) => {
    const mates = Number(g.mates_going) || 0;
    const loves = lovesKind(hobbies, g.kind);
    const hours = (new Date(g.starts_at).getTime() - now) / 3600000;
    const soon = hours <= 24 ? 2 : hours <= 72 ? 1 : 0;
    const score = Math.min(mates, 3) * 4 + (loves ? 3 : 0) + soon;
    const why = mates ? { k: 'mates', n: mates } : loves ? { k: 'loves' } : null;
    return { ...g, score, loves, why, i };
  }).sort((a, b) => b.score - a.score || new Date(a.starts_at) - new Date(b.starts_at) || a.i - b.i);

  /* one of the first four is something different, when there is one */
  const top = ranked.slice(0, 4);
  if (top.length === 4 && top.every((g) => g.loves || (Number(g.mates_going) || 0) > 0)) {
    const k = ranked.findIndex((g, j) => j >= 4 && !g.loves && !(Number(g.mates_going) || 0));
    if (k > 0) {
      const [different] = ranked.splice(k, 1);
      ranked.splice(3, 0, { ...different, why: { k: 'new' } });
    }
  }
  return ranked;
}

/* the why, in words */
export function whyText(why, t) {
  if (!why) return null;
  if (why.k === 'mutual') return why.n === 1 ? t('why_mutual_one') : t('why_mutual').replace('{n}', String(why.n));
  if (why.k === 'shared') return t('why_shared').replace('{what}', why.what);
  if (why.k === 'mates') return why.n === 1 ? t('why_mates_one') : t('why_mates').replace('{n}', String(why.n));
  if (why.k === 'loves') return t('why_loves');
  if (why.k === 'new') return t('why_new');
  return null;
}
