/* ─── COMPONENTS THAT DON'T EXIST ────────────────────────────────────
   `<MediaLibrarySheet …>` was rendered in the capture screen without
   ever being imported. Nothing caught it: Metro bundles fine, the
   export succeeds, the app boots, and the tests pass — because the line
   only runs when somebody opens the library. It reached a real phone
   and crashed the tab with "Can't find variable: MediaLibrarySheet".
   `<EffectsSheet>` was one tap away from doing the same.

   That is the worst shape a bug can have: invisible to every automatic
   check and guaranteed to hit a person. So this looks at every JSX tag
   in the project and asks whether the name behind it exists in that
   file at all — imported, declared, or destructured.

   It errs toward silence. A name it cannot account for is reported;
   anything it can, it leaves alone. Run before deploying:

       node scripts/check-undefined.mjs
*/

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const ROOTS = ['src', 'App.js'];

/* Names that are always in scope, or that come from somewhere this
   script can't see. Keep this list short — every entry is a blind
   spot. */
const ALWAYS = new Set(['React', 'Fragment']);

function collect(target, out) {
  if (!existsSync(target)) return out;
  if (statSync(target).isDirectory()) {
    for (const e of readdirSync(target)) collect(join(target, e), out);
  } else if (/\.jsx?$/.test(target)) {
    out.push(target);
  }
  return out;
}

/* Strip block and line comments so a component named inside prose —
   "what <Image> sources" — isn't mistaken for a real one. Strings are
   left alone: a tag inside a string is rare and harmless. */
function decomment(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const problems = [];

for (const file of collect(ROOTS[0], []).concat(collect(ROOTS[1], []))) {
  const raw = readFileSync(file, 'utf8');
  const src = decomment(raw);

  const known = new Set(ALWAYS);

  // import { A, B as C } from '…'  /  import D from '…'  /  import * as E
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]/g)) {
    for (const n of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) known.add(n[0]);
  }
  // const Foo = …, function Foo, class Foo
  for (const m of src.matchAll(/(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) known.add(m[1]);
  // destructured out of props or objects: const { Foo } = …
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const n of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) known.add(n[0]);
  }
  // function parameters, including destructured ones — a component
  // passed in as an argument is perfectly legitimate
  for (const m of src.matchAll(/(?:function\s*[\w$]*\s*|\)\s*=>|\(\s*)?\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const n of m[1].matchAll(/[A-Za-z_$][\w$]*/g)) known.add(n[0]);
  }

  for (const m of src.matchAll(/<([A-Z][\w$]*)(?:\.[\w$]+)*(?=[\s/>])/g)) {
    const root = m[1];
    if (known.has(root)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    problems.push(file + ':' + line + '  <' + root + '> is rendered but never imported or defined');
  }
}

if (problems.length) {
  console.error('Components rendered without existing:\n');
  problems.forEach((p) => console.error('  ' + p));
  console.error('\n' + problems.length + ' problem(s). Each one crashes the moment that branch runs.');
  process.exit(1);
}
console.log('Every component rendered in this project exists where it is used.');
