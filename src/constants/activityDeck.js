/* ─── THE MOMENTS CARD DECK ───────────────────────────────────────────
   What is on the cards. The server deals INDEXES only (RUN_ME.sql,
   activity_size): Warm-up 20, Deep Moments 20, Global Twist 20,
   Roleplay 16, Table polls 12 — change a count here and there together
   (scripts/check-live.mjs checks they match). English and Egyptian
   Arabic; the Global Twist is an English-speaking challenge on purpose.
   Every card is light enough to answer in front of people you met an
   hour ago, and nothing on them is about dating. */

export const DECK = {
  warm: [
    ['What is the best thing you ate this week?', 'إيه أحلى حاجة كلتها الأسبوع ده؟'],
    ['Which app would you delete last?', 'أنهي أبلكيشن آخر واحد ممكن تمسحه؟'],
    ['Coffee, tea, or something else entirely?', 'قهوة ولا شاي ولا حاجة تانية خالص؟'],
    ['What is a song you know every word of?', 'إيه أغنية حافظ كل كلمة فيها؟'],
    ['Morning person or night person — prove it.', 'صباحي ولا ليلي — اثبت.'],
    ['What is the last thing that made you laugh out loud?', 'إيه آخر حاجة ضحّكتك بصوت عالي؟'],
    ['If today had a title, what would it be?', 'لو النهارده له عنوان، هيبقى إيه؟'],
    ['What is a small thing that instantly makes your day better?', 'إيه حاجة صغيرة بتحلّي يومك فورًا؟'],
    ['Which emoji do you use way too much?', 'أنهي إيموجي بتستخدمه زيادة عن اللزوم؟'],
    ['What is your go-to order at a café?', 'بتطلب إيه دايمًا في الكافيه؟'],
    ['What is something you are weirdly good at?', 'إيه حاجة إنت شاطر فيها بشكل غريب؟'],
    ['Beach, mountains or a big city?', 'بحر ولا جبل ولا مدينة كبيرة؟'],
    ['What did you want to be when you were ten?', 'كنت عايز تبقى إيه وإنت عندك عشر سنين؟'],
    ['What is the best film you watched this year?', 'إيه أحلى فيلم شفته السنة دي؟'],
    ['What is a skill you learned from YouTube?', 'إيه مهارة اتعلمتها من يوتيوب؟'],
    ['What is your comfort food?', 'إيه الأكلة اللي بتريّحك؟'],
    ['Which season are you, and why?', 'إنت أنهي فصل من فصول السنة، وليه؟'],
    ['What is a hobby you would start tomorrow if you had the time?', 'إيه هواية تبدأها بكره لو عندك وقت؟'],
    ['What is the most useful thing in your bag right now?', 'إيه أهم حاجة في شنطتك دلوقتي؟'],
    ['What is a word you love the sound of?', 'إيه كلمة بتحب صوتها؟'],
  ],
  deep: [
    ['What is a moment this year you are proud of?', 'إيه لحظة السنة دي فخور بيها؟'],
    ['Who taught you something you still use every day?', 'مين علّمك حاجة لسه بتستخدمها كل يوم؟'],
    ['What is a dream you have not told many people?', 'إيه حلم ماقلتهوش لناس كتير؟'],
    ['What is a place that changed how you see things?', 'إيه مكان غيّر نظرتك للحاجات؟'],
    ['What is the bravest thing you have done?', 'إيه أشجع حاجة عملتها؟'],
    ['What would you tell yourself five years ago?', 'كنت هتقول إيه لنفسك من خمس سنين؟'],
    ['What is something you changed your mind about?', 'إيه حاجة غيّرت رأيك فيها؟'],
    ['When do you feel most like yourself?', 'إمتى بتحس إنك نفسك بجد؟'],
    ['What is a small kindness from a stranger you still remember?', 'إيه لطف صغير من حد غريب لسه فاكره؟'],
    ['What is a goal you want to reach before next summer?', 'إيه هدف عايز توصله قبل الصيف الجاي؟'],
    ['What is the best advice you ever got?', 'إيه أحسن نصيحة اتقالتلك؟'],
    ['What does a perfect ordinary day look like for you?', 'يوم عادي ومثالي بالنسبالك شكله إيه؟'],
    ['What is something you are learning right now?', 'إيه حاجة بتتعلمها دلوقتي؟'],
    ['What tradition from your family do you want to keep?', 'إيه عادة من عيلتك عايز تفضل محافظ عليها؟'],
    ['What is a fear you got over?', 'إيه خوف قدرت تتغلب عليه؟'],
    ['Which trip would you take again, exactly the same?', 'أنهي رحلة تعيدها تاني بالظبط زي ما هي؟'],
    ['What makes a friend a real friend for you?', 'إيه اللي بيخلّي الصاحب صاحب بجد بالنسبالك؟'],
    ['What is something you wish more people asked you about?', 'إيه حاجة نفسك الناس تسألك عنها أكتر؟'],
    ['What is a book, film or song that found you at the right time?', 'إيه كتاب أو فيلم أو أغنية جاتلك في الوقت المظبوط؟'],
    ['What would you do with a whole free year?', 'هتعمل إيه لو عندك سنة كاملة فاضية؟'],
  ],
  // 60 seconds, in English, out loud
  global: [
    ['Describe your city to someone who has never heard of it.', 'Describe your city to someone who has never heard of it.'],
    ['Convince us to visit your favourite place.', 'Convince us to visit your favourite place.'],
    ['Explain how to make your favourite dish.', 'Explain how to make your favourite dish.'],
    ['Tell us about the best trip you ever took.', 'Tell us about the best trip you ever took.'],
    ['You are a tour guide. Introduce this café.', 'You are a tour guide. Introduce this café.'],
    ['Describe a festival or holiday from your country.', 'Describe a festival or holiday from your country.'],
    ['Pitch a weekend trip to everyone at this table.', 'Pitch a weekend trip to everyone at this table.'],
    ['Tell a story about getting lost somewhere.', 'Tell a story about getting lost somewhere.'],
    ['Explain a word from your language that has no English twin.', 'Explain a word from your language that has no English twin.'],
    ['Describe your dream house — every room.', 'Describe your dream house — every room.'],
    ['Give directions from here to your home.', 'Give directions from here to your home.'],
    ['Review the last film you watched, like a critic.', 'Review the last film you watched, like a critic.'],
    ['Describe the perfect day in your city for a visitor.', 'Describe the perfect day in your city for a visitor.'],
    ['Talk about a person who inspires you.', 'Talk about a person who inspires you.'],
    ['Explain the rules of a game you played as a kid.', 'Explain the rules of a game you played as a kid.'],
    ['Sell us the thing closest to your hand right now.', 'Sell us the thing closest to your hand right now.'],
    ['Describe the view from your window.', 'Describe the view from your window.'],
    ['Tell us three things you would pack for a month abroad, and why.', 'Tell us three things you would pack for a month abroad, and why.'],
    ['Explain what you do all day to a five-year-old.', 'Explain what you do all day to a five-year-old.'],
    ['Plan a dinner party: who comes, what you cook, what music plays.', 'Plan a dinner party: who comes, what you cook, what music plays.'],
  ],
};

