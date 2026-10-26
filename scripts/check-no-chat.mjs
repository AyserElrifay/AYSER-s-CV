/* ─── NO ENDLESS CHAT ─────────────────────────────────────────────────
   "Subscribe, book a seat, and meet in real life." No private messages,
   no open group chats; a booked event has its host's pin, how full it
   is, and a short chat that opens 30 minutes before and goes read-only
   at the end; an online workshop has a room that opens 15 minutes
   before, for people who paid, and closes when the host ends it.

       node scripts/check-no-chat.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + (ok ? '' : '  → ' + JSON.stringify(got)));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const q = d + '/' + f; if (fs.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.js')) files.push(q); } })('src');

console.log('no way to start a private conversation');
is('nothing outside the messages service opens a DM thread', files.filter((f) => f !== 'src/services/messages.js' && /getOrCreateDmThread/.test(read(f))), []);
is('no chats tab', /name="CHATS"/.test(read('src/navigation/TabNavigator.js')), false);
is('no chat screens', ['src/screens/ChatsScreen.js', 'src/screens/ChatThread.js'].filter((f) => fs.existsSync(f)), []);

const sql = read('supabase/RUN_ME.sql');
const part = sql.slice(sql.lastIndexOf('NO ENDLESS CHAT · SUBSCRIBE'));
console.log('\nthe database closes the door, whatever sends the message');
is('every new message passes the gate', /create trigger messages_gate before insert on public\.messages/.test(part), true);
is('private messages are never written', /if new\.dm_thread_id is not null then return null/.test(part), true);
is('an event chat opens 30 minutes before', /starts_at - interval '30 minutes'/.test(part), true);
is('and is read-only after it ends', /now\(\) > w\.closes then return null/.test(part), true);

console.log('\nthe online room');
is('opens 15 minutes before, for people who paid', /now\(\) >= o\.starts_at - interval '15 minutes'/.test(part) && /status in \('paid','attended'\)/.test(part), true);
is('the host ends it for everyone', /set room_ended_at = now\(\)/.test(part) && /update public\.class_room_members set left_at = now\(\) where offer_id = p_offer and left_at is null/.test(part), true);
is('only members of an open room are on its wire', /realtime\.topic\(\) like 'class:%'/.test(part) && /public\.class_room_open\(o\)/.test(part), true);
is('the phone leaves the moment it is over', /classRoomState\(room\.id\)\.then\(\(s\) => \{ if \(alive && s && s\.open === false\) out\(true\)/.test(read('src/components/EventRoom.js')), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nNo endless chat: book a seat, meet in real life.');
