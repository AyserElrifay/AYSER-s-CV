/* ─── WHAT IS THIS POST ABOUT, WHEN NOBODY SAID ───────────────────────
   Ayser: "خلي الاب يحاول يعمل [يحدد] حتي للفديوز من غير هستاج من
   الكبشنز او من الكومنتس — او لو الفديوز صغير يعصنفها حاجه ذي fyp".

   Most people do not write hashtags. They write "أخيرا وصلت براغ" or
   "first day at the gym", and the post then belongs to no room at all
   — it is posted into nowhere and found by nobody. Meanwhile the rooms
   exist and are empty, which makes the app look dead when it is only
   badly filed.

   ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ───────────────────
   It is a lexicon: words, in the languages this app is actually used
   in, mapped to the rooms that already exist. It is not a model, it
   does not learn, and it never sends a caption anywhere — which is
   worth more than accuracy here, because every decision it makes can
   be explained by pointing at the word that caused it.

   And it never silently files a post under something. What it produces
   is a SUGGESTION: at the moment of posting, the tags it found are
   offered as chips to tap. The person writing still owns their words.
   The only thing it does on its own is the last resort — a post that
   matches nothing lands in FYP, which is a room for "we do not know",
   honestly labelled, rather than in nothing at all.

       node scripts/check-classify.mjs
*/

/* The room every unclaimed post goes to. Not a category — an admission,
   and the same one every big app makes when it says "For you". */
export const FYP = 'fyp';

/* Room slug → the words that mean it, in the languages people here
   actually write in. Arabic is first in each list because that is what
   most of this app's captions are written in, and because the Egyptian
   spelling of a word is not the dictionary one — "قهوه" and "قهوة"
   are both correct on a phone and only one of them is in a dictionary. */
const LEXICON = {
  'travel-with-friends': ['رحلة', 'رحله', 'سفر', 'مسافر', 'مسافرين', 'trip', 'travel', 'travelling',
    'traveling', 'roadtrip', 'backpacking', 'flight', 'airport', 'مطار', 'طيارة', 'طياره'],
  'egypt-now': ['مصر', 'القاهرة', 'القاهره', 'الاسكندرية', 'اسكندرية', 'اسوان', 'الاقصر', 'سيناء',
    'egypt', 'cairo', 'alexandria', 'aswan', 'luxor', 'sinai', 'nile', 'النيل'],
    /* "balcony" was in here and it cost the sunset room every caption
     with a balcony in it — a word that belongs to two rooms belongs
     to neither. */
  'cairo-nights': ['بالليل', 'الليل', 'سهرة', 'سهره', 'nightout', 'nights', 'tonight'],
  'ahwa': ['قهوة', 'قهوه', 'أهوة', 'اهوه', 'شاي', 'شيشة', 'شيشه', 'طاولة', 'coffee', 'tea', 'shisha',
    'cafe', 'café', 'backgammon'],
  'my-cooking': ['طبخ', 'طبخت', 'اكلي', 'مطبخ', 'وصفة', 'وصفه', 'cooking', 'cooked', 'recipe', 'kitchen',
    'baking', 'baked'],
  'food-here': ['اكل', 'أكل', 'مطعم', 'فطار', 'غدا', 'عشا', 'food', 'restaurant', 'breakfast', 'lunch',
    'dinner', 'eat', 'eating', 'street food'],
  'gym-day': ['جيم', 'تمرين', 'حديد', 'رياضة', 'رياضه', 'جري', 'gym', 'workout', 'training', 'running',
    'run', 'lifting', 'fitness'],
  'sunset': ['غروب', 'شروق', 'سما', 'السما', 'sunset', 'sunrise', 'sky', 'golden hour'],
  'learning-english': ['انجليزي', 'إنجليزي', 'english', 'learning english', 'vocabulary', 'grammar'],
  'please-correct-me': ['صححلي', 'صحح', 'غلط', 'correct me', 'is this right', 'my mistake'],
  'daily-sentence': ['جملة اليوم', 'جمله', 'sentence', 'daily sentence', 'one line'],
  'help-me': ['محتاج', 'محتاجة', 'مساعدة', 'مساعده', 'ساعدوني', 'ازاي', 'إزاي', 'help', 'how do i',
    'how to', 'anyone know', 'does anyone', 'need advice', 'محتار'],
  'recommend-me': ['رشحلي', 'رشحولي', 'رشحوا', 'ترشيح', 'اقترحوا', 'اقترحولي', 'recommend', 'suggestions', 'any recommendations',
    'what should i', 'best place'],
  'football': ['كورة', 'كوره', 'ماتش', 'الأهلي', 'الاهلي', 'الزمالك', 'football', 'match', 'goal',
    'derby', 'stadium', 'ملعب'],
  'first-moment': ['اول بوست', 'أول بوست', 'first post', 'first moment', 'new here', 'hello everyone',
    'جديد هنا'],
  'meet-up': ['نتقابل', 'مقابلة', 'لمة', 'لمّة', 'meet up', 'meetup', 'meeting', 'who is coming',
    'who wants to', 'مين جاي', 'مين معايا'],
  'my-street': ['شارع', 'الشارع', 'حارتنا', 'street', 'my street', 'neighbourhood', 'neighborhood'],
  'pets': ['قطة', 'قطه', 'قط', 'كلب', 'كلبي', 'حيوان', 'cat', 'dog', 'puppy', 'kitten', 'pet'],
};

