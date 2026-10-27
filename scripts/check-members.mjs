/* ─── A PRIVATE, MEMBERS-ONLY MOMENTS ─────────────────────────────────
   FREE · BASIC · VIP (RUN_ME.sql, "TWO TIERS"). Signed in without a
   membership, the gateway is the only thing on screen; Basic is the
   feed, the journey and meetups; VIP adds messages, the Live Language
   Lounges and the last seats. The tier comes from what was bought in
   Lemon Squeezy and nowhere else.

       node scripts/check-members.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const sql = read('supabase/RUN_ME.sql');
const tiers = sql.slice(sql.lastIndexOf('TWO TIERS · A PRIVATE, MEMBERS-ONLY MOMENTS'));
const app = read('App.js');
const gate = read('src/components/Membership.js');
const hook = read('supabase/functions/ls-webhook/index.ts');
const checkout = read('supabase/functions/ls-checkout/index.ts');

console.log('three states, answered by the server');
is('FREE · BASIC · VIP', /'FREE'[\s\S]+'VIP'[\s\S]+'BASIC'/.test(tiers.slice(tiers.indexOf('function public.member_tier')), true), true);
is('a member is Basic or VIP', /select public\.member_tier\(u\) in \('BASIC','VIP'\)/.test(tiers), true);
is('nobody is locked out before payments open', /when not public\.payments_on\(\) then 'VIP'/.test(tiers), true);
is('no free week for new accounts', /create or replace function public\.trial_on_signup\(\) returns trigger[\s\S]{0,140}begin\s+return new;\s+end;/.test(tiers), true);

console.log('\nLemon Squeezy decides the tier');
is('the webhook reads the VIP variant', /LEMONSQUEEZY_VIP_VARIANT_ID[\s\S]+\? 'vip' : 'basic'/.test(hook), true);
is('ls_apply writes the tier it was told', /tier\s+= excluded\.tier,/.test(tiers), true);
is('checkout sells the tier asked for', /tier === 'vip' \? 'LEMONSQUEEZY_VIP_VARIANT_ID' : 'LEMONSQUEEZY_VARIANT_ID'/.test(checkout), true);
is('a checkout link carries who, never which tier', /checkout\[custom\]\[user_id\]/.test(read('src/services/payments.js')) && !/checkout\[custom\]\[tier\]/.test(read('src/services/payments.js')), true);
is('the webhook also knows VIP by the product name', /\\bvip\\b\/i\.test\(String\(s\.product_name/.test(hook), true);
is('changing tier moves the one subscription, never a second', /method: 'PATCH'[\s\S]+variant_id: Number\(VARIANT\)/.test(checkout), true);

console.log('\nthe doors');
is('signed in and FREE: the gateway, over everything', /m\.gate && m\.tier === 'FREE'\) return <PricingGate m=\{m\} hard/.test(app), true);
is('VIP doors open the VIP sheet', /VIP_DOORS = \['vip', 'chat', 'lounge', 'profile', 'vip_seat'\]/.test(app), true);
is('the gateway says why, and lets you sign out', /'Why are we charging\?'/.test(gate) && /onSignOut\(\)/.test(gate), true);
is('the last two seats of a meetup are VIP’s', /'reason', 'vip_seat'/.test(sql), true);

console.log('\nthe VIP welcome offer, once');
const oto = sql.slice(sql.lastIndexOf('VIP IS 1300 A YEAR'));
is('VIP is 1300 a year', /"vip": 1300, "vip_period": "year"/.test(oto), true);
is('only the webhook makes the offer, once, for 24 hours', /source = 'lemonsqueezy'[\s\S]+interval '24 hours'[\s\S]+on conflict do nothing/.test(oto), true);
is('the 30% is taken off by the server', /round\(v_total \* 0\.7\)|round\(total \* 0\.7\)|\* 0\.7/.test(oto.slice(oto.indexOf('function public.journey_book'))), true);
is('back from paying, the app looks for it', /checkout=success/.test(app) && /myWelcomeOffer\(\)/.test(app), true);
is('closed once, never shown again', /otoDone\(\); setOto\(null\); dismissWelcomeOffer\(\)/.test(app), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nMembers only: Basic for the essentials, VIP for the full experience.');
