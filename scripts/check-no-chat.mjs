/* ─── NO ENDLESS CHAT ─────────────────────────────────────────────────
   "Subscribe, book a seat, and meet in real life." No cold messages
   between strangers and no open group chats; a booked event has its
   host's pin, how full it is, and a short chat that opens 30 minutes
   before, becomes a 24-hour Memory Capsule at the end and is then
   read-only; an online workshop has a room that opens 15 minutes
   before, for people who paid, and closes when the host ends it.
   Private messages are earned (LIVE ACTIVITIES in RUN_ME.sql): between
   Moments Buddies, or one prompt-first line, and only on Plus.

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
// the Buddies page, sharing a link into a thread you already have, and the Studio — the server decides each one
is('nothing new writes private messages', files.filter((f) => /dmThreadId:/.test(read(f)) && !/services\/messages\.js$/.test(f)).sort(), ['src/components/AdminPanel.js', 'src/components/BuddiesSheet.js', 'src/components/ShareSheet.js']);

const sql = read('supabase/RUN_ME.sql');
const part = sql.slice(sql.lastIndexOf('NO ENDLESS CHAT · SUBSCRIBE'));
const live = sql.slice(sql.lastIndexOf('LIVE ACTIVITIES · EARNED CONNECTIONS'));
const gate = live.slice(live.indexOf('create or replace function public.messages_gate()'));
console.log('\nthe database closes the door, whatever sends the message');
is('every new message passes the gate', /create trigger messages_gate before insert on public\.messages/.test(live), true);
is('a private message is written only when it is earned', /if length\(coalesce\(new\.body, ''\)\) > 500 or not public\.dm_can_send\(new\.dm_thread_id, new\.user_id\) then return null/.test(gate), true);
is('earned = Plus, not blocked, and buddies or a prompt-first opener', /not public\.is_plus\(u\) or public\.blocked_between\(u, o\)/.test(live) && /if public\.are_buddies\(u, o\) then return true/.test(live), true);
is('an opener needs a Daily Moment answer or an icebreaker card', /reason', 'prompt'/.test(live), true);
is('and the sender waits for an answer', /or exists \(select 1 from public\.messages m where m\.dm_thread_id = t and m\.user_id = op\.to_id\)/.test(live), true);
is('an event chat opens 30 minutes before', /starts_at - interval '30 minutes'/.test(part), true);
is('then a 24-hour capsule of short notes', /\+ interval '24 hours'/.test(live) && /now\(\) > w\.ends and length\(coalesce\(new\.body, ''\)\) > 280 then return null/.test(gate), true);
is('and is read-only after that', /if now\(\) > w\.closes then return null/.test(gate), true);

console.log('\nthe online room');
is('opens 15 minutes before, for people who paid', /now\(\) >= o\.starts_at - interval '15 minutes'/.test(part) && /status in \('paid','attended'\)/.test(part), true);
is('the host ends it for everyone', /set room_ended_at = now\(\)/.test(part) && /update public\.class_room_members set left_at = now\(\) where offer_id = p_offer and left_at is null/.test(part), true);
is('only members of an open room are on its wire', /realtime\.topic\(\) like 'class:%'/.test(part) && /public\.class_room_open\(o\)/.test(part), true);
is('the phone leaves the moment it is over', /classRoomState\(room\.id\)\.then\(\(s\) => \{ if \(alive && s && s\.open === false\) out\(true\)/.test(read('src/components/EventRoom.js')), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nNo endless chat: book a seat, meet in real life, keep the people you choose.');
