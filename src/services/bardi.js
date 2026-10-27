import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── PAPYRUS, FROM THE PHONE'S SIDE ──────────────────────────────────
   Papyrus (بردي in Arabic) lives on the server, in the 'bardi-chat'
   function, and nowhere else. The phone holds no prompt, no guidance,
   no "books" and no list of models — there is nothing here to read or
   to change. It sends the words to answer and gets words back.

   Ayser: "متخليش الـ users يوصلوا لأي معلومة تخص الـ backend … أو بردي".
   That is also why there is no fallback any more: when the server is
   busy the app says so in its own words, instead of handing somebody's
   sentence to a free service on the internet.

   Today the phone only asks for translations (posts and chats). */

export const BARDI_READY = SUPABASE_READY;

/* what failed, in words the app can say — never the server's own */
const failure = (code) => { const e = new Error('papyrus-' + code); e.code = code; return e; };

async function ask(body) {
  if (!SUPABASE_READY) throw failure('unreachable');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw failure('offline');
  const call = supabase.functions.invoke('bardi-chat', { body });
  const late = new Promise((resolve) => setTimeout(() => resolve({ late: true }), 15000));
  let res;
  try { res = await Promise.race([call, late]); } catch (e) { throw failure('unreachable'); }
  if (res && res.late) throw failure('busy');
  const { data, error } = res || {};
  const reply = !error && data && typeof data.reply === 'string' ? data.reply.trim() : '';
  if (reply) return reply;
  const status = error && error.context && error.context.status;
  throw failure(status === 401 ? 'signed_out' : status === 402 ? 'plus' : status === 429 ? 'slow_down' : 'busy');
}

/* ── TRANSLATION ────────────────────────────────────────────────────
   The same endpoint with a narrow brief: the sentence in the other
   language and nothing else. Cached per text and language for the
   session: the same caption scrolling past three times costs one call. */
const transCache = new Map();

export async function translateText(text, lang = 'en') {
  const body = String(text || '').trim();
  if (!body) return '';
  /* Nothing to translate: "17??", "😂😂", "!!!" — there are no words in it. */
  if (!/\p{Letter}/u.test(body)) return body;
  const key = lang + '|' + body;
  const hit = transCache.get(key);
  if (hit) return hit;
  const out = await ask({ messages: [{ role: 'user', content: body.slice(0, 4000) }], language: lang, target: lang, task: 'translate' });
  const clean = String(out || '').trim().replace(/^["“]|["”]$/g, '');
  if (clean) { if (transCache.size > 200) transCache.clear(); transCache.set(key, clean); }
  return clean;
}

/* ── THE DIARY, TALKED OVER ─────────────────────────────────────────
   Only when somebody taps "talk it over" in their diary
   (src/components/Diary.js): their last few entries, in their own
   words, and what they care about from their compass. Papyrus answers
   as itself — what it notices, one kind question, one small step. */
export async function reflectWithPapyrus(lines, lang = 'en', compass = '') {
  const content = 'My diary from the last days:\n' + String(lines || '').slice(0, 3500)
    + '\n\nPlease read it like a close friend: tell me briefly what you notice, ask me one kind question, and suggest one small step for tomorrow.';
  return ask({ messages: [{ role: 'user', content }], language: lang, profile: compass ? { goal: compass.slice(0, 200) } : undefined });
}

/* ── A GIFT, CHOSEN TOGETHER ────────────────────────────────────────
   Ayser: "خلي بردي يساعدك تختار الهدية — قوله الشخص ده يقربلك إيه وكام
   معلومة عنه". Only what somebody types in the gift helper
   (src/components/GiftHelper.js) leaves the phone, and only when they
   ask. Papyrus answers with a few ideas, each with why and roughly what
   it costs in their money, and where in their city such a thing is
   sold — never a made-up shop. */
export async function giftIdeas({ who, age, loves, budget, occasion, city }, lang = 'en') {
  const content = 'Help me choose a gift.\n'
    + '- For: ' + String(who || '').slice(0, 60) + (age ? ', about ' + String(age).slice(0, 3) + ' years old' : '') + '\n'
    + '- Occasion: ' + String(occasion || '').slice(0, 40) + '\n'
    + '- What they love / what they are like: ' + String(loves || '').slice(0, 600) + '\n'
    + (budget ? '- Budget: ' + String(budget).slice(0, 40) + '\n' : '')
    + (city ? '- I am in: ' + String(city).slice(0, 60) + '\n' : '')
    + '\nGive me 4 short, thoughtful ideas — at least one experience we could do together and one handmade or personal idea. For each: the idea, one line on why it fits them, and the kind of shop that sells it. Do not invent shop names. Keep it short and warm.';
  return ask({ messages: [{ role: 'user', content }], language: lang });
}

/* ── A SMALL JOB ── one narrow brief on the server (e.g. 'icebreakers'),
   no persona and no memory; null when Papyrus cannot answer right now. */
export async function bardiTask(task, content, lang = 'en') {
  try { return await ask({ messages: [{ role: 'user', content: String(content || '').slice(0, 3000) }], language: lang, task }); } catch (e) { return null; }
}
