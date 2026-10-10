/* ─── COMMUNITY XP: EARNED BY SHOWING UP ──────────────────────────────
   The rules live in the database (RUN_ME.sql, "COMMUNITY XP"); this
   checks they are there, and the phone's reading of the score.

       node scripts/check-xp.mjs
*/
import fs from 'node:fs';
import { levelOf, canCheckIn } from '../src/lib/xp.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
const block = sql.slice(sql.indexOf('COMMUNITY XP · SHOWING UP, COUNTED'));

console.log('the score');
is('zero is a newcomer, with the way to the next level', [levelOf(0).key, levelOf(0).toNext], ['newcomer', 100]);
is('levels as the points add up', [levelOf(100).key, levelOf(299).key, levelOf(700).key, levelOf(5000).key], ['neighbour', 'neighbour', 'local', 'legend']);
is('half way is half a bar', levelOf(200).progress, 0.5);
is('rubbish in is zero, not NaN', levelOf('x').xp, 0);

console.log('\n"I\'m here"');
const now = Date.parse('2026-10-10T10:00:00Z');
const g = { im_going: true, lat: 30, lng: 31, starts_at: '2026-10-10T10:10:00Z', minutes: 60 };
is('from 20 minutes before the start', canCheckIn(g, now), true);
is('not an hour before', canCheckIn({ ...g, starts_at: '2026-10-10T11:00:00Z' }, now), false);
is('not after the end', canCheckIn({ ...g, starts_at: '2026-10-10T08:00:00Z' }, now), false);
is('only if you said you are going', canCheckIn({ ...g, im_going: false }, now), false);
is('not twice', canCheckIn({ ...g, checked_in: true }, now), false);
is('not for a plan without a place to check against', canCheckIn({ ...g, lat: null }, now), false);

console.log('\nthe database decides');
is('within 300 m of the place', /km_between\(g\.lat, g\.lng, p_lat, p_lng\) > 0\.3/.test(block), true);
is('only after the end, never if called off', /now\(\) < public\.green_ends_at\(g\) then return 0/.test(block) && /g\.cancelled_at is not null/.test(block), true);
is('settled once — a second run gives nothing', /xp_awarded_at is not null then return 0/.test(block) && /primary key \(user_id, gathering_id\)/.test(block), true);
is('no points for a plan made after it started', /g\.created_at > g\.starts_at then return 0/.test(block), true);
is('at least three checked in, so two accounts cannot farm', /if here < 3 then return 0/.test(block), true);
is('only the checked-in are rewarded', /j\.checked_in_at is not null loop/.test(block), true);
is('three rewarded gatherings a day at most', />= 3 then\s+continue;/.test(block), true);
is('nobody can call the award themselves', /revoke execute on function public\.award_gathering_xp\(uuid\) from public, anon, authenticated/.test(block) && /revoke execute on function public\.award_xp_due\(\) from public, anon, authenticated/.test(block), true);
is('a user cannot write their own XP, care check or invite', /new\.community_xp := old\.community_xp/.test(block) && /new\.vibe_check_at := old\.vibe_check_at/.test(block) && /new\.invited_by := old\.invited_by/.test(block), true);
is('the guard is not security definer (or it could never tell who is asking)', /guard_profile_columns\(\)\s+returns trigger language plpgsql security invoker/.test(block), true);
is('it runs on a schedule (nothing changes when a clock passes an end time)', /cron\.schedule\('award-xp'/.test(block), true);

console.log('\non screen');
is('clean-ups glow on the map, with a leaf', /m\.act === 'cleanup' \? ' mm-act-eco'/.test(fs.readFileSync('src/components/LeafletMap.js', 'utf8')), true);
is('the pass carries the level, stamped on', /t\('xp_lvl_' \+ lv\.key\)\.toUpperCase\(\)/.test(fs.readFileSync('src/components/Passport.js', 'utf8')), true);
is('"showed up" lists only real check-ins', /\.not\('checked_in_at', 'is', null\)/.test(fs.readFileSync('src/services/green.js', 'utf8')), true);

console.log(bad ? '\n' + bad + ' wrong.' : '\nXP: earned by showing up, and nothing else.');
process.exit(bad ? 1 : 0);
