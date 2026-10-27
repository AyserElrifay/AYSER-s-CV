/* ─── LIVE ACTIVITIES · BUDDIES · DAILY MOMENT · LOUNGES ─────────────
   The server deals card INDEXES and the app holds the words, so the two
   counts have to agree, or a dealt card would be blank. And the doors
   that make this a place to meet, not a messaging app, have to be where
   they say they are (RUN_ME.sql, "LIVE ACTIVITIES").

       node scripts/check-live.mjs
*/
import fs from 'node:fs';
import { DECK, SCENES, POLLS, BADGES } from '../src/constants/activityDeck.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got) + ' (want ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
const live = sql.slice(sql.lastIndexOf('LIVE ACTIVITIES · EARNED CONNECTIONS'));
const size = (k) => Number((live.match(new RegExp("when '" + k + "' then (\\d+)")) || [])[1]);

console.log('the deck the server deals is the deck the app shows');
for (const k of ['warm', 'deep', 'global']) is(k + ' cards', DECK[k].length, size(k));
is('roleplay scenes', SCENES.length, size('roleplay'));
is('table polls', POLLS.length, size('poll'));
is('every card has English and Arabic', [...DECK.warm, ...DECK.deep, ...DECK.global, ...POLLS].every((c) => c[0] && c[1]) && SCENES.every((s) => s[0][0] && s[1][0]), true);
const badgeSql = (live.match(/badge in \(([^)]+)\)/) || [])[1] || '';
is('the badges are the server’s badges', BADGES.map((b) => "'" + b[0] + "'").join(','), badgeSql);

console.log('\nat the table');
is('only people who checked in move the game', /public\.event_in\(p_kind, p_id, u\) and exists/.test(live), true);
is('whose turn is the server’s pick, not the phone’s', /order by random\(\) limit 1/.test(live), true);
is('one vote each, no changing it', /insert into public\.event_truth_votes \(truth_id, voter, pick\) values \(t\.id, me, p_pick\) on conflict do nothing/.test(live), true);
is('the lie shows only after you voted', /open_ := mine is not null or t\.user_id = me/.test(live), true);

console.log('\nafter');
is('buddies only when both tapped, within 48 hours of the end', /now\(\) < m\.ends_at or now\(\) > m\.ends_at \+ interval '48 hours'/.test(live) && /from_id = p_to and to_id = me/.test(live), true);
is('vibe badges never say who gave them', /alter table public\.vibe_badges enable row level security;   -- nobody reads who gave what/.test(live) && !/create policy[^;]+vibe_badges/.test(live), true);

console.log('\nevery day');
is('the Daily Moment opens after you answer', /'answers', case when mine\.id is null then null/.test(live), true);

console.log('\nmembership');
is('a meetup seat is Plus (no free joins)', /if g\.host_id <> me and not public\.is_plus\(me\)\s+and not exists \(select 1 from public\.green_joins where gathering_id = p_id and user_id = me\) then/.test(live), true);
is('a lounge is VIP, ten people at most', /lounge_join[\s\S]+not public\.is_vip\(me\)[\s\S]+>= 10 then/.test(live), true);
is('the lounge call is only for VIP people in it', /realtime\.topic\(\) like 'lounge:%' and public\.is_vip\(auth\.uid\(\)\)/.test(live), true);
is('no dating words anywhere in the new screens', ['ActivitiesHub', 'BuddiesSheet', 'DailyMoment', 'LoungesSheet'].filter((f) => /\b(dating|date night|match ?making|soulmate|crush)\b/i.test(fs.readFileSync('src/components/' + f + '.js', 'utf8'))), []);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nPlay at the table, keep who you choose, practise any time.');
