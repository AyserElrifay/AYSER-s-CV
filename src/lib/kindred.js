/* ─── WHAT THE "YOUR PEOPLE" SCREEN IS ALLOWED TO SAY ─────────────────
   Pure, so it can be checked without a database:

       node scripts/check-kindred.mjs

   The rules, in order of importance:

     · The number is the count of rows. It is never rounded up, never
       given a "+", never padded with a floor. A competitor's onboarding
       told a brand-new user 102,192 people had things in common with
       them; a number that size, forty seconds in, reads as invented —
       and "nothing fake" is the rule this whole app is built on.
     · Zero is said as zero, kindly: you are the first, and whoever
       comes next will find you. That is true, and it is a better
       first impression than a fake crowd that is not there tomorrow.
     · The flags shown are the flags those people actually set, the
       most common first, at most eight, and the rest as a count.
     · "In your country" only appears if you told us your country and
       somebody else there has the same vibe. */

export function summarizeKindred({ total, flags, sameHere, myFlag }) {
  const n = Math.max(0, Number.isFinite(total) ? Math.floor(total) : 0);
  const tally = new Map();
  (flags || []).forEach((f) => { if (f) tally.set(f, (tally.get(f) || 0) + 1); });
  const ordered = [...tally.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([f]) => f);
  return {
    total: n,
    first: n === 0,
    countries: ordered.length,
    flags: ordered.slice(0, 8),
    moreFlags: Math.max(0, ordered.length - 8),
    sameHere: myFlag && Number.isFinite(sameHere) && sameHere > 0 ? sameHere : 0,
    myFlag: myFlag || null,
  };
}

/* The number as people read it: grouped the way their language groups
   digits, and nothing else done to it. */
export function kindredNumber(n, lang) {
  try { return new Intl.NumberFormat(lang || 'en').format(n); } catch (e) { return String(n); }
}
