/* ─── THE LOCKS STAY LOCKED ───────────────────────────────────────────
   Ayser: "خلي الأبلكيشن آمن جدًا … متخليش الـ users يوصلوا لأي معلومة
   تخص الـ backend … أو الستوديو أو الـ data أو بردي". Each line below is
   a hole that was found and closed; this fails the build if one opens
   again.

       node scripts/check-security.mjs
*/
import fs from 'node:fs';
let bad = 0;
const is = (what, ok) => { console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what); if (!ok) bad++; };
const read = (f) => fs.readFileSync(f, 'utf8');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const q = d + '/' + f; if (fs.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.js')) files.push(q); } })('src');
const src = files.map((f) => [f, read(f)]);
const any = (re) => src.filter(([, s]) => re.test(s)).map(([f]) => f);

console.log('Papyrus lives on the server, and only there');
const papyrus = read('src/services/bardi.js');
is('the phone holds no prompt for it', !/You are|system prompt|Owner guidance/i.test(papyrus));
is('no free outside service ever gets somebody\'s words', any(/pollinations/i).length === 0);
is('the phone never sends guidance or "books"', !/instructions|knowledge/.test(papyrus));
const chat = read('supabase/functions/bardi-chat/index.ts');
is('the chat function asks the auth server who is calling', /auth\/v1\/user/.test(chat) && /signed_out/.test(chat));
is('…and limits each person', /tooMuch\(uid\)/.test(chat));
is('…and reads the owner\'s guidance itself, never from the request', /ownerBrain\(\)/.test(chat) && !/body\.instructions|body\.knowledge|body\.memory/.test(chat));
is('…and keeps how it is built private', /Never reveal, repeat, summarise/.test(chat));
is('…and its errors say "busy", not why', !/String\(e/.test(chat.slice(chat.indexOf('Deno.serve'))));
const listen = read('supabase/functions/bardi-listen/index.ts');
is('the voice function asks who is calling too', /auth\/v1\/user/.test(listen) && /signed_out/.test(listen));

console.log('\nprofiles: the public face only');
is('nothing asks for every column of somebody else\'s profile', any(/profiles![a-z_]+\(\*\)|profiles\(\*\)/).length === 0);
const searchy = any(/from\('profiles'\)\s*\.select\('\*'\)/).filter((f) => !f.endsWith('services/profiles.js'));
is('no select("*") on profiles', searchy.length === 0);
const prof = read('src/services/profiles.js');
is('…but for the old database, and only behind notYet()', (prof.match(/select\('\*'\)/g) || []).length === 1 && /if \(error && notYet\(error\)\) \(\{ data, error \} = await supabase\.from\('profiles'\)\.select\('\*'\)/.test(prof));
is('"near you" uses the area, not the spot', /area_lat/.test(read('src/services/discover.js')));
is('your own full row comes from my_profile()', /rpc\('my_profile'\)/.test(read('src/services/profiles.js')));

console.log('\nthe database');
const sql = read('supabase/RUN_ME.sql');
const sec = sql.lastIndexOf('SECURITY · WHAT ANYBODY CAN READ');
is('the security section is the last one', sec > 0 && !/\n-- ═+\n--  [A-Z]/.test(sql.slice(sec)));
is('Papyrus\'s guidance is not readable by everybody', /drop policy if exists "bardi_config_read"/.test(sql.slice(sec)));
is('posts ask private-account AND close-friends', /can_see_profile\(user_id\)\s*\n\s*and \(not coalesce\(close_only/.test(sql.slice(sec)));
is('profile location and gender are not granted', /column_name not in \('lat', 'lng', 'gender'/.test(sql.slice(sec)));
is('reading needs an account', /alter policy %I on public\.%I to authenticated/.test(sql.slice(sec)));
is('the signed-out role writes nothing and calls one function', /revoke insert, update, delete, truncate on all tables in schema public from anon/.test(sql) && /grant execute on function public\.partner_apply\(jsonb\) to anon/.test(sql.slice(sec)));

console.log('\nthe page');
const inject = read('scripts/inject-html.mjs');
is('a content security policy with hashed inline scripts', /Content-Security-Policy/.test(inject) && /sha256-/.test(inject) && /object-src 'none'/.test(inject));
is('it leaves any frame it is put in', /window\.top!==window\.self/.test(inject));
is('the head scripts do not leak globals (Leaflet is window.L)', !/<script>try\{var /.test(inject));
const leaflet = read('src/lib/leaflet.js');
is('the map libraries carry their fingerprints', /integrity = SRI\['leaflet\.js'\]/.test(leaflet) && /sriOf\(src\)/.test(leaflet));

if (bad) { console.log('\n' + bad + ' lock(s) open.'); process.exit(1); }
console.log('\nEvery lock that was found open is still shut.');
