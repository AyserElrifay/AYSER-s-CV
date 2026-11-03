/* ─── SPILL OR SPARK · the cards ──────────────────────────────────────
   Ayser, November 2026: Table Sparks became "Spill or Spark". One person
   in the spotlight gets a question; they spill the truth out loud, or pass
   and take the Spark — a small, kind thing to do at the table. Every
   fourth turn the whole table votes in secret. Three gears, English and
   Egyptian Arabic. Friendship and everyday life only: nothing about
   dating, nothing that embarrasses anybody, nothing about religion. */

export const GEARS = {
  ice: {
    en: 'Icebreaker', ar: 'خفيف ولذيذ', icon: 'cafe-outline',
    truths: [
      ['What was your first impression of this place tonight?', 'إيه أول انطباع خدته عن المكان ده النهارده؟'],
      ['What is the funniest habit you have that nobody knows about?', 'إيه أغرب عادة عندك محدش يعرفها؟'],
      ['What is the last thing that made you laugh out loud?', 'إيه آخر حاجة ضحّكتك بصوت عالي؟'],
      ['Which app do you open first in the morning — honestly?', 'أول أبلكيشن بتفتحه الصبح إيه؟ بصراحة.'],
      ['What food would you never share with anyone?', 'أكلة عمرك ما تقسمها مع حد؟'],
      ['What is your go-to karaoke song?', 'أغنيتك المضمونة في الكاريوكي إيه؟'],
      ['What were you obsessed with at 12 years old?', 'كنت مهووس بإيه وإنت عندك ١٢ سنة؟'],
      ['If your week had a title, what would it be?', 'لو أسبوعك ليه عنوان، هيبقى إيه؟'],
      ['Which skill would you learn overnight if you could?', 'مهارة نفسك تتعلمها في ليلة واحدة؟'],
      ['What is a small thing that instantly makes your day better?', 'حاجة صغيرة بتعدّل يومك على طول؟'],
    ],
    dares: [
      ['Show the table the 3rd photo in your camera roll and tell the story behind it.', 'ورّي الترابيزة تالت صورة في الجاليري واحكي حكايتها.'],
      ['Swap seats right now with someone you have not talked to yet.', 'بدّل مكانك دلوقتي مع حد لسه ماتكلمتش معاه.'],
      ['Let the person across from you see your top played song this week.', 'خلّي اللي قدامك يشوف أكتر أغنية سمعتها الأسبوع ده.'],
      ['Teach the table one word in a language they do not speak.', 'علّم الترابيزة كلمة بلغة محدش فيهم بيتكلمها.'],
      ['Order (or pretend to order) for the person on your right — they decide if you nailed it.', 'اطلب (أو اعمل نفسك بتطلب) للي على يمينك — هو اللي يحكم إذا كنت صح.'],
      ['Describe your perfect weekend in exactly ten words.', 'اوصف الويكند المثالي في عشر كلمات بالظبط.'],
      ['Give everyone at the table a nickname for tonight.', 'ادّي كل واحد على الترابيزة اسم دلع للسهرة دي.'],
      ['Do your best impression of a famous film line — the table guesses the film.', 'قلّد جملة مشهورة من فيلم — والترابيزة تخمّن الفيلم.'],
    ],
  },
  raw: {
    en: 'Unfiltered', ar: 'صراحة جريئة', icon: 'flame-outline',
    truths: [
      ['What is a red flag in a friend that you have learned to spot?', 'إيه الـ red flag اللي اتعلمت تاخد بالك منها في الصحاب؟'],
      ['What is your most unpopular opinion about food?', 'إيه أكتر رأي مش شعبي عندك في الأكل؟'],
      ['What is a trend you secretly enjoy but pretend you do not?', 'تريند بتحبه في السر وبتعمل نفسك مش بتحبه؟'],
      ['When did you last change your mind about someone?', 'آخر مرة غيّرت رأيك في حد كانت إمتى؟'],
      ['What is something you are proud of but rarely say?', 'حاجة فخور بيها بس نادراً ما بتقولها؟'],
      ['What is the worst advice you ever followed?', 'أسوأ نصيحة مشيت وراها؟'],
      ['What is a hot take you would defend to the end?', 'رأي جريء تدافع عنه للآخر؟'],
      ['Which friend do you call first with good news — and why them?', 'أول صاحب بتكلّمه لما يحصل خبر حلو؟ وليه هو؟'],
      ['What is something everybody loves that you find overrated?', 'حاجة الناس كلها بتحبها وإنت شايفها واخدة أكبر من حجمها؟'],
      ['What would your friends say is your most annoying habit?', 'صحابك هيقولوا إيه أكتر عادة بتضايقهم فيك؟'],
    ],
    dares: [
      ['Read your last sent message out loud (skip it if it is private — then pick the one before).', 'اقرا آخر رسالة بعتها بصوت عالي (لو خاصة، اختار اللي قبلها).'],
      ['Let the table pick your next profile bio — you keep it till tomorrow.', 'خلّي الترابيزة تختار الـ bio بتاعك — ويفضل لحد بكرة.'],
      ['Give the person on your left an honest, kind piece of advice.', 'ادّي اللي على شمالك نصيحة صريحة ولطيفة.'],
      ['Defend the opposite of your opinion for 30 seconds.', 'دافع عن عكس رأيك لمدة ٣٠ ثانية.'],
      ['Tell the table your screen time this week.', 'قول للترابيزة الـ screen time بتاعك الأسبوع ده.'],
      ['Let the table choose a song — you hum it until someone guesses.', 'الترابيزة تختار أغنية — وإنت تدندنها لحد ما حد يعرفها.'],
    ],
  },
  late: {
    en: 'Late Night', ar: 'عميق وحقيقي', icon: 'moon-outline',
    truths: [
      ['What was a turning point in your life that nobody saw?', 'إيه لحظة غيّرت حياتك ومحدش شافها؟'],
      ['What are you learning about yourself this year?', 'بتتعلم إيه عن نفسك السنة دي؟'],
      ['Who taught you something you still use every day?', 'مين علّمك حاجة لسه بتستخدمها كل يوم؟'],
      ['What would you do if you knew nobody would judge you?', 'كنت هتعمل إيه لو متأكد إن محدش هيحكم عليك؟'],
      ['What is a goal you have not told many people about?', 'هدف ماقولتوش لناس كتير؟'],
      ['When did you feel most at home somewhere new?', 'إمتى حسيت إنك في بيتك في مكان جديد؟'],
      ['What do you wish more people asked you about?', 'نفسك الناس تسألك أكتر عن إيه؟'],
      ['What is a moment from this year you want to remember?', 'لحظة من السنة دي عايز تفتكرها على طول؟'],
    ],
    dares: [
      ['Give a genuine compliment to someone at this table you met tonight.', 'قول مجاملة حقيقية لحد على الترابيزة اتعرفت عليه النهارده.'],
      ['Tell the person next to you one thing you noticed about them tonight that you liked.', 'قول للي جنبك حاجة لاحظتها فيه النهارده وعجبتك.'],
      ['Share one thing you are grateful for this week.', 'قول حاجة واحدة ممتن ليها الأسبوع ده.'],
      ['Send a kind message to someone you have not talked to in a while — right now.', 'ابعت رسالة حلوة لحد مكلمتوش من زمان — دلوقتي.'],
      ['Tell the table the best thing that happened to you this month.', 'احكي للترابيزة أحلى حاجة حصلتلك الشهر ده.'],
    ],
  },
};

/* every fourth turn: the whole table votes in secret, 15 seconds */
export const VOTES = [
  ['Who at this table would survive longest on a deserted island?', 'مين فينا هيعيش أطول في جزيرة مهجورة؟'],
  ['Who has the most mysterious vibe tonight?', 'مين فينا عنده أغمض vibe النهارده؟'],
  ['Who would be the best travel buddy?', 'مين فينا أحلى رفيق سفر؟'],
  ['Who is most likely to become famous?', 'مين فينا غالباً هيبقى مشهور؟'],
  ['Who would you call at 3 am in an emergency?', 'مين فينا تكلّمه الساعة ٣ الفجر لو في مصيبة؟'],
  ['Who has the best laugh at this table?', 'مين فينا عنده أحلى ضحكة؟'],
  ['Who would win a cooking contest?', 'مين فينا هيكسب مسابقة طبخ؟'],
  ['Who will remember tonight in the most detail?', 'مين فينا هيفتكر السهرة دي بالتفصيل؟'],
  ['Who is most likely to plan the next outing?', 'مين فينا غالباً هيرتّب الخروجة الجاية؟'],
  ['Who gives the best advice?', 'مين فينا بيدّي أحلى نصيحة؟'],
];
