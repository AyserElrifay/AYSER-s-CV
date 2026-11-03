/* ─── A POLICY MAY ONLY CALL WHAT THE CALLER MAY CALL ────────────────
   Ayser, November 2026: "It did not go through. Try again." on every
   message. A restrictive policy on messages called card_ready() and
   table_host() — both revoked from `authenticated`. Postgres checks
   EXECUTE on every function in a policy, even in a branch that is never
   reached, so every insert (DMs included) failed with "permission denied
   for function table_host".

   This reads RUN_ME.sql, works out which functions end up closed to
   `authenticated`, and fails if the final version of any policy calls one
   of them directly. Wrap the check in a security definer function that
   is granted to authenticated instead.

       node scripts/check-policy-functions.mjs
*/
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8').replace(/--[^\n]*/g, '');

/* the last word on each function's EXECUTE for authenticated */
const closed = new Map();
const re = /\b(revoke|grant)\s+(?:all|execute)\s+on\s+function\s+public\.([a-z_0-9]+)\s*\([^)]*\)\s+(from|to)\s+([a-z_, ]+);/gi;
let m;
while ((m = re.exec(sql))) {
  const who = m[4].split(',').map((x) => x.trim());
  if (!who.includes('authenticated')) continue;
  closed.set(m[2], m[1].toLowerCase() === 'revoke');
}

/* the last version of each policy */
const pol = new Map();
const pre = /create\s+policy\s+"([^"]+)"\s+on\s+(public\.[a-z_0-9]+)([\s\S]*?);/gi;
while ((m = pre.exec(sql))) pol.set(m[2] + ' · ' + m[1], m[3]);
/* a policy dropped after its last create is gone */
const dre = /drop\s+policy\s+if\s+exists\s+"([^"]+)"\s+on\s+(public\.[a-z_0-9]+)/gi;
const lastDrop = new Map(), lastCreate = new Map();
while ((m = dre.exec(sql))) lastDrop.set(m[2] + ' · ' + m[1], m.index);
const cre = /create\s+policy\s+"([^"]+)"\s+on\s+(public\.[a-z_0-9]+)/gi;
while ((m = cre.exec(sql))) lastCreate.set(m[2] + ' · ' + m[1], m.index);

const bad = [];
for (const [key, body] of pol) {
  if ((lastDrop.get(key) || -1) > (lastCreate.get(key) || -1)) continue;
  const calls = [...body.matchAll(/public\.([a-z_0-9]+)\s*\(/gi)].map((x) => x[1]);
  for (const f of calls) if (closed.get(f) === true) bad.push(key + '  →  ' + f + '()');
}

if (bad.length) {
  console.log('Policies that call a function closed to signed-in people (every such insert/select fails):\n');
  bad.forEach((b) => console.log('  ' + b));
  console.log('\nWrap the check in a security definer function granted to authenticated.');
  process.exit(1);
}
console.log('Every policy calls only functions a signed-in person may call (' + pol.size + ' policies, ' + [...closed.values()].filter(Boolean).length + ' closed functions).');
