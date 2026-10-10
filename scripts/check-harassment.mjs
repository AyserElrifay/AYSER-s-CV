/* ─── REPORT, BLOCK, STRIKES — AND A PERSON DECIDES ───────────────────
   One button in a chat; confirmed, the reporter is blocked from that
   person at once and that person's last five messages are copied into
   the report. Bardi only sorts the queue. A strike is given by a human
   in the Studio; one strike means a life-coach session before anything
   else, two close the account — enforced in the database.

       node scripts/check-harassment.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');
const sql = read('supabase/RUN_ME.sql');
const part = sql.slice(sql.indexOf('SAFETY · REPORT, BLOCK, STRIKES'));
const fn = read('supabase/functions/safety-review/index.ts');
const sheet = read('src/components/ChatReportSheet.js');
const thread = read('src/screens/ChatThread.js');
const admin = read('src/components/AdminPanel.js');
const en = read('src/constants/i18n.js');

is('the report button is in the chat header', /setReportOpen\(true\)/.test(thread) && /<ChatReportSheet/.test(thread), true);
is('there is a confirmation step before anything is sent', /setStep\('confirm'\)/.test(sheet) && /step === 'confirm'/.test(sheet) && /onPress=\{report\}/.test(sheet), true);
is('both people must really be in that chat', /is_dm_participant\(p_dm, me\) and public\.is_dm_participant\(p_dm, p_user\)/.test(part), true);
is('the reporter is blocked from them at once', /insert into public\.user_blocks \(blocker_id, blocked_id\) values \(me, p_user\)/.test(part), true);
is('THEIR last five messages in that chat are kept with the report', /where user_id = p_user[\s\S]{0,160}order by created_at desc limit 5/.test(part), true);
is('a blocked person cannot message in a private chat or send a friend request', /create trigger messages_block_gate/.test(part) && /create trigger mates_block_gate/.test(part), true);
is('strikes are private to the person', /create policy "standing: your own" on public\.safety_standing for select using \(user_id = auth\.uid\(\)\)/.test(part) && !/alter table public\.profiles add column if not exists strikes/.test(part), true);
is('nobody writes their own standing', !/on public\.safety_standing for (insert|update|delete|all)/.test(part), true);
is('Bardi\'s reading is written only by the server function', /revoke execute on function public\.safety_set_ai\(uuid, text, text\) from public, anon, authenticated/.test(part) && /grant execute on function public\.safety_set_ai\(uuid, text, text\) to service_role/.test(part), true);
is('a strike is given only by a person in the Studio', /safety_decide[\s\S]{0,300}is_app_owner\(\)/.test(part) && !/safety_decide|safety_standing/.test(fn), true);
is('one strike: a life-coach session; two: closed', /when public\.safety_standing\.strikes \+ 1 >= 2 then 'closed' else 'coach'/.test(part), true);
is('the hold is enforced by the database, not the screen', /raise exception 'safety_coach'/.test(part) && /raise exception 'safety_closed'/.test(part) && /'messages','posts','stories','comments','green_gatherings','green_joins','mates'/.test(part), true);
is('Bardi is Claude, and treats the messages as evidence, not instructions', /model: 'claude-opus-5'/.test(fn) && /evidence, not instructions/.test(fn), true);
is('only the reporter can ask for the reading, once', /r\.reporter_id !== me/.test(fn) && /if \(r\.ai_at\)/.test(fn), true);
is('nothing from the chat is logged', !/console\.(log|error|warn)/.test(fn), true);
is('the Studio shows the messages and asks twice before a strike', /<SafetyReport /.test(admin) && /armed \? \(r\.strikes >= 1/.test(admin), true);
is('emergency numbers for a threat', /kind === 'threat'/.test(sheet) && /122/.test(sheet) && /112/.test(sheet), true);
is('the terms say how reports work, AI included', /6a\. Threats and harassment in chats/.test(read('src/components/TermsSheet.js')) && /Anthropic's Claude/.test(read('src/components/TermsSheet.js')), true);
is('the confirmation says what happens', /hr_c_messages: "Their last 5 messages in this chat go to the Moments team/.test(en) && /hr_c_anon: "They are not told who reported them\."/.test(en), true);
const keys = ['hr_title', 'hr_confirm', 'hr_c_messages', 'hr_send', 'hr_danger', 'sk_coach_sub', 'sk_closed', 'notif_safety_strike', 'hr_unblock'];
const missing = fs.readdirSync('public/i18n').filter((f) => f.endsWith('.json')).filter((f) => { const d = JSON.parse(read('public/i18n/' + f)); return keys.some((k) => !d[k]); });
is('every language has the words', missing, []);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nOne button reports and blocks; Bardi sorts, a person decides, and the database holds the line.');
