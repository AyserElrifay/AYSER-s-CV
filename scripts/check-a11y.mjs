/* ─── A BUTTON THAT IS ONLY AN ICON STILL HAS A NAME ──────────────────
   A screen reader reads a ✕, a bell or a paper plane as "button" and
   nothing else. Thirty-six of them in the app said exactly that. Every
   Pressable whose only content is an icon must carry an
   accessibilityLabel, in the reader's language.

       node scripts/check-a11y.mjs
*/
import fs from 'node:fs';
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const q = d + '/' + f; if (fs.statSync(q).isDirectory()) walk(q); else if (q.endsWith('.js')) files.push(q); } })('src');
let bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /<Pressable\b([^>]*)>\s*<(Ionicons|MaterialCommunityIcons)\b([^>]*)\/>\s*<\/Pressable>/g;
  let m;
  while ((m = re.exec(s))) {
    if (!/accessibilityLabel/.test(m[1])) {
      const line = s.slice(0, m.index).split('\n').length;
      console.log('  FAIL  ' + f + ':' + line + ' — an icon-only button with no name');
      bad++;
    }
  }
}
if (bad) { console.log('\n' + bad + ' button(s) a screen reader cannot name.'); process.exit(1); }
console.log('Every icon-only button has a name a screen reader can say.');
