/* ─── A BUTTON HAS TO WORK ON THE FIRST TAP ───────────────────────────
   Ayser: "في bug ان بعض الزراير بالذات في الedit ما بتشتغلش غير بضغطه
   طويله".

   Exactly right, and the cause is a default nobody chose. A ScrollView
   on the web installs its own tap handler whose job is to put the
   keyboard away, and with the stock setting — keyboardShouldPersistTaps
   = 'never' — it EATS the tap that did it. So while a text field has
   focus, which in an edit form is always, the first tap on Save does
   nothing at all. Hold the finger down instead and the press survives
   long enough to land, which is why it looked like the buttons needed
   a long press. They did not: they needed a second tap.

   The setting does not inherit, which is why only SOME buttons were
   affected and why this looked random. The edit sheet itself had it;
   the horizontal strips of chips INSIDE the edit sheet did not, and
   those are the buttons he could not press.

   'handled' is the right value everywhere: if a child takes the tap,
   the keyboard stays and the press lands; if nothing takes it, the
   keyboard still closes.

       node scripts/check-tap.mjs
*/
import fs from 'node:fs';
import path from 'node:path';

const TAGS = ['ScrollView', 'FlatList', 'SectionList'];

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
})('src');

/* Walk to the '>' that ends an opening tag, stepping over {...} and
   quoted strings so a brace inside a style object does not end it. */
function openTag(s, i) {
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; }
    } else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
    i++;
  }
  return -1;
}

let total = 0;
const naked = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const tag of TAGS) {
    const re = new RegExp('<' + tag + '(?=[\\s/>])', 'g');
    let m;
    while ((m = re.exec(s))) {
      const e = openTag(s, m.index + m[0].length);
      if (e === -1) continue;
      total++;
      if (!s.slice(m.index, e).includes('keyboardShouldPersistTaps')) {
        naked.push(f + ':' + (s.slice(0, m.index).split('\n').length) + '  <' + tag);
      }
    }
  }
}

console.log('scrollable lists in the app: ' + total);
if (naked.length) {
  console.log('\n' + naked.length + ' of them still eat the first tap:');
  naked.forEach((n) => console.log('  ' + n));
  console.log('\nAdd keyboardShouldPersistTaps="handled". A button that needs a second');
  console.log('tap is a button people decide is broken.');
  process.exit(1);
}
console.log('PASS  every one of them lets the first tap through.');

/* And the fix has to be real rather than a string somewhere: prove the
   value is the one that actually works. 'never' and 'always' both
   compile and neither is right — 'never' is the broken default, and
   'always' keeps the keyboard up over the thing you just tapped. */
const wrong = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const re = /keyboardShouldPersistTaps\s*=\s*(?:"([^"]*)"|\{\s*'([^']*)'\s*\})/g;
  let m;
  while ((m = re.exec(s))) {
    const v = m[1] || m[2];
    if (v !== 'handled') wrong.push(f + ' → ' + v);
  }
}
if (wrong.length) {
  console.log('\nand these are set to something that does not fix it:');
  wrong.forEach((w) => console.log('  ' + w));
  process.exit(1);
}
console.log('PASS  all of them use "handled", not "never" or "always".');
