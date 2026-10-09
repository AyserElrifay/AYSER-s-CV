/* ─── A LIVE ROOM HAS TO BE LIVE ──────────────────────────────────────
   Ayser: "اتأكد ان الرومز اللي هي زي اللايف دي شغالة".

   They worked, and they were not live. The room screen subscribes to
   row changes on game_rooms and room_players — and neither table had
   ever been added to the realtime publication, so both subscriptions
   listened to nothing. The host's broadcast moved everyone on, and a
   five-second poll caught the rest, so nothing looked broken: people
   joining a lobby and people answering simply arrived up to five
   seconds late on every other phone.

   This ties the client to the database it talks to:
     · every function the rooms call is created in RUN_ME.sql — the one
       file Ayser is told to run — not only in an old migration;
     · every table the rooms listen to is in the realtime publication;
     · and the safety net (the poll) is still there, because a socket
       that drops does so silently.

       node scripts/check-live-rooms.mjs
*/
import fs from 'node:fs';

let bad = 0;
const ok = (what, cond, extra) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + what + (extra ? '  ' + extra : ''));
  if (!cond) bad++;
};

const client = fs.readFileSync('src/services/lamma.js', 'utf8');
const runme = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
const game = fs.readFileSync('src/components/lamma/LammaGame.js', 'utf8');

console.log('every function a room calls exists in RUN_ME.sql');
const calls = [...new Set([...client.matchAll(/rpc\('(\w+)'/g)].map((m) => m[1]))].sort();
const created = new Set([...runme.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)\s*\(/gi)].map((m) => m[1]));
for (const c of calls) ok(c, created.has(c), created.has(c) ? '' : '— the app calls it and nothing creates it');

console.log('\nevery table the app listens to is published for realtime');
/* the whole app, not only the rooms — calls, chats and notifications
   listen the same way, and the same omission would silence them too */
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const q = d + '/' + f; if (fs.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.js')) files.push(q); } })('src');
const listened = [...new Set(files.flatMap((f) => { const s = fs.readFileSync(f, 'utf8'); return /postgres_changes/.test(s) ? [...s.matchAll(/table:\s*'(\w+)'/g)].map((m) => m[1]) : []; }))].sort();
const published = new Set([...runme.matchAll(/alter\s+publication\s+supabase_realtime\s+add\s+table\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]));
for (const t of listened) ok(t, published.has(t), published.has(t) ? '' : '— subscribed to, never published: the subscription hears nothing');

console.log('\nand the Lamma tables can only be heard by their players');
for (const t of ['game_rooms', 'room_players']) {
  ok(t + ' has a select policy', new RegExp('on public\\.' + t + ' for select', 'i').test(runme));
}

console.log('\nthe safety net is still there');
ok('a poll as well as a subscription', /setInterval\(refresh, 5000\)/.test(game));
ok('a burst of answers is one refresh, not seventy', /burst = setTimeout\(/.test(game));

if (bad) {
  console.log('\n' + bad + ' wrong. A room will look fine and update late, or not at all.');
  process.exit(1);
}
console.log('\nEvery call has a function, and every subscription has something to hear.');
