/* ─── A BUTTON HAS TO WORK ON THE FIRST TAP ───────────────────────────
   Ayser: "في bug ان بعض الزراير بالذات في الedit ما بتشتغلش غير بضغطه
   طويله".

   Two separate things are held here, and the second is the one that
   was actually doing it — measured on the real edit sheet with real
   touch events, not reasoned about.

   1. keyboardShouldPersistTaps="handled" on every list. A first version
      of this check claimed the stock setting EATS the tap that dismisses
      the keyboard. On react-native-web it does not — that code is
      commented out in ScrollView. What the stock setting does do on the
      web is blur the focused field on release, which on a phone closes
      the keyboard, resizes the page and moves the button out from under
      the finger. "handled" stops that, and it is correct on native too,
      so it stays — but it was not the long-press bug.

   2. The long-press bug: on the web a Pressable's onPress fires from the
      browser's `click`, and clicks bubble. The edit sheet sat inside a
      "tap outside to close" backdrop with nothing in between to stop
      the click, so one quick tap on any field closed the whole sheet. A
      long press makes no click on a phone, which is why holding was the
      only thing that worked. Every backdrop's panel must stop the click.

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

/* ── AND THE ONE THAT WAS ACTUALLY DOING IT ─────────────────────────
   Reproduced on the real edit sheet with real touch events: one quick
   tap on the Bio field closed the whole sheet. On the web a
   Pressable's onPress fires from the browser's `click`, and clicks
   bubble — so a sheet sitting inside a "tap outside to close" backdrop
   has to stop the click at its own edge, or every tap on a field inside
   it is a tap on the backdrop. A long press makes no click on a phone,
   which is why holding was the only thing that worked.

   Every tap-outside backdrop's panel must be a Pressable whose onPress
   does nothing — that is the click stopping. Responder props like
   onStartShouldSetResponder do NOT stop a click and do not count. */
const BACK = /<Pressable\s+onPress=\{([^}]*?)\}\s+style=\{\{\s*position: 'absolute', top: 0, bottom: 0, left: 0, right: 0[^}]*\}\}\s*>/g;
let backdrops = 0;
const leaky = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  let m;
  BACK.lastIndex = 0;
  while ((m = BACK.exec(s))) {
    if (/=> \{\}/.test(m[1])) continue;
    backdrops++;
    const rest = s.slice(m.index + m[0].length, m.index + m[0].length + 4000).replace(/^\s*(\{\/\*[\s\S]*?\*\/\}\s*)*/, '');
    if (!/^<Pressable\s+onPress=\{\(\) => \{\}\}/.test(rest)) leaky.push(f + ':' + s.slice(0, m.index).split('\n').length);
  }
}
console.log('\ntap-outside-to-close backdrops: ' + backdrops);
if (leaky.length) {
  console.log(leaky.length + ' of them let a tap inside the sheet fall through and close it:');
  leaky.forEach((l) => console.log('  ' + l));
  process.exit(1);
}
console.log('PASS  every sheet stops a tap at its own edge.');
