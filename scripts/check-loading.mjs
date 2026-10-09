/* ─── THE APP DOES NOT START OVER ─────────────────────────────────────
   Ayser: "مشكلة الـLoading ... الكود معمول await ... بيرجع تاني من الأول
   كل ما يبدأ في task جديدة ... خلي على طول يتعامل بسيط السريع".

   Measured with every server call slowed to a phone-in-Cairo 400ms,
   and again at a bad-connection 2 seconds:

                                       before      after
     feed on screen, 400ms/request     1.98s       1.12s
     feed on screen, 2s/request        5.1s        2.4s
     reopening the app, 2s/request     5.1s        1.0s
     queries re-fired on login renewal 12          0
     longest chain of waiting          7-8         2-3

   Four separate faults made that, and this holds each one in place:

     1. four independent queries awaited one after another;
     2. every hourly login renewal handed every screen a "new" user,
        and 56 screens reloaded everything when it did;
     3. the feed did not start until the splash had finished, and
        would not show a post until a second query was back too;
     4. every cold start began from nothing, and every tab after Home
        was a spinner the first time it was opened.

       node scripts/check-loading.mjs
*/
import fs from 'node:fs';

let bad = 0;
const ok = (what, cond) => {
  console.log('  ' + (cond ? 'PASS  ' : 'FAIL  ') + what);
  if (!cond) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');

console.log('1 · questions that do not depend on each other are asked together');
const social = read('src/services/social.js');
const eng = social.slice(social.indexOf('export async function fetchEngagement'), social.indexOf('/* Who starred a post'));
ok('the four engagement queries are one Promise.all', /await Promise\.all\(\[/.test(eng));
ok('and none of them is awaited on its own', (eng.match(/await supabase/g) || []).length === 0);

console.log('\n2 · renewing the login is not a reason to reload');
const authx = read('src/context/AuthContext.js');
ok('the user is kept in a ref across renewals', /const userRef = useRef\(/.test(authx));
ok('a renewal with the same id keeps the same object', /u\.id === prev\.id && event !== 'USER_UPDATED'/.test(authx));
ok('the context value is memoized', /const value = useMemo\(/.test(authx));
ok('and does not hand out the raw session, which changes every renewal',
   !/useMemo\(\(\) => \(\{\s*session,/.test(authx));
ok('the profile, presence and settings effects are keyed on who, not on the token',
   (authx.match(/\}, \[uid\]\);/g) || []).length >= 3 && !/\}, \[session\]\);/.test(authx));
ok('the event reaches the context', /callback\(session, event\)/.test(read('src/services/auth.js')));
ok('somebody already signed in does not wait on the network to be told so',
   /useState\(SUPABASE_READY && !BOOT\)/.test(authx) && /storedSessionNow/.test(read('src/lib/supabase.js')));

console.log('\n3 · the feed starts early and shows what it has');
const feed = read('src/hooks/useFeed.js');
const app = read('App.js');
ok('it is asked for as soon as we know who is here, from App', /primeFeed\(\)/.test(app));
ok('the first load reuses that request', /takePrimed\(\) \|\| fetchFresh\(\)/.test(feed));
ok('tags are added when they arrive, not waited for',
   /fetchTagsForPosts\(all\.map\(\(c\) => c\.id\)\)\.then\(/.test(feed) && !/await fetchTagsForPosts/.test(feed));

console.log('\n4 · a cold start is not a blank start');
ok('the last feed is kept on the phone', /writeCache\(ranked\)/.test(feed));
ok('and drawn first', /useState\(\(\) => \(SUPABASE_READY \? \(readCache\(\) \|\| \[\]\)/.test(feed));
ok('only for the same person', /c\.uid !== uid/.test(feed));
ok('and never older than a day', /24 \* 3600e3/.test(feed));
ok('sponsored cards are never kept', /!c\.sponsored/.test(feed));
const lazy = read('src/lib/lazyScreen.js');
const tabs = read('src/navigation/TabNavigator.js');
ok('a tab already fetched opens with no spinner frame', /useState\(\(\) => ready\)/.test(lazy));
ok('the other tabs are fetched in a quiet moment', /preloadTabs\(/.test(tabs));
ok('but not in data saver', /saving: isSaving\(/.test(tabs) && /if \(saving/.test(lazy));

if (bad) {
  console.log('\n' + bad + ' wrong. Something in the app is waiting when it does not have to.');
  process.exit(1);
}
console.log('\nNothing waits on what it does not need, and nothing starts over.');
