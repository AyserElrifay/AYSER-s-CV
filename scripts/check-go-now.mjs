/* ─── GO OUT NOW, AND WHAT HAS TO BE EARNED ───────────────────────────
   "أنا النهارده الصبح عايز انزل اتمشي الفجر واظهر على الخريطة وأي حد
   حواليا يقدر join — واعمل إظهار للمهتم بالجري", and positive friction:
   messaging strangers and hosting big plans are earned.

   The rules live in the database; this holds them in place and checks
   the app answers them.

       node scripts/check-go-now.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, cond) => { console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + what); if (!cond) bad++; };
const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
const after = sql.slice(sql.lastIndexOf('GO OUT NOW · AND EARNING THE BIG THINGS'));
const read = (f) => fs.readFileSync(f, 'utf8');

console.log('go out now');
is('a small hangout, capped at 8', /green_create\(p_kind, p_title, null, p_country, null, p_place, p_lat, p_lng,[\s\S]*?, 8, null\)/.test(after));
is('only people within 5 km are told', /\) <= 5\b/.test(after));
is('only people seen in the last two hours', /updated_at > now\(\) - interval '2 hours'/.test(after));
is('only people whose own hobbies match', /lower\(coalesce\(p\.hobbies, ''\)\) like/.test(after));
is('never more than 50', /limit 50;/.test(after));
is('the screen says the real number told', /t\('gn_told'\)\.replace\('\{n\}', String\(state\.told\)\)/.test(read('src/components/GoNowSheet.js')));
is('and says so when it is nobody', /gn_told_none/.test(read('src/components/GoNowSheet.js')));

console.log('\nearned, not given');
is('big plans need trust', /\(p_capacity is null or p_capacity > 12\) and not public\.trust_unlocked\(me\)/.test(after));
is('messaging a stranger needs trust', /raise exception 'need_unlock'/.test(after));
is('mates, people met at a hangout, venues and live hosts are not strangers', /m\.status = 'accepted'/.test(after) && /a\.gathering_id = b\.gathering_id/.test(after) && /v\.status = 'live'/.test(after) && /c\.ended_at is null/.test(after));
is('the answers are checked on the server', /key int\[\] := array\[1, 0, 2, 1\]/.test(after) && !/1, 0, 2, 1/.test(read('src/components/VibeCheckSheet.js')));
is('a hangout that already happened counts', /g\.starts_at < now\(\)/.test(after));
is('the app opens the check wherever it is refused', /requestUnlock\('dm'\)/.test(read('src/services/messages.js')) && /requestUnlock\('big'\)/.test(read('src/services/green.js')) && /<UnlockHost \/>/.test(read('src/navigation/TabNavigator.js')));
is('the map stays open to newcomers', !/trust_unlocked/.test(read('src/services/locations.js')));

console.log('\nevery plan has a chat');
const chatSql = sql.slice(sql.lastIndexOf('EVERY PLAN HAS A CHAT'));
is('joining puts you in it, leaving takes you out — one trigger for every way in', /after insert or delete on public\.green_joins/.test(chatSql) && /delete from public\.squad_members where squad_id = sq and user_id = old\.user_id/.test(chatSql));
is('only people going see the Chat button', /\(g\.im_going \|\| mine\) && g\.squad_id/.test(read('src/screens/TogetherScreen.js')));

console.log('\nbring your people — counted, not claimed');
const inv = sql.slice(sql.lastIndexOf('BRING YOUR PEOPLE'));
is('counted once, by one person, never yourself, within two weeks', /p_from = me/.test(inv) && /invited_by is null/.test(inv) && /interval '14 days'/.test(inv));
is('the screen shows the database count, and zero as zero', /myInvites\(\)\.then/.test(read('src/screens/TogetherScreen.js')) && /inv_none/.test(read('src/screens/TogetherScreen.js')));
is('no reward is promised', !/Pro|free year|reward/i.test(JSON.stringify(read('src/constants/i18n.js').match(/inv_[a-z]+: [^\n]+/g))));
is('the code leaves the address bar at once', /history\.replaceState/.test(read('src/lib/invite.js')));

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nGoing out is one tap; the big things are earned, and the database decides.');
