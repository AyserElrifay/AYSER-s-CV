/* ─── THE DATABASE MUST NOT TALK TO USERS ─────────────────────────────
   Postgres, PostgREST and fetch all write for whoever is on call. When
   their words reach a screen, somebody who wanted to see their friends
   reads this instead:

       Couldn't load moments
       Could not find the table 'public.posts' in the schema cache

   That sentence names a table, a schema and a cache. It tells the
   person nothing they can act on, and it tells anybody looking over
   their shoulder how the app is built. "Failed to fetch" is the same
   thing in fewer words.

   The shape it always takes is a raw message used as the fallback in a
   state setter:

       setError(e.message || 'Could not share. Try again.');
                ^^^^^^^^^ the good sentence is right there, unused
                           whenever the server says anything at all

   The fix is to delete the raw half. The human half was already
   written; it just never ran. Where a screen needs to say something
   different depending on WHY, sort the failure with
   src/lib/explain.js — setup, permission, or connection — and pick a
   sentence from that.

   ── WHAT THIS DOES NOT FLAG ──
   Reading a message to DECIDE something is fine and necessary:

       /does not exist/.test(e.message || '')   // ← a branch, not a render

   And the Studio is exempt. It opens for one person behind a private
   link and an owner check (App.js), and Ayser debugging his own app
   should see exactly what the server said.

   Babel, not a regular expression — same standard as the other checks.
   A check that cries wolf gets switched off.

       node scripts/check-leaks.mjs
*/

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

/* Owner-only surfaces. Real errors here are the point. */
const EXEMPT = [/AdminPanel\.js$/, /lib\/plumbing\.js$/];

/* Words that only mean something to whoever built this. */
const PLUMBING = /RUN_ME|SQL Editor|schema cache|supabase\/RUN_ME|Supabase (SQL|\u2192)/i;

/* Point it at another tree to check one — used to prove this catches
   what it claims by running it over the code from before the fix. */
const ROOT = process.argv[2] || 'src';

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (p.endsWith('.js') || p.endsWith('.jsx')) files.push(p);
  }
})(ROOT);

const problems = [];

/* setError(…), setErr(…), setMsg(…), setNote(…) — anything that parks a
   value in state a screen can draw. */
const isStateSetter = (callee) =>
  callee.type === 'Identifier' && /^set[A-Z]/.test(callee.name);

/* .test(x) / .match(x) / .includes(x) — the message is being READ to
   choose a branch, and never reaches a screen. */
const INSPECTORS = new Set(['test', 'match', 'includes', 'search', 'exec']);

const insideAnInspector = (path) => {
  let p = path.parentPath;
  while (p) {
    if (p.node.type === 'CallExpression') {
      const c = p.node.callee;
      if (c.type === 'MemberExpression' && c.property.type === 'Identifier'
          && INSPECTORS.has(c.property.name)) return true;
    }
    p = p.parentPath;
  }
  return false;
};

for (const file of files) {
  if (EXEMPT.some((r) => r.test(file))) continue;
  const src = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'] });
  } catch (e) {
    problems.push({ file, line: 0, what: 'could not be parsed: ' + e.message });
    continue;
  }

  traverse(ast, {
    /* ── 2. A DEVELOPER'S INSTRUCTION, ADDRESSED TO A STRANGER ──
       "run supabase/RUN_ME.sql in the Supabase SQL Editor" is a true
       sentence sent to the wrong person: a file they cannot open and a
       tool they do not have. It is only useful to Ayser, so it has to
       be inside setupNotice(), which hands it to him and gives
       everybody else a sentence about the app instead. */
    StringLiteral(path) {
      if (!PLUMBING.test(path.node.value)) return;
      // an import path is not a sentence anybody reads
      if (path.parent.type === 'ImportDeclaration' || path.parent.type === 'ExportNamedDeclaration') return;
      let p = path.parentPath;
      let wrapped = false;
      while (p) {
        if (p.node.type === 'CallExpression' && p.node.callee.type === 'Identifier'
            && p.node.callee.name === 'setupNotice') { wrapped = true; break; }
        p = p.parentPath;
      }
      if (wrapped) return;
      problems.push({
        file,
        line: path.node.loc ? path.node.loc.start.line : 0,
        what: 'tells whoever is reading it to run the project\'s own setup: "'
              + path.node.value.slice(0, 60) + '…"',
      });
    },

    CallExpression(path) {
      if (!isStateSetter(path.node.callee)) return;
      path.traverse({
        MemberExpression(m) {
          if (!m.node.property || m.node.property.type !== 'Identifier') return;
          if (m.node.property.name !== 'message') return;
          if (insideAnInspector(m)) return;
          problems.push({
            file,
            line: m.node.loc ? m.node.loc.start.line : 0,
            what: path.node.callee.name + '(…) can put the server\'s own words on screen',
          });
        },
      });
    },
  });
}

if (problems.length) {
  console.log('The database is talking to users in ' + problems.length + ' place(s):\n');
  for (const p of problems) console.log('  ' + p.file + ':' + p.line + '\n     ' + p.what);
  console.log('\nDelete the raw half. The human sentence beside it was already written.');
  console.log('If the screen needs to say something different per cause, use src/lib/explain.js.');
  process.exit(1);
}

console.log('Checked ' + files.length + ' files: no server messages reach a screen.');
