/* ─── FILMS: A FEW, FOR YOU, AND A REASON TO MEET ─────────────────────
   The spec, point by point:
     · no music list, no 5-star ratings, no text reviews
     · a bold "Watch together" that opens the start-a-plan form, filled
       in with the film
     · keep the streaming links
     · interests → genres, and only the top 10–15 for that person
     · the catalogue covers Egypt, Morocco and the 27 EU states

       node scripts/check-film-picks.mjs
*/
import fs from 'node:fs';
import { pickFilms, tasteOf, regionOf, FILM_REGIONS, PICKS } from '../src/lib/filmPicks.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const read = (f) => fs.readFileSync(f, 'utf8');

console.log('the countries');
const EU = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
is('29 of them', FILM_REGIONS.length, 29);
is('Egypt and Morocco', FILM_REGIONS.includes('EG') && FILM_REGIONS.includes('MA'), true);
is('and every EU member state', EU.every((c) => FILM_REGIONS.includes(c)), true);
is('a country we do not pull for has no region', regionOf({ country: 'US' }), null);
is('Estonia is one', regionOf({ country: 'ee' }), 'EE');

console.log('\ninterests → genres');
const hiker = tasteOf({ hobbies: '🥾 Hiking, 🏕️ Camping' });
is('a hiker leans to adventure', (hiker.Adventure || 0) > 0 && (hiker.Adventure || 0) >= (hiker.Comedy || 0), true);
is('somebody who loves cooking leans to comedy and family', (tasteOf({ hobbies: '🍳 Cooking' }).Comedy || 0) > 0, true);
is('no hobbies, no taste', tasteOf({}), {});

console.log('\nthe list');
const films = [];
for (let i = 0; i < 60; i++) {
  films.push({ id: i, title: 'Film ' + i, poster_url: 'p' + i, popularity: 100 - i,
    genres: i % 3 === 0 ? ['Adventure'] : i % 3 === 1 ? ['Comedy'] : ['Horror'],
    regions: i === 59 ? ['EG'] : null, language: 'en' });
}
films.push({ id: 99, title: 'No poster', poster_url: null, popularity: 1000, genres: ['Adventure'] });
films.push({ id: 100, title: 'film 0', poster_url: 'dup', popularity: 1, genres: ['Adventure'] });
const picks = pickFilms(films, { hobbies: 'Hiking', country: 'EG' });
is('never more than ' + PICKS + ' — no endless shelf', picks.length, PICKS);
is('and 10 to 15 is what was asked', PICKS >= 10 && PICKS <= 15, true);
is('a hiker gets adventure first', picks.slice(0, 5).every((f) => f.genres.includes('Adventure')), true);
is('nothing without a poster', picks.some((f) => !f.poster_url), false);
is('no title twice', new Set(picks.map((f) => f.title.toLowerCase())).size, picks.length);
const two = [
  { id: 1, title: 'Popular, not streamed here', poster_url: 'a', popularity: 100, genres: ['Adventure'], regions: ['FR'] },
  { id: 2, title: 'Less popular, on in Egypt', poster_url: 'b', popularity: 40, genres: ['Adventure'], regions: ['EG'] },
];
is('streamable in your country comes first', pickFilms(two, { hobbies: 'Hiking', country: 'EG' })[0].id, 2);
is('in France the other way round', pickFilms(two, { hobbies: 'Hiking', country: 'FR' })[0].id, 1);
is('nobody gets an empty list for having no hobbies', pickFilms(films, {}).length, PICKS);

console.log('\nthe screens');
const chill = read('src/screens/ChillScreen.js');
const sheet = read('src/components/FilmSheet.js');
const svc = read('src/services/films.js');
is('no music list on the Chill tab', /sec_listen|MusicHubSheet|listenSample/.test(chill), false);
is('the Chill tab shows the picked list', /pickFilms\(rows, prof/.test(chill), true);
is('no genre picker to scroll through', /FILM_GENRES/.test(chill), false);
is('no stars on the film sheet', /star-outline|Stars value|saveReview|fetchReviews/.test(sheet), false);
is('no review functions left in the service', /saveReview|fetchReviews|film_reviews/.test(svc), false);
is('a bold Watch together on the sheet', /film_watch_together/.test(sheet) && /onWatchTogether\(film\)/.test(sheet), true);
is('it opens the start-a-plan form, filled in', /<GreenSheet startNow[^>]*prefill=\{movieNight\}/.test(chill) && /kind: 'movie'/.test(chill), true);
is('the form takes the film as its title', /\(prefill && prefill\.title\)/.test(read('src/components/green/GreenSheet.js')), true);
is('the streaming links stay', /watchOptions\(film, region\)/.test(sheet) && /netflix\.com/.test(svc) && /shahid/.test(svc), true);
is('where-to-watch data is credited', /JustWatch/.test(read('src/constants/i18n.js')), true);

console.log('\nthe database and the import');
const sql = read('supabase/RUN_ME.sql');
const imp = read('scripts/import-films.mjs');
is('movie night is a kind of plan', /'focus','movie'\]/.test(sql) && /p_kind = any\(public\.green_kinds\(\)\)/.test(sql), true);
is('nobody can write a review any more', /drop policy if exists "write your own review"\s+on public\.film_reviews;\s*\ndrop policy if exists "change your own review" on public\.film_reviews;/.test(sql.slice(sql.lastIndexOf('FILMS · WATCH TOGETHER'))), true);
is('films know where they stream', /add column if not exists regions\s+text\[\]/.test(sql) && /add column if not exists providers jsonb/.test(sql), true);
is('the import asks each of the 29 countries', /for \(const region of FILM_REGIONS\)/.test(imp) && /watch_region: region/.test(imp), true);
is('and which services carry each title there', /\/watch\/providers/.test(imp), true);

if (bad) { console.log('\n' + bad + ' wrong.'); process.exit(1); }
console.log('\nA short list for you, each one a reason to meet, and where it really streams.');
