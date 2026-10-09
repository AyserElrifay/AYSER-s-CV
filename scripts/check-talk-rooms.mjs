/* ─── TALK ROOMS: TALK FIRST, THEN MEET ───────────────────────────────
   Not Clubhouse: anchored to a place, time-boxed with no extensions,
   small, and ending in Bardi's offer to meet for real. The rules live in
   the database (RUN_ME.sql, "TALK ROOMS"); this checks they are there
   and that the phone keeps the clock honestly.

       node scripts/check-talk-rooms.mjs
*/
import fs from 'node:fs';
import { offsetFrom, remaining, phase, fmt, shouldOffer, BRIDGE_MS, ALLOWED_MINUTES } from '../src/lib/talkClock.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const sql = read('supabase/RUN_ME.sql');
const block = sql.slice(sql.indexOf('TALK ROOMS · TALK FIRST, THEN MEET'));

console.log('the clock');
const end = '2026-10-09T12:15:00Z';
const at = (iso) => Date.parse(iso);
is('15 or 30 minutes, nothing else', ALLOWED_MINUTES, [15, 30]);
is('talking, with time left', phase(end, 0, at('2026-10-09T12:05:00Z')), 'live');
is('three minutes before the end, Bardi steps in', phase(end, 0, at('2026-10-09T12:12:00Z')), 'bridge');
is('at zero it is over', phase(end, 0, at('2026-10-09T12:15:00Z')), 'over');
is('the bridge window is exactly three minutes', BRIDGE_MS, 180000);
const fast = offsetFrom('2026-10-09T12:05:00Z', at('2026-10-09T12:08:00Z'));
is('a phone three minutes fast is corrected by the server\'s clock', phase(end, fast, at('2026-10-09T12:08:00Z')), 'live');
is('the countdown reads like a clock', [fmt(remaining(end, 0, at('2026-10-09T12:12:30Z'))), fmt(0)], ['02:30', '00:00']);
is('only one side of a pair makes the offer', [shouldOffer('a', 'b'), shouldOffer('b', 'a')], [true, false]);

console.log('\nthe database decides');
is('a room has a place and a radius', /lat\s+double precision not null,\s+lng\s+double precision not null,\s+radius_km\s+numeric not null default 3 check \(radius_km between 0\.5 and 10\)/.test(block), true);
is('15 or 30 minutes, enforced', /minutes\s+int not null check \(minutes in \(15, 30\)\)/.test(block), true);
is('small: 2–8 people', /capacity between 2 and 8/.test(block), true);
is('no update policy, so ends_at can never be moved', !/create policy[^;]*on public\.talk_rooms for update/.test(block), true);
is('the list only shows rooms you are inside', /km_between\(r\.lat, r\.lng, at\.lat, at\.lng\) <= r\.radius_km/.test(block), true);
is('joining by id checks the distance too', /'too_far'/.test(block), true);
is('you must be visible on the map to see or join', /'not_visible'/.test(block), true);
is('hosting voice with strangers is earned', /talk_room_start[\s\S]{0,900}trust_unlocked\(me\)/.test(block), true);
is('an organisation hosts only from its own approved venue', /owner_id = me and status = 'live'/.test(block), true);
is('the audio channel admits only current members, only until the end', /realtime\.topic\(\)[\s\S]{0,300}m\.left_at is null[\s\S]{0,80}now\(\) < r\.ends_at/.test(block), true);
is('the meetup is offered only from three minutes before the end', /now\(\) < r\.ends_at - interval '3 minutes'/.test(block), true);
is('two taps make one meetup, not two', /if r\.gathering_id is null then/.test(block), true);
is('an organisation\'s room routes to its own event or venue', /'org_event'/.test(block) && /'org_venue'/.test(block), true);

console.log('\nthe phone keeps to it');
const mesh = read('src/lib/talkMesh.js');
is('the channel is private (database-checked)', /private: true/.test(mesh), true);
is('audio only', /video: false/.test(mesh), true);
is('the hard stop closes every connection and releases the microphone', /close: \(\) => \{[\s\S]*pcs\.keys\(\)\]\.forEach\(drop\)[\s\S]*getTracks\(\)\.forEach\(\(tr\) => tr\.stop\(\)\)/.test(mesh), true);
const ui = read('src/components/TalkRoom.js');
is('at zero the room screen cuts the audio', /if \(st === 'over' && mesh\.current\) \{ mesh\.current\.close\(\)/.test(ui), true);
is('there is no extend button', !/extend|more time|\+5/i.test(ui), true);
is('starting offers only 15 or 30', /ALLOWED_MINUTES\.map/.test(ui), true);

console.log(bad ? '\n' + bad + ' wrong.' : '\nTalk rooms: near, short, small, and they end in a real meetup.');
process.exit(bad ? 1 : 0);
