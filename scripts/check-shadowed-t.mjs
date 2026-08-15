/* ─── t IS THE TRANSLATOR, OR IT IS A TRACK. NEVER BOTH. ──────────────
   Translating the music hub, I put {t('use_track')} inside a component
   whose prop was already called `t` — a track. It would have thrown
   "t is not a function" the first time a Use button appeared.

   Nothing else catches this. The build is fine: `t` IS defined, just
   bound to a song. check-undefined.mjs asks whether a name exists, and
   it does. Only a person reading carefully would notice, and I did not.

   The test is not "is there a `t` parameter" — plenty of components
   are correctly HANDED the translator as a prop called t, and a loop
   variable called t in a file that never translates is nobody's
   business. The contradiction is narrower and exact:

       in one scope, `t` is called as a function AND read as an object

   t('use_track') next to t.id. One of those is wrong, always, and which
   one it is does not matter — the name has to stop meaning two things.
   Rename the data one: track, item, tag.

       node scripts/check-shadowed-t.mjs
*/

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (p.endsWith('.js')) files.push(p);
  }
})(process.argv[2] || 'src');   // a path, so this can be run over the
                                // code from before a fix and prove it fails

const problems = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!/\bt\(/.test(src)) continue;
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) { continue; }

  traverse(ast, {
    CallExpression(path) {
      const c = path.node.callee;
      if (c.type !== 'Identifier' || c.name !== 't') return;

      const binding = path.scope.getBinding('t');
      if (!binding) return;                     // module-level helper, not ours

      /* Is the very same `t` also read as an object anywhere?
         t.id, t.title, t.score — then it is data, and calling it is a
         crash waiting for the right branch to run. */
      const asObject = binding.referencePaths.filter((r) => {
        const p = r.parentPath;
        return p && p.isMemberExpression() && p.node.object === r.node;
      });
      if (!asObject.length) return;

      problems.push({
        file,
        line: path.node.loc ? path.node.loc.start.line : 0,
        what: "t() is called here, but the same `t` is read as an object at line "
              + (asObject[0].node.loc ? asObject[0].node.loc.start.line : '?')
              + " — one of them is not the translator",
      });
    },
  });
}

if (problems.length) {
  console.log('`t` means two things in ' + problems.length + ' place(s):\n');
  for (const p of problems) console.log('  ' + p.file + ':' + p.line + '\n     ' + p.what);
  console.log('\nRename the one that is data. The translator keeps the name.');
  process.exit(1);
}

console.log('Checked ' + files.length + ' files: `t` is always the translator where it is called.');
