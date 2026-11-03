/* ─── SQUAD PINS KEEP THEIR PROMISES ─────────────────────────────────
   Ayser, November 2026. A Squad Pin opens after three real Moments
   tables, never sits on a Thursday/Friday night table, disappears when
   the match is over and never says how few have joined. And the map
   search finds places and drops — never a person.

       node scripts/check-squad-pins.mjs
*/
import fs from 'node:fs';

let bad = 0;
const is = (name, got, want) => {
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : '  → ' + got + '  (wanted ' + want + ')'));
};

const sql = fs.readFileSync('supabase/RUN_ME.sql', 'utf8');
const i = sql.indexOf('SQUAD PINS · ');
const sec = i >= 0 ? sql.slice(i, sql.indexOf('SECURITY · WHAT ANYBODY CAN READ', i)) : '';
const svc = fs.readFileSync('src/services/squadPins.js', 'utf8');
const map = fs.readFileSync('src/screens/MapScreen.js', 'utf8');
const sheet = fs.readFileSync('src/components/SquadPinSheet.js', 'utf8');

console.log('the server');
is('the section is in RUN_ME.sql, before the security audit', i > 0 && i < sql.indexOf('SECURITY · WHAT ANYBODY CAN READ'), true);
is('three check-ins, counted on the server', /if n < 3 then return jsonb_build_object\('ok', false, 'reason', 'locked'/.test(sec), true);
is('Thursday and Friday 7 pm – midnight Cairo are blocked', /isodow from d\) in \(4, 5\)/.test(sec) && /time '19:00'/.test(sec) && /Africa\/Cairo/.test(sec) && /reason', 'flagship'/.test(sec), true);
is('a pin ends by itself (list shows only ends_at > now)', /p\.ends_at > now\(\)/.test(sec), true);
is('the list says what is left, not how many joined', /'left', greatest\(p\.need - j\.n, 0\)/.test(sec) && !/'going'|'joined'/.test(sec), true);
is('the tables are closed to the app', /revoke all on public\.squad_pins, public\.squad_pin_joins from anon, authenticated/.test(sec), true);
is('need limits: padel and study 3, football 9', /case p_kind when 'football' then 9 else 3 end/.test(sec), true);

console.log('\nthe app');
is('never "going" in the line people read', !/going/i.test(svc.slice(svc.indexOf('export function squadLine'))) && /Need \$\{left\} more/.test(svc), true);
is('the teaser says how far along you are', /Current: \$\{n\}\/\$\{SQUAD_UNLOCK\}/.test(sheet), true);
is('the map search does not look for people', !/nearbyPeople\.forEach\(\(p\) => \{\s*if \(\(p\.name/.test(map) && !/kind: 'person', name: p\.name/.test(map), true);
is('the squad sheet is loaded only when opened', /lazyOverlay\(\(\) => import\('\.\.\/components\/SquadPinSheet'\)/.test(map), true);

console.log(bad ? '\n' + bad + ' wrong.' : '\nSquad Pins: three tables to open, never on a Drop night, never "1 going".');
process.exit(bad ? 1 : 0);
