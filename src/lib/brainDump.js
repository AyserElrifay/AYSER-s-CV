/* ─── THE BRAIN DUMP ──────────────────────────────────────────────────
   "Prevent the app from becoming a manual To-Do list (which triggers
   ADHD overwhelm)." So there is no list to keep. You pour the day out
   in one messy line — or say it — and Bardi pulls out the things in
   it, works out what kind of thing each one is, and shows ONE: the
   next thing. Done, or not now, and the next one takes its place.

   It runs on the phone, instantly, with or without a signal: no words
   you dumped ever leave it. Only the kind of thing you are doing now —
   "studying", "deep work" — is shared, and only so that people near
   you doing the same can be offered a session together (bardi_set_focus
   in RUN_ME.sql).

   Pure, so it can be checked without a phone:

       node scripts/check-brain-dump.mjs
*/

export const MAX_ITEMS = 7;

/* what kind of thing it is — the first that fits wins, in this order */
const KINDS = [
  ['studying', /\b(stud(y|ying)|exam|homework|revis(e|ion)|lecture|course|chapter|flashcards?|assignment|quiz|learn(ing)?)\b|ذاكر|مذاكر|امتحان|محاضر|كورس|واجب|ذاكرة|اذاكر|estudi|étudi|lern|učit|õppi/i],
  ['deep_work', /\b(work on|report|e-?mails?|inbox|presentation|deck|slides?|code|coding|debug|write|writing|draft|thesis|proposal|invoice|budget|spreadsheet|design|client|pitch|cv|resume|application)\b|شغل|تقرير|ايميل|إيميل|عرض|كود|بروبوزال|مشروع|اكتب|تصميم|سي في/i],
  ['workout', /\b(gym|run|running|jog|workout|work out|yoga|swim|swimming|walk|hike|bike|cycling|stretch|pilates|football|padel)\b|جيم|جري|اجري|تمرين|مشي|امشي|سباحة|يوجا|كورة|بادل/i],
  ['social', /\b(call|meet|see|visit|dinner with|lunch with|coffee with|text|catch up|birthday)\b|كلم|اكلم|اقابل|قابل|زيارة|ازور|عيد ميلاد/i],
  ['errands', /\b(buy|shop|shopping|groceries|bank|pharmacy|post office|pay|bills?|pick up|return|book|appointment|laundry|clean|cook)\b|اشتري|سوبر ?ماركت|بنك|صيدلي|ادفع|فاتور|غسيل|انضف|نضف|اطبخ|حجز/i],
];

/* the two that are better done next to somebody: body doubling */
export const FOCUS = new Set(['studying', 'deep_work']);

export const LOOK = {
  studying:  { emoji: '📚' },
  deep_work: { emoji: '💻' },
  workout:   { emoji: '🏃' },
  social:    { emoji: '💬' },
  errands:   { emoji: '🛒' },
  other:     { emoji: '✨' },
};

export function kindOf(text) {
  for (const [k, re] of KINDS) if (re.test(text)) return k;
  return 'other';
}

/* "I need to", "gotta", "لازم" … — the throat-clearing before a task */
const LEAD = /^(?:(?:and|then|also|ok(?:ay)?|so|first|after that|later|maybe|i (?:need|have|want|should|must|gotta) to|i(?:'m| am) going to|i(?:'ll| will)|need to|have to|gotta|should|must|و|ثم|بعدين|بعد كده|وبعدين|لازم|محتاج|عايزة?|هـ?روح|ابقى|المفروض)\s+)+/i;

export function parseDump(raw) {
  const text = String(raw || '').replace(/[ \t]+/g, ' ').trim();
  if (!text) return [];
  const parts = text
    /* Arabic letters are not "word" characters to a JS regex, so the
       Arabic joins are matched by the spaces round them; and "و" glued
       to a verb ("واروح", "واكلم") splits only before an alif, so a
       word that merely starts with و stays whole */
    .split(/\s*(?:[\n.;!?،؛]|,|\s-\s|\band then\b|\bthen\b|\balso\b|\bafter that\b|\band\b)\s*|\s+(?:ثم|وبعدين|بعدين|وبعد كده|و)\s+|\s+و(?=[اأإ])/i)
    .map((s) => s.replace(LEAD, '').replace(/^[\s,.\-–—]+|[\s,.\-–—]+$/g, '').trim())
    .filter((s) => s.length >= 3);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: p.charAt(0).toUpperCase() + p.slice(1), kind: kindOf(p), done: false });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/* ── the day ── one object, kept on the phone, gone tomorrow */
export const dayKey = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

export function newDay(items, now = new Date()) {
  return { day: dayKey(now), items, at: 0 };
}

/* the ONE thing on screen: the first not done, starting from `at` and
   wrapping round, so "not now" moves on without losing anything */
export function current(state) {
  if (!state || !Array.isArray(state.items) || !state.items.length) return null;
  const n = state.items.length;
  for (let k = 0; k < n; k++) {
    const i = (state.at + k) % n;
    if (!state.items[i].done) return { ...state.items[i], index: i };
  }
  return null;
}

export function markDone(state) {
  const c = current(state);
  if (!c) return state;
  const items = state.items.map((x, i) => (i === c.index ? { ...x, done: true } : x));
  return { ...state, items, at: (c.index + 1) % items.length };
}

export function notNow(state) {
  const c = current(state);
  if (!c) return state;
  return { ...state, at: (c.index + 1) % state.items.length };
}

export const left = (state) => (state && state.items ? state.items.filter((x) => !x.done).length : 0);