// Roleplay Roulette: two people, one scene, 90 seconds — [title, setup] in English and Arabic
export const SCENES = [
  [['Airport customs', 'One of you is the officer, one is arriving. Purpose of the visit, where you stay, how long.'], ['الجمارك في المطار', 'واحد ظابط والتاني لسه واصل. سبب الزيارة، هتقعد فين، وقد إيه.']],
  [['Booking a hostel in Madrid', 'Ask for a bed for three nights, a locker, and the best tapas nearby.'], ['حجز هوستل في مدريد', 'اطلب سرير لتلات ليالي ودولاب، واسأل على أحلى تاباس قريبة.']],
  [['The lost suitcase', 'Your bag did not arrive. Explain it at the airline desk.'], ['الشنطة اللي تاهت', 'شنطتك ماوصلتش. اشرح لموظف شركة الطيران.']],
  [['Ordering for a friend', 'Order a meal for a friend with three allergies.'], ['تطلب لصاحبك', 'اطلب أكل لصاحبك عنده تلات أنواع حساسية.']],
  [['Visa interview', 'One asks, one answers: why this country, who pays, when you come back.'], ['مقابلة الفيزا', 'واحد بيسأل والتاني بيجاوب: ليه البلد دي، مين هيدفع، هترجع إمتى.']],
  [['Asking for directions', 'You need the train station; the local only half understands you.'], ['تسأل على الطريق', 'محتاج محطة القطر، والراجل اللي هناك فاهمك نص نص.']],
  [['Hotel complaint', 'The room is not what you booked. Fix it politely.'], ['شكوى في الفندق', 'الأوضة مش اللي حجزتها. حلّها بذوق.']],
  [['Market bargaining', 'Buy a scarf. One sells, one bargains.'], ['فصال في السوق', 'اشتري شال. واحد بيبيع والتاني بيفاصل.']],
  [['Missed the last train', 'Find a way home with the ticket office.'], ['القطر الأخير فاتك', 'لاقي طريقة ترجع بيها مع موظف التذاكر.']],
  [['Couchsurfing hello', 'You arrive at your host’s door. First five minutes.'], ['أول مقابلة في الاستضافة', 'وصلت باب اللي مستضيفك. أول خمس دقايق.']],
  [['The pharmacy', 'Explain a headache and a sore throat; ask what to take.'], ['الصيدلية', 'اشرح صداع ووجع زور، واسأل تاخد إيه.']],
  [['Job interview abroad', 'A café is hiring. Introduce yourself in 90 seconds.'], ['انترفيو شغل برّه', 'كافيه محتاج ناس. قدّم نفسك في ٩٠ ثانية.']],
  [['Booking a desert tour', 'Ask about price, what is included, and the sunrise.'], ['حجز رحلة صحرا', 'اسأل على السعر، وإيه اللي داخل فيها، والشروق.']],
  [['Wrong order', 'The waiter brought the wrong dish. Sort it out kindly.'], ['طلب غلط', 'الجرسون جاب طبق غلط. حلّها بلطف.']],
  [['New flatmate', 'Agree on cleaning, guests and quiet hours.'], ['شريك سكن جديد', 'اتفقوا على التنضيف والضيوف ومواعيد الهدوء.']],
  [['Tour guide for a day', 'Show a visitor the best street in your city.'], ['مرشد سياحي ليوم', 'ورّي زائر أحلى شارع في مدينتك.']],
];

