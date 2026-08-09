/* ─── TWO BUGS THAT KEEP COMING BACK ──────────────────────────────────
   Both of these are invisible to every other check in the project. The
   build succeeds, nothing is undefined, the app boots, and the fault
   only shows on a real phone in a way nobody connects to the code that
   caused it. Both were found the hard way, from screenshots, and both
   are mechanical enough that a machine can refuse them.

   ── 1. A COMPONENT DECLARED INSIDE ANOTHER COMPONENT ──
   Writing a small component inside a bigger one is the natural way to
   write React and the most expensive mistake you can make in it:

       const Screen = () => {
         const Row = ({ item }) => <View>…</View>;     // ← new every render
         return list.map((x) => <Row key={x.id} item={x} />);
       };

   React decides whether to UPDATE an element or REBUILD it by comparing
   its type — and the type here is that arrow function, a different
   object on every render. So React throws every row away and builds
   them again, on every keystroke. Images reload, scroll jumps, and a
   text box inside one loses your cursor between one letter and the
   next. That is exactly how "it types one letter and stops" happened in
   the group name box, and how Discover came to stutter as you typed.

   The fix is to lift it to module scope, or — when it genuinely needs
   the state around it — wrap it in useStable (src/hooks/useStable.js).

   ── 2. A STYLE THAT FROZE THE LIGHT THEME ──
   C is a live object the theme rewrites in place. A style object built
   at module scope reads it once, when the file is first loaded, which
   is before anybody has said whether they are in dark mode:

       const headerBtn = { backgroundColor: C.glass };   // ← light, for ever

   That is why the bell and the search button stayed white circles with
   white icons on them in dark mode. Make it a function so it reads the
   theme at the moment of drawing.

   Babel, not a regular expression — same standard as
   check-undefined.mjs. A check that cries wolf gets switched off.

       node scripts/check-rerender.mjs
*/

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (p.endsWith('.js') || p.endsWith('.jsx')) files.push(p);
  }
})('src');

const problems = [];

/* Is this declarator sitting at the top level of the module? */
const atModuleScope = (path) => {
  const fn = path.getFunctionParent();
  return !fn;
};

/* Does this subtree read the live theme object? */
const readsTheme = (path) => {
  let found = false;
  path.traverse({
    MemberExpression(m) {
      if (m.node.object && m.node.object.type === 'Identifier' && m.node.object.name === 'C') found = true;
    },
  });
  return found;
};

/* useStable(...) / React.memo(...) / memo(...) — already handled. */
const isWrapped = (init) => {
  if (!init || init.type !== 'CallExpression') return false;
  const c = init.callee;
  if (c.type === 'Identifier') return c.name === 'useStable' || c.name === 'memo' || c.name === 'forwardRef';
  if (c.type === 'MemberExpression' && c.property && c.property.type === 'Identifier') {
    return c.property.name === 'memo' || c.property.name === 'forwardRef';
  }
  return false;
};

for (const file of files) {
  const code = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator', 'objectRestSpread'],
    });
  } catch (e) {
    continue; // check-undefined.mjs is the one that reports parse failures
  }

  // every component name actually rendered as JSX in this file
  const rendered = new Set();
  traverse(ast, {
    JSXOpeningElement(p) {
      const n = p.node.name;
      if (n && n.type === 'JSXIdentifier' && /^[A-Z]/.test(n.name)) rendered.add(n.name);
    },
  });

  traverse(ast, {
    VariableDeclarator(path) {
      const id = path.node.id;
      const init = path.node.init;
      if (!id || id.type !== 'Identifier' || !init) return;
      const line = path.node.loc ? path.node.loc.start.line : 0;

      // ── 1. component declared inside another function, rendered as JSX
      const looksLikeComponent = /^[A-Z]/.test(id.name)
        && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression');
      if (looksLikeComponent && !atModuleScope(path) && rendered.has(id.name) && !isWrapped(init)) {
        problems.push(
          relative('.', file) + ':' + line + '  <' + id.name + '> is declared inside another component and ' +
          'rendered as JSX — React rebuilds it from scratch on every render. ' +
          'Lift it to module scope, or wrap it in useStable().'
        );
      }

      // ── 2. module-scope style object that captured the theme
      if (atModuleScope(path) && init.type === 'ObjectExpression') {
        const initPath = path.get('init');
        if (readsTheme(initPath)) {
          problems.push(
            relative('.', file) + ':' + line + '  ' + id.name + ' is built once at module scope and reads C.* — ' +
            'it captures whichever theme was active at import and keeps it all session. ' +
            'Make it a function so it reads the theme when it is drawn.'
          );
        }
      }
    },
  });
}

if (problems.length) {
  console.error('Re-render and theme problems:\n');
  problems.forEach((p) => console.error('  ' + p));
  console.error('\n' + problems.length + ' problem(s). None of these break the build — they break the phone.');
  process.exit(1);
}
console.log('Checked ' + files.length + ' files: no rebuilt-every-render components, no styles frozen to one theme.');
