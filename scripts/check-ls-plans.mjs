/* ─── A MOMENTS+ PAYMENT OPENS MOMENTS+, A BLACK PAYMENT OPENS BLACK ────
   Ayser: "اتأكد إن اللي يشترك plus يفتح plus، واللي يشترك Black يفتح Black".
   ls-webhook decides the plan from what Lemon Squeezy says was bought —
   never from the button pressed. This runs its two small functions
   (tierOf, periodOf) on every product name the store has had or will
   have, so a renamed product cannot quietly open the wrong plan.

       node scripts/check-ls-plans.mjs                                    */
import { readFileSync } from 'fs';

const src = readFileSync(new URL('../supabase/functions/ls-webhook/index.ts', import.meta.url), 'utf8');
const grab = (name) => {
  const m = src.match(new RegExp('const ' + name + ' = ([\\s\\S]*?);\\n\\n'));
  if (!m) throw new Error(name + ' not found in ls-webhook');
  return new Function('return ' + m[1].replace(/: any/g, '').replace(/\?: string/g, ''))();
};
const tierOf = grab('tierOf');
const periodOf = grab('periodOf');

let bad = 0;
const is = (what, got, want) => { const ok = got === want; if (!ok) bad++; console.log((ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + got + ', wanted ' + want)); };
const day = 864e5, t0 = Date.parse('2026-11-01T10:00:00Z');
const sub = (product, variant, days) => ({ product_name: product, variant_name: variant, created_at: new Date(t0).toISOString(), renews_at: new Date(t0 + days * day).toISOString() });

// the store as it is (October 2026) and as it will be named
for (const [p, v, days, tier, period] of [
  ['moments Basic', 'Default', 30, 'basic', 'month'],
  ['moments Basic', 'Default', 365, 'basic', 'year'],
  ['moments premium', 'Default', 30, 'vip', 'month'],
  ['Premium Annual', 'Default', 365, 'vip', 'year'],
  ['Moments+', 'Monthly', 30, 'basic', 'month'],
  ['Moments+', 'Annual', 365, 'basic', 'year'],
  ['Moments Black', 'Monthly', 30, 'vip', 'month'],
  ['Moments Black', 'Annual', 365, 'vip', 'year'],
  ['Moments Black Annual', '', 365, 'vip', 'year'],
  ['Moments Plus', '', 30, 'basic', 'month'],
]) {
  const s = sub(p, v, days);
  is(`"${p}" / "${v}" opens ${tier === 'vip' ? 'Moments Black' : 'Moments+'}`, tierOf(s, undefined), tier);
  is(`"${p}" / "${v}" is paid by the ${period}`, periodOf(s), period);
}
// the VIP variant id, when set, wins whatever the name
is('the Black variant id opens Black even with a plain name', tierOf({ variant_id: 777, product_name: 'Moments', variant_name: '' }, '777'), 'vip');
is('another variant id with a plain name stays Moments+', tierOf({ variant_id: 778, product_name: 'Moments', variant_name: '' }, '777'), 'basic');
// a word that only contains "black" or "vip" is not the plan
is('"Blackberry" is not Black', tierOf({ product_name: 'Blackberry pass' }), 'basic');

console.log(bad ? '\n' + bad + ' wrong.' : '\nEvery product opens the plan it was bought as.');
process.exit(bad ? 1 : 0);
