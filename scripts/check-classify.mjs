/* ─── A POST THAT NOBODY TAGGED STILL BELONGS SOMEWHERE ───────────────
   "خلي الاب يحاول يعمل [يحدد] حتي للفديوز من غير هستاج من الكبشنز او من
   الكومنتس — او لو الفديوز صغير يعصنفها حاجه ذي fyp".

   Most people never write a hashtag. Their post then belongs to no room
   at all, and the rooms sit empty while the posts that should be in
   them sit in a feed nobody filters. This is the lexicon that reads a
   caption and says which room it sounds like.

   Two things have to be true of it, and they pull against each other:
   it has to match the way people really write — Egyptian spelling, no
   short vowels, ة and ه used interchangeably — and it must not guess
   wildly, because a post filed in the wrong room is worse than a post
   filed in none.

       node scripts/check-classify.mjs
*/
import fs from 'node:fs';
import { suggestRooms, suggestTags, writtenTags, roomFor, normalise, FYP } from '../src/lib/classify.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};
const top = (t) => { const r = suggestRooms(t, { limit: 1 })[0]; return r ? r.slug : null; };

console.log('the way Arabic is actually typed on a phone');
is('short vowels are ignored', normalise('قَهْوَة'), 'قهوه');
is('أ إ آ are all ا', normalise('أهوة إسكندرية آسف'), 'اهوه اسكندريه اسف');
is('ة and ه are the same letter here', normalise('رحلة') === normalise('رحله'), true);
is('and ى is ي', normalise('على'), 'علي');

console.log('\nreading a caption nobody tagged');
is('a trip', top('اخيرا الرحلة بدأت'), 'travel-with-friends');
is('the same word spelled the other way', top('اخيرا الرحله بدات'), 'travel-with-friends');
is('a coffee', top('قاعدين على القهوة'), 'ahwa');
is('the gym', top('اول يوم في الجيم'), 'gym-day');
is('a cat', top('القطة بتاعتي كسرت الكباية'), 'pets');
is('football', top('الماتش النهارده'), 'football');
is('asking for help', top('محتاج حد يساعدني في الاقامة'), 'help-me');
/* A restaurant is mentioned, and it is not a post about restaurants —
   it is somebody asking for one, and the room that gets it answered is
   the asking room. */
is('asking for a recommendation beats the subject asked about', top('رشحولي مطعم كويس'), 'recommend-me');
is('and asking for help beats the thing being asked about', top('محتاج حد يرشحلي جيم'), 'help-me');
is('and the same in English', top('first day at the gym'), 'gym-day');
is('a question in English', top('how do i register my address here'), 'help-me');
is('a sunset', top('sunset from the balcony'), 'sunset');
is('somewhere in Egypt', top('walking around Cairo today'), 'egypt-now');

console.log('\nand when it genuinely cannot tell');
is('a caption with nothing in it → no guess', suggestRooms('hmmmm'), []);
is('an empty caption → no guess', suggestRooms(''), []);
is('nothing at all → no guess, no throw', suggestRooms(null), []);
/* This is the part he asked for by name: a post that matches nothing
   is not left in nowhere, it is put in a room that says "we do not
   know" out loud. */
is('a post that matches nothing goes to FYP', roomFor({ caption: 'hmmmm' }).slug, FYP);
/* Where a photo was taken is a fact about the photo, not its subject.
   Folding the place into the classification filed every post with
   "Cairo" on it under Egypt, emptied For You, and flooded one room. */
is('and the PLACE never files it', roomFor({ caption: 'hmmmm', place: 'Cairo' }).slug, FYP);
is('and it is labelled as a guess of last resort', roomFor({ caption: 'hmmmm' }).source, 'fyp');

console.log('\nwhat somebody WROTE always wins');
is('their hashtags are read', writtenTags('a day out #CairoNights #ahwa'), ['CairoNights', 'ahwa']);
is('Arabic hashtags too', writtenTags('#رحلتي كانت حلوة'), ['رحلتي']);
is('a written tag beats a guessed room', roomFor({ caption: 'في الجيم #MyStreet' }).source, 'written');
is('and it is their tag that is used', roomFor({ caption: 'في الجيم #MyStreet' }).tag, '#MyStreet');

console.log('\nthe chips offered while posting');
const topics = [{ slug: 'gym-day', tag: '#GymDay' }, { slug: 'ahwa', tag: '#Ahwa' }];
is('a suggestion uses the room\'s real tag, not a made-up one',
   suggestTags('اول يوم في الجيم', { topics }), ['#GymDay']);
is('one they already chose is not offered again',
   suggestTags('اول يوم في الجيم', { topics, taken: ['#GymDay'] }), []);
is('never more than five', suggestTags('رحلة قهوة جيم قطة كورة مطعم غروب', { topics, limit: 5 }).length <= 5, true);
is('and nothing at all is a fine answer', suggestTags('', { topics }), []);

console.log('\nit must not guess wildly — a wrong room is worse than none');
is('a single stop word matches nothing', suggestRooms('the'), []);
is('a word inside another word does not count', top('travelling salesman'), 'travel-with-friends');
is('"catalogue" is not a cat', suggestRooms('catalogue').some((r) => r.slug === 'pets'), false);
is('"scattered" is not a cat either', suggestRooms('scattered').some((r) => r.slug === 'pets'), false);

console.log('\nand the app has to use it');
const code = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const capture = code('src/components/CaptureModal.js');
is('the capture screen offers what the caption suggests', /suggestTags\(/.test(capture), true);
is('and it is a suggestion, not a decision — chips you tap', /addTag\(/.test(capture), true);

if (bad) {
  console.log('\n' + bad + ' wrong. Posts are landing in the wrong room, or in none at all.');
  process.exit(1);
}
console.log('\nEvery post lands somewhere, and what somebody wrote always wins.');
