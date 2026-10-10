/* ─── A PUBLIC PLACE'S PHOTO: FREE, CREDITED, AND OF THAT PLACE ───────
       node scripts/check-commons-photo.mjs
*/
import fs from 'node:fs';
import { sameName, pickPage, creditOf } from '../src/lib/commonsPhoto.js';
let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const pg = (title, dist) => ({ title, dist, pageimage: title + '.jpg', thumbnail: { source: 'https://upload.wikimedia.org/x/' + title + '.jpg' } });

console.log('the name has to match');
is('Cairo Opera House is not Cairo Tower', sameName('Cairo Opera House', 'Cairo Tower'), false);
is('but it is the Cairo Opera House', sameName('Cairo Opera House', 'Cairo Opera House'), true);
is('Al-Azhar Park is not Al-Azhar Mosque', sameName('Al-Azhar Park', 'Al-Azhar Mosque'), false);
is('Old City of Jerusalem is "Old City (Jerusalem)"', sameName('Old City of Jerusalem', 'Old City (Jerusalem)'), true);
is('accents do not matter', sameName('Château de Chambord', 'Chateau de Chambord'), true);
is('a name of only small words matches nothing', sameName('The Old City', 'Old City'), false);

console.log('\nwhich article');
is('the one that names it, not the nearest', pickPage('Al-Azhar Park', [pg('Al-Azhar Mosque', 300), pg('Al-Azhar Park', 900)]).title, 'Al-Azhar Park');
is('no article names it: no photo', pickPage('Battir Terraces', [pg('Bethlehem', 400), pg('Beit Jala', 800)]), null);
is('an article with no free image is skipped', pickPage('Cairo Tower', [{ title: 'Cairo Tower', dist: 10 }]), null);

console.log('\nthe credit');
is('author and licence, without the HTML', creditOf({ Artist: { value: '<a href="x">Jane Doe</a>' }, LicenseShortName: { value: 'CC BY-SA 4.0' } }), { artist: 'Jane Doe', license: 'CC BY-SA 4.0' });
is('no licence stated: not shown at all', creditOf({ Artist: { value: 'Someone' } }), null);

console.log('\nthe code');
const lib = fs.readFileSync('src/lib/commonsPhoto.js', 'utf8');
const map = fs.readFileSync('src/screens/MapScreen.js', 'utf8') + fs.readFileSync('src/components/PlacePhoto.js', 'utf8');
is('only free images are asked for', /pilicense=free/.test(lib), true);
is('asked only when a place is opened, and kept a month', /MONTH = 30 \* 24 \* 3600 \* 1000/.test(lib) && /placePhoto\(/.test(map), true);
is('the photo is shown with its credit and a link to its page', /photo_credit/.test(map) && /openURL\(photo\.page\)/.test(map) && /<PlacePhoto place=\{placeOpen\}/.test(map) && /<PlacePhoto place=\{destOpen\}/.test(map), true);
if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nA public place shows a photo only when a free one of THAT place exists, and says whose it is.');