/* Words that mean nothing about a subject and everything about how a
   sentence is built. Left out of the count so that "the" never wins. */
const STOP = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'just', 'about',
  'في', 'من', 'على', 'عن', 'مع', 'ده', 'دي', 'اللي', 'كان', 'بعد', 'قبل', 'انا', 'أنا', 'يا']);

/* Arabic is written with and without its short vowels, and a phone
   keyboard produces both — so أ إ آ all fold to ا, and ة to ه, before
   anything is compared. Without this half the lexicon never matches.  */
export function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')          // harakat and tatweel
    .replace(/[أإآ]/g, 'ا')     // أ إ آ  →  ا
    .replace(/ة/g, 'ه')                   // ة      →  ه
    .replace(/ى/g, 'ي')                   // ى      →  ي
    .replace(/[^\p{L}\p{N}#\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* The hashtags somebody actually wrote. Those are not suggestions and
   they are not guesses — they are what the person said, and they
   always outrank anything found by reading. */
export function writtenTags(text) {
  const out = [];
  const re = /#([\p{L}\p{N}_]{2,30})/gu;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[1]);
  return out;
}

const NORM_LEX = Object.entries(LEXICON).map(([slug, words]) => [slug, words.map(normalise)]);

/* ── THE DEFINITE ARTICLE, WHICH IS WHY THE FIRST VERSION MATCHED
      ALMOST NOTHING ──────────────────────────────────────────────────
   In Arabic "the trip" is not two words, it is one: الرحلة. So a
   lexicon holding رحلة matches a sentence that says رحلة and misses
   every sentence that says الرحلة — which is most of them, because
   people write about THE trip, THE gym, THE match. Every token is
   therefore also considered without its leading ال.

   The same is true of the prefixes that get stuck on the front in
   writing: و (and), ب (with), ل (for), ف (so) — بالرحلة, والقهوة. */
function tokens(text) {
  const set = new Set();
  normalise(text).split(' ').forEach((w) => {
    if (!w) return;
    set.add(w);
    let bare = w;
    if (/^[وفبلك]/.test(bare) && bare.length > 4) bare = bare.slice(1);
    if (bare.startsWith('ال') && bare.length > 4) bare = bare.slice(2);
    if (bare !== w) set.add(bare);
  });
  return set;
}

/* ── ASKING BEATS BEING ABOUT ────────────────────────────────────────
   "رشحولي مطعم كويس" mentions a restaurant and it is not a post about
   restaurants — it is somebody asking for one, and the room that gets
   it answered is the asking room. So when a caption matches both a
   subject and an intent, the intent wins: these three rooms are worth
   half a point more per word than the rest. */
const INTENT = new Set(['help-me', 'recommend-me', 'please-correct-me']);

/* Every room the text touches, strongest first. A phrase ("how do i")
   counts double, because two words agreeing is a much better signal
   than one word appearing. */
export function suggestRooms(text, { limit = 3 } = {}) {
  const clean = normalise(text);
  if (clean.length < 2) return [];
  const hay = ' ' + clean + ' ';
  const words = tokens(clean);
  const scores = [];
  for (const [slug, entries] of NORM_LEX) {
    let score = 0;
    for (const w of entries) {
      if (!w || STOP.has(w)) continue;
      if (w.includes(' ')) {
        /* a phrase agreeing with itself is a much stronger signal than
           one word turning up, so it counts double */
        if (hay.includes(' ' + w + ' ') || hay.includes(' ' + w)) score += 2;
      } else if (words.has(w)) score += 1;
    }
    if (score > 0) scores.push({ slug, score: score * (INTENT.has(slug) ? 1.5 : 1) });
  }
  scores.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
  return scores.slice(0, limit);
}

/* What to put on the chips at the moment of posting: what they wrote
   first, then what the words suggest, never more than five, never a
   duplicate of something already chosen. */
export function suggestTags(text, { taken = [], topics = [], limit = 5 } = {}) {
  const have = new Set(taken.map((t) => normalise(t).replace('#', '')));
  const byslug = {};
  topics.forEach((t) => { if (t && t.slug) byslug[t.slug] = t.tag || ('#' + t.slug); });
  const out = [];
  for (const { slug } of suggestRooms(text, { limit: limit })) {
    const tag = byslug[slug] || '#' + slug.replace(/-/g, '');
    if (have.has(normalise(tag).replace('#', ''))) continue;
    out.push(tag);
    if (out.length >= limit) break;
  }
  return out;
}

/* Where a post belongs when nobody said. Written tags win; then the
   words; then FYP, which is the honest answer and not a failure. */
export function roomFor(post) {
  /* The caption only, deliberately. A post's PLACE is where it was
     taken, not what it is about — and folding it in meant every post
     with "Cairo" on it was filed under Egypt, which emptied For You
     and flooded one room with everything. Where somebody stood is a
     fact about the photograph, not its subject. */
  const text = (post && post.caption) || '';
  const written = writtenTags(text);
  if (written.length) return { slug: null, tag: '#' + written[0], source: 'written' };
  const found = suggestRooms(text, { limit: 1 })[0];
  if (found) return { slug: found.slug, tag: null, source: 'guessed' };
  return { slug: FYP, tag: null, source: 'fyp' };
}
