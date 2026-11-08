/* ─── THE ENGLISH CIRCLE · TODAY'S TOPIC ─────────────────────────────
   Ayser, November 2026: every circle opens on one question everybody
   talks about — light dilemmas, everyday life, films and music. The
   server keeps only a turn number (RUN_ME.sql, THE CIRCLE'S TOPIC), so
   the whole room sees the same one, and a shuffle moves everybody. */
export const CIRCLE_TOPICS = [
  ['If you could live in any city for one year, which one — and why?', 'لو تعيش سنة في أي مدينة في العالم، هتختار أنهي واحدة وليه؟'],
  ['A film everybody loves that you secretly don\'t. Defend yourself.', 'فيلم الناس كلها بتحبه وإنت لأ. دافع عن رأيك.'],
  ['Morning person or night person — and has it ever changed?', 'إنت صباحي ولا بتسهر؟ واتغيّرت قبل كده؟'],
  ['What is a small habit that changed your life?', 'إيه عادة صغيرة غيّرت حياتك؟'],
  ['Would you rather travel alone or with a group? Tell a story.', 'تسافر لوحدك ولا مع مجموعة؟ احكي موقف.'],
  ['The best advice you ever got — and who gave it to you.', 'أحسن نصيحة اتقالتلك، ومين قالها؟'],
  ['If your life had a soundtrack, what song plays right now?', 'لو حياتك فيلم، أنهي أغنية شغالة دلوقتي؟'],
  ['Phones at dinner: rude or normal now?', 'الموبايل على الأكل: قلة ذوق ولا بقى عادي؟'],
  ['A skill you want to learn this year, and what stops you.', 'مهارة عايز تتعلمها السنة دي، وإيه اللي موقفك؟'],
  ['What would you do with one free day and no phone?', 'لو عندك يوم كامل فاضي ومن غير موبايل، هتعمل إيه؟'],
  ['Books or films: which one stays with you longer?', 'الكتب ولا الأفلام: أنهي بيفضل معاك أكتر؟'],
  ['A place in your city tourists never find. Tell us about it.', 'مكان في مدينتك السياح عمرهم ما يلاقوه. احكيلنا عنه.'],
  ['Is it better to be early or exactly on time?', 'الأحسن تيجي بدري ولا في الميعاد بالظبط؟'],
  ['The most useful thing school never taught you.', 'أهم حاجة المدرسة ماعلّمتهاش ليك.'],
  ['Remote work or the office — where are you at your best?', 'الشغل من البيت ولا من المكتب؟ فين بتبقى في أحسن حالاتك؟'],
  ['A trend you hope disappears, and one you hope stays.', 'تريند نفسك يختفي، وتريند نفسك يفضل.'],
  ['What makes a friendship last for years?', 'إيه اللي بيخلّي الصحوبية تعيش سنين؟'],
  ['If you could have dinner with anyone alive, who and what would you ask?', 'لو تتعشى مع أي حد عايش، مين وهتسأله إيه؟'],
  ['The best meal you have ever had — where was it?', 'أحلى أكلة كلتها في حياتك، كانت فين؟'],
  ['Would you rather know the future or change the past?', 'تحب تعرف المستقبل ولا تغيّر الماضي؟'],
  ['A song you can\'t stop replaying this month.', 'أغنية مش قادر تبطّل تسمعها الشهر ده.'],
  ['What does a perfect weekend look like for you?', 'الويكند المثالي بالنسبالك شكله إيه؟'],
  ['Is social media making us closer or lonelier?', 'السوشيال ميديا بتقرّبنا ولا بتخلّينا لوحدنا أكتر؟'],
  ['The bravest thing you did in the last year.', 'أشجع حاجة عملتها السنة اللي فاتت.'],
  ['A series worth staying up late for — sell it to us in one minute.', 'مسلسل يستاهل تسهر عشانه — اقنعنا بيه في دقيقة.'],
  ['What is one thing you changed your mind about recently?', 'حاجة غيّرت رأيك فيها مؤخراً.'],
  ['Cooking at home or eating out — what does it say about you?', 'تطبخ في البيت ولا تاكل برّه؟ ده بيقول إيه عنك؟'],
  ['If you started a small business tomorrow, what would it be?', 'لو هتبدأ مشروع صغير بكرة، هيبقى إيه؟'],
  ['The first concert or event you ever went to.', 'أول حفلة أو إيفنت رحته في حياتك.'],
  ['What would you tell yourself five years ago?', 'لو تقول حاجة لنفسك من خمس سنين، هتقول إيه؟'],
];

/* the same question on every phone: the circle's own number, plus the turn */
export const circleTopic = (id, turn, lang) => {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const q = CIRCLE_TOPICS[(h + (Number(turn) || 0)) % CIRCLE_TOPICS.length];
  return lang === 'ar' ? q[1] : q[0];
};

/* a café outing's own topic (Ayser, November 2026: "خلّي كل خروجة في كافيه
   ليها topic"): one question for the whole evening, the same at every
   table of it — chosen by its start time, so the card, every table's room
   and every phone agree without the server keeping anything */
export const dropTopic = (startsAt, lang) => circleTopic('drop:' + (Date.parse(startsAt) || 0), 0, lang);
export const DROP_TOPIC_W = { en: 'Tonight’s topic', ar: 'توبيك القعدة' };
