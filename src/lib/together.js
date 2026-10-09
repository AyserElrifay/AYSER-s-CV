/* ─── THE WEEK, NEAR YOU ──────────────────────────────────────────────
   Pure helpers for the Together tab, so the parts that decide what a
   person sees can be checked without a phone:

       node scripts/check-together.mjs
*/

/* A flag emoji is two "regional indicator" letters; the country code is
   those two letters. 🇪🇪 → EE. Anything else is not a country. */
export function flagToIso(flag) {
  const cps = Array.from(String(flag || '')).map((c) => c.codePointAt(0));
  if (cps.length !== 2 || cps.some((c) => c < 0x1F1E6 || c > 0x1F1FF)) return null;
  return cps.map((c) => String.fromCharCode(c - 0x1F1E6 + 65)).join('');
}

/* The gatherings, by the day they fall on in the reader's own time,
   in order, each day knowing whether it is today or tomorrow. A day
   with nothing on is not shown — an empty Wednesday is not news. */
export function groupByDay(rows, now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const out = [];
  [...(rows || [])]
    .filter((g) => g && g.starts_at && !Number.isNaN(new Date(g.starts_at).getTime()))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .forEach((g) => {
      const d = new Date(g.starts_at); d.setHours(0, 0, 0, 0);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      let b = out.find((x) => x.key === key);
      if (!b) {
        b = { key, date: d, offset: Math.round((d - today) / 86400000), items: [] };
        out.push(b);
      }
      b.items.push(g);
    });
  return out;
}
