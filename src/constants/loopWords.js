/* ─── THE WORDS OF THE DAILY LOOP ─────────────────────────────────────
   Ayser, October 2026: snap the day's prompt, do your day and earn feed
   time, level up for the world. English and Arabic; other languages
   read English until they are written. Kept small and on its own so the
   screens that use it carry only these. */

const W = {
  en: {
    pp_label: 'Today’s photo prompt',
    pp_share: 'Share your Moment',
    pp_prompts: [
      'Share the sky from your window right now.',
      'What did you cook or eat today?',
      'Show us your current workspace.',
      'The street outside, right now.',
      'Something that made you smile today.',
      'Your cup of the day: tea, coffee, anything.',
      'What are you learning from today? A book, notes, a screen.',
      'A corner of your city you love.',
      'Your shoes today, and where they took you.',
      'The view on your way home.',
      'Something green near you.',
      'The people you spent today with (ask them first).',
    ],
    fg_task_todo: 'Finish a task in My day',
    fg_task_checkin: 'Scan the QR at a real outing',
    fg_unlimited: 'No time limit',
    fg_more: 'Moments+ gives you {m} minutes a day. Black, and Level 4, have no limit.',
    fg_more_cta: 'See memberships',
    cap_note: 'Add a note to your moment…',
    cap_share: 'Share Moment',
    cap_life: 'Lives in the feed for {h} hours',
    cap_keep: 'Save to my private memories',
    cap_keep_hint: 'After that only you see it, on your page.',
    cap_keep_lock: 'Moments+ and Black can keep a moment for themselves.',
    left_h: '{n}h left',
    left_m: '{n}m left',
    kept: 'Kept',
  },
  ar: {
    pp_label: 'صورة النهارده',
    pp_share: 'شارك لحظتك',
    pp_prompts: [
      'صوّر السما من شباكك دلوقتي.',
      'طبخت أو أكلت إيه النهارده؟',
      'ورّينا المكان اللي بتشتغل أو بتذاكر فيه دلوقتي.',
      'الشارع اللي برّه، دلوقتي.',
      'حاجة خلّتك تبتسم النهارده.',
      'مشروبك النهارده: شاي، قهوة، أي حاجة.',
      'بتتعلّم من إيه النهارده؟ كتاب، ورق، شاشة.',
      'ركن بتحبه في مدينتك.',
      'جزمتك النهارده، وودّتك فين.',
      'المنظر وإنت راجع البيت.',
      'حاجة خضرا جنبك.',
      'الناس اللي قضّيت معاهم النهارده (استأذنهم الأول).',
    ],
    fg_task_todo: 'خلّص مهمة في يومي',
    fg_task_checkin: 'امسح الـ QR في خروجة حقيقية',
    fg_unlimited: 'من غير حد للوقت',
    fg_more: 'مومنتس+ بيديك {m} دقيقة في اليوم. Black والمستوى ٤ من غير حد.',
    fg_more_cta: 'شوف الاشتراكات',
    cap_note: 'اكتب كلمة على لحظتك…',
    cap_share: 'شارك اللحظة',
    cap_life: 'هتفضل في الفيد {h} ساعة',
    cap_keep: 'احفظها في ذكرياتي الخاصة',
    cap_keep_hint: 'بعد كده إنت بس اللي هتشوفها، على صفحتك.',
    cap_keep_lock: 'مومنتس+ وBlack يقدروا يحتفظوا باللحظة لنفسهم.',
    left_h: 'فاضل {n} ساعة',
    left_m: 'فاضل {n} دقيقة',
    kept: 'محفوظة',
  },
};

const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const lw = (lang, k, vars, given) => {
  const row = W[lang === 'ar' ? 'ar' : 'en'];
  let s = given != null ? given : row[k] != null ? row[k] : W.en[k];
  if (typeof s !== 'string') return s;
  Object.keys(vars || {}).forEach((v) => { s = s.replace('{' + v + '}', lang === 'ar' ? AR(vars[v]) : String(vars[v])); });
  return s;
};
/* how long a camera moment stays in the feed (RUN_ME.sql posts_lifetime) */
export const MOMENT_HOURS = 48;
/* "18h left" on a moment that is still live, null on one with no end */
export const timeLeft = (lang, expiresAt, now = Date.now()) => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (!(ms > 0)) return null;
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? lw(lang, 'left_h', { n: h }) : lw(lang, 'left_m', { n: Math.max(1, Math.ceil(ms / 60000)) });
};
/* the same prompt for everybody on the same day, in their own language */
export const todaysPrompt = (lang, d = new Date()) => {
  const list = lw(lang, 'pp_prompts');
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d - start) / 86400000);
  return list[day % list.length];
};

/* a moment made for a prompt starts with the prompt itself (CaptureModal
   writes "prompt — your words"); the feed shows the two apart */
export const splitPrompt = (caption) => {
  const c = String(caption || '');
  const all = W.en.pp_prompts.concat(W.ar.pp_prompts);
  const p = all.find((x) => c === x || c.indexOf(x + ' — ') === 0);
  return p ? { prompt: p, rest: c.slice(p.length).replace(/^ — /, '').trim() } : null;
};
