/* ─── THE COUNTRY ROOM HAS TO BE COMPLETE ────────────────────────────
   This room is content, and content rots differently from code: a
   country added in a hurry with eight phrases and no customs does not
   crash anything. It just quietly becomes the thin, half-finished
   thing that makes somebody stop trusting the rest of the app.

   So the shape is enforced. Every country carries a full set, every
   phrase belongs to one of the four moments the sheet groups by, every
   entry that has an English line has the Arabic line beside it, and
   the map's index agrees with the rooms it points at.               */
import { COUNTRY_ROOMS } from '../src/constants/countryRoom.js';
import { ROOM_CODES } from '../src/constants/countryRoomIndex.js';

const GROUPS = new Set(['first', 'eat', 'go', 'help']);
const MIN = { say: 12, eat: 4, know: 3, hear: 3, warm: 4 };
const problems = [];
const seen = new Set();

for (const c of COUNTRY_ROOMS) {
  const at = (m) => problems.push((c.code || '(no code)') + ': ' + m);
  for (const f of ['code', 'name', 'nameAr', 'lang', 'langAr', 'filmLang']) {
    if (!c[f]) at('has no ' + f);
  }
  if (seen.has(c.code)) at('appears twice'); else seen.add(c.code);

  for (const [key, min] of Object.entries(MIN)) {
    const rows = c[key];
    if (!Array.isArray(rows) || rows.length < min) {
      at('has ' + ((rows && rows.length) || 0) + ' ' + key + ', and the room needs at least ' + min);
    }
  }

  (c.say || []).forEach((p, i) => {
    if (!GROUPS.has(p.g)) at('phrase ' + i + ' is in group "' + p.g + '", which the sheet does not draw');
    for (const f of ['native', 'how', 'en', 'ar']) if (!p[f]) at('phrase ' + i + ' has no ' + f);
  });
  for (const g of GROUPS) {
    if (!(c.say || []).some((p) => p.g === g)) at('has nothing at all to say in the "' + g + '" moment');
  }

  /* The greeting and what it means is the thing he asked for by name,
     and it is the first thing anybody sees in the room. A country
     without one is a country with a blank at the top of its page. */
  const h = c.hello;
  if (!h) at('has no greeting at all');
  else {
    for (const f of ['native', 'how', 'means', 'meansAr']) if (!h[f]) at('the greeting has no ' + f);
    if (!h.bye) at('has a hello and no goodbye');
    else for (const f of ['native', 'how', 'means', 'meansAr']) if (!h.bye[f]) at('the goodbye has no ' + f);
  }
  (c.warm || []).forEach((w, i) => {
    for (const f of ['native', 'how', 'en', 'ar', 'when', 'whenAr']) {
      if (!w[f]) at('warm word ' + i + ' has no ' + f);
    }
  });

  (c.eat || []).forEach((d, i) => {
    for (const f of ['name', 'what', 'whatAr']) if (!d[f]) at('dish ' + i + ' has no ' + f);
  });
  (c.know || []).forEach((k, i) => {
    for (const f of ['title', 'titleAr', 'body', 'bodyAr']) if (!k[f]) at('custom ' + i + ' has no ' + f);
  });
  (c.hear || []).forEach((h, i) => {
    for (const f of ['artist', 'why', 'whyAr']) if (!h[f]) at('music ' + i + ' has no ' + f);
  });
}

/* The map offers the row from a separate tiny index so it does not have
   to load the rooms. Two lists means they can drift, and a row that
   opens an empty room is worse than no row at all. */
const roomCodes = new Set(COUNTRY_ROOMS.map((c) => c.code));
for (const [name, code] of ROOM_CODES) {
  if (!roomCodes.has(code)) {
    problems.push('the map offers ' + name + ' → ' + code + ', and there is no such room');
  }
}
for (const code of roomCodes) {
  if (![...ROOM_CODES.values()].includes(code)) {
    problems.push('there is a room for ' + code + ' that the map can never open');
  }
}

if (problems.length) {
  console.error('The country room is not complete:\n');
  problems.forEach((p) => console.error('  • ' + p));
  console.error('');
  process.exit(1);
}
console.log(
  'Country room: ' + COUNTRY_ROOMS.length + ' countries, ' +
  COUNTRY_ROOMS.reduce((a, c) => a + c.say.length, 0) + ' phrases, ' +
  COUNTRY_ROOMS.reduce((a, c) => a + c.warm.length, 0) + ' warm words, ' +
  COUNTRY_ROOMS.reduce((a, c) => a + c.eat.length, 0) + ' dishes, ' +
  COUNTRY_ROOMS.reduce((a, c) => a + c.know.length, 0) + ' customs, ' +
  COUNTRY_ROOMS.reduce((a, c) => a + c.hear.length, 0) + ' artists — all complete, and the map agrees.'
);
