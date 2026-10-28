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
/* the same prompt for everybody on the same day, in their own language */
export const todaysPrompt = (lang, d = new Date()) => {
  const list = lw(lang, 'pp_prompts');
  const start = new Date(d.getFullYear(), 0, 0);
  const day = Math.floor((d - start) / 86400000);
  return list[day % list.length];
};