// table polls: everyone votes for somebody at the table
export const POLLS = [
  ['Most likely to solo-travel next month', 'أكتر حد ممكن يسافر لوحده الشهر الجاي'],
  ['Best storyteller at this table', 'أحلى حد بيحكي على الترابيزة'],
  ['Most likely to speak five languages one day', 'أكتر حد ممكن يتكلم خمس لغات في يوم'],
  ['Who would survive a week in the desert', 'مين يقدر يعيش أسبوع في الصحرا'],
  ['Most likely to become a famous chef', 'أكتر حد ممكن يبقى شيف مشهور'],
  ['Who you would call when lost in a new city', 'هتكلّم مين لو تهت في مدينة جديدة'],
  ['Best playlist for a road trip', 'أحلى بلايليست لرحلة بالعربية'],
  ['Most likely to make friends with everyone at the airport', 'أكتر حد ممكن يصاحب كل الناس في المطار'],
  ['Who plans the best weekend', 'مين بيخطط أحلى ويك إند'],
  ['Most likely to move abroad', 'أكتر حد ممكن يعيش برّه'],
  ['Best energy tonight', 'أحلى طاقة النهارده'],
  ['Who would win a karaoke night', 'مين هيكسب ليلة كاريوكي'],
];

export const BADGES = [
  ['storyteller', '🔥'], ['english', '🌍'], ['energy', '⚡'], ['listener', '👂'], ['explorer', '🧭'], ['kind', '💛'],
];

// the badge names, in every language the app speaks
const BADGE_NAMES = {
  en: ['Great Storyteller', 'English Champ', 'Best Energy', 'Great Listener', 'Explorer', 'So Kind'],
  ar: ['حكّاء جامد', 'بطل الإنجليزي', 'أحلى طاقة', 'بيسمع حلو', 'مستكشف', 'ذوق جدًا'],
  cs: ['Skvělý vypravěč', 'Šampion angličtiny', 'Nejlepší energie', 'Skvělý posluchač', 'Objevitel', 'Moc milý'],
  es: ['Gran narrador', 'Campeón de inglés', 'Mejor energía', 'Sabe escuchar', 'Explorador', 'Muy amable'],
  et: ['Suurepärane jutustaja', 'Inglise keele tšempion', 'Parim energia', 'Hea kuulaja', 'Avastaja', 'Nii lahke'],
  fr: ['Super conteur', 'Champion d’anglais', 'Meilleure énergie', 'Belle écoute', 'Explorateur', 'Trop gentil'],
  hi: ['शानदार किस्सागो', 'इंग्लिश चैंप', 'बेस्ट एनर्जी', 'अच्छा सुनने वाला', 'खोजी', 'बहुत प्यारा'],
  it: ['Gran narratore', 'Campione d’inglese', 'Energia migliore', 'Sa ascoltare', 'Esploratore', 'Gentilissimo'],
  ja: ['話し上手', '英語チャンプ', '最高のエネルギー', '聞き上手', '探検家', 'やさしい'],
  ko: ['이야기꾼', '영어 챔피언', '최고의 에너지', '잘 들어 줌', '탐험가', '정말 친절'],
  nl: ['Geweldige verteller', 'Engels-kampioen', 'Beste energie', 'Goede luisteraar', 'Ontdekker', 'Zo lief'],
  pt: ['Grande contador', 'Campeão de inglês', 'Melhor energia', 'Sabe ouvir', 'Explorador', 'Muito gentil'],
  ro: ['Povestitor grozav', 'Campion la engleză', 'Cea mai bună energie', 'Ascultă frumos', 'Explorator', 'Foarte amabil'],
  ru: ['Отличный рассказчик', 'Чемпион английского', 'Лучшая энергия', 'Умеет слушать', 'Исследователь', 'Очень добрый'],
  tr: ['Harika hikâyeci', 'İngilizce şampiyonu', 'En iyi enerji', 'İyi dinleyici', 'Kâşif', 'Çok nazik'],
  uk: ['Чудовий оповідач', 'Чемпіон англійської', 'Найкраща енергія', 'Уміє слухати', 'Дослідник', 'Дуже добрий'],
  zh: ['讲故事高手', '英语冠军', '最佳能量', '很会倾听', '探索者', '超友善'],
};
export const badgeName = (lang, key) => {
  const i = BADGES.findIndex((b) => b[0] === key);
  return ((BADGE_NAMES[lang] || BADGE_NAMES.en)[i]) || BADGE_NAMES.en[i] || key;
};

// a card's text in the reader's language (English for everyone but Arabic readers)
export const cardText = (pair, lang) => (lang === 'ar' && pair[1] ? pair[1] : pair[0]);
