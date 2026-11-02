/* ─── WHAT THE TABLE GAMES ARE MADE OF ────────────────────────────────
   Ayser, October 2026: four heads-up games for a table of strangers —
   light, local, never about religion, politics or anybody's body. Every
   line here is written for Moments; the songs are our own (no copied
   lyrics), and the host can paste the words of a song they have the
   right to sing.
   Each item is [English, Arabic]. */

/* 🕵️ Spy at the Table — a word everybody shares, and its close cousin
   for the Double Agent */
export const SPY_PACKS = {
  cafes: {
    name: ['Egyptian cafés', 'قهاوي مصر'],
    words: [
      [['Mint tea', 'شاي بالنعناع'], ['Green tea', 'شاي أخضر']],
      [['Turkish coffee', 'قهوة تركي'], ['Espresso', 'إسبريسو']],
      [['Sahlab', 'سحلب'], ['Hot chocolate', 'هوت شوكليت']],
      [['Backgammon', 'طاولة'], ['Dominoes', 'دومينو']],
      [['Karkadeh', 'كركديه'], ['Tamarind', 'تمر هندي']],
      [['Rooftop café', 'كافيه على السطح'], ['Garden café', 'كافيه في جنينة']],
      [['Waiter', 'القهوجي'], ['Barista', 'الباريستا']],
      [['Football match on TV', 'ماتش كورة على الشاشة'], ['Live music night', 'ليلة مزيكا لايف']],
      [['Lemon with mint', 'ليمون بالنعناع'], ['Mango juice', 'عصير مانجا']],
      [['Study corner', 'ركن المذاكرة'], ['Meeting table', 'ترابيزة اجتماعات']],
    ],
  },
  food: {
    name: ['Street food', 'أكل الشارع'],
    words: [
      [['Koshary', 'كشري'], ['Macarona bechamel', 'مكرونة بشاميل']],
      [['Foul', 'فول'], ['Falafel', 'طعمية']],
      [['Hawawshi', 'حواوشي'], ['Shawarma', 'شاورما']],
      [['Feteer', 'فطير'], ['Pizza', 'بيتزا']],
      [['Sugarcane juice', 'عصير قصب'], ['Orange juice', 'عصير برتقال']],
      [['Roasted corn', 'دُرة مشوي'], ['Sweet potato', 'بطاطا']],
      [['Basbousa', 'بسبوسة'], ['Konafa', 'كنافة']],
      [['Liver sandwich', 'سندوتش كبدة'], ['Sausage sandwich', 'سندوتش سجق']],
      [['Om Ali', 'أم علي'], ['Rice pudding', 'رز بلبن']],
      [['Pickles', 'مخلل'], ['Tahini', 'طحينة']],
    ],
  },
  travel: {
    name: ['Travel', 'سفر'],
    words: [
      [['Siwa', 'سيوة'], ['Bahariya', 'الواحات البحرية']],
      [['Dahab', 'دهب'], ['Sharm El Sheikh', 'شرم الشيخ']],
      [['Luxor', 'الأقصر'], ['Aswan', 'أسوان']],
      [['Alexandria', 'إسكندرية'], ['Port Said', 'بورسعيد']],
      [['Night train', 'قطر النوم'], ['Night bus', 'أتوبيس بالليل']],
      [['Felucca', 'فلوكة'], ['Ferry', 'معدية']],
      [['Camping in the desert', 'تخييم في الصحرا'], ['Hostel', 'هوستل']],
      [['Passport', 'باسبور'], ['Boarding pass', 'كارت الصعود']],
      [['Snorkelling', 'سنوركلينج'], ['Diving', 'غطس']],
      [['Lisbon', 'لشبونة'], ['Barcelona', 'برشلونة']],
    ],
  },
};

/* 💣 Arousty — a word to describe without its four forbidden words */
export const TABOO = [
  { w: ['Koshary', 'كشري'], no: [['Rice', 'Lentils', 'Pasta', 'Tomato'], ['رز', 'عدس', 'مكرونة', 'صلصة']] },
  { w: ['Pyramids', 'الأهرامات'], no: [['Giza', 'Pharaoh', 'Tomb', 'Ancient'], ['الجيزة', 'فرعون', 'مقبرة', 'قديم']] },
  { w: ['Ramadan lantern', 'فانوس'], no: [['Light', 'Candle', 'Colours', 'Hang'], ['نور', 'شمعة', 'ألوان', 'نعلّق']] },
  { w: ['Microbus', 'ميكروباص'], no: [['Driver', 'Fare', 'Seats', 'Street'], ['سوّاق', 'أجرة', 'كراسي', 'شارع']] },
  { w: ['Nile', 'النيل'], no: [['River', 'Water', 'Boat', 'Cairo'], ['نهر', 'مية', 'مركب', 'القاهرة']] },
  { w: ['Football', 'كورة'], no: [['Goal', 'Ball', 'Match', 'Al Ahly'], ['جون', 'بلّونة', 'ماتش', 'الأهلي']] },
  { w: ['Exam week', 'أسبوع الامتحانات'], no: [['Study', 'University', 'Stress', 'Grades'], ['مذاكرة', 'جامعة', 'توتر', 'درجات']] },
  { w: ['Wedding', 'فرح'], no: [['Bride', 'Groom', 'Dance', 'Party'], ['عروسة', 'عريس', 'رقص', 'حفلة']] },
  { w: ['Traffic', 'زحمة'], no: [['Cars', 'Late', 'Road', 'Stuck'], ['عربيات', 'متأخر', 'طريق', 'واقفين']] },
  { w: ['Umbrella', 'شمسية'], no: [['Rain', 'Sun', 'Beach', 'Open'], ['مطر', 'شمس', 'بحر', 'نفتح']] },
  { w: ['Selfie', 'سيلفي'], no: [['Photo', 'Phone', 'Camera', 'Smile'], ['صورة', 'موبايل', 'كاميرا', 'ابتسامة']] },
  { w: ['Feluca', 'فلوكة'], no: [['Boat', 'Nile', 'Sail', 'Wind'], ['مركب', 'النيل', 'شراع', 'هوا']] },
  { w: ['Grandmother', 'تيتا'], no: [['Old', 'Mother', 'Cooking', 'Family'], ['كبيرة', 'ماما', 'طبيخ', 'عيلة']] },
  { w: ['Library', 'مكتبة'], no: [['Books', 'Read', 'Quiet', 'Borrow'], ['كتب', 'قراية', 'هدوء', 'استعارة']] },
  { w: ['Sunset', 'الغروب'], no: [['Sun', 'Evening', 'Orange', 'Sky'], ['شمس', 'مغرب', 'برتقاني', 'سما']] },
  { w: ['Volunteer', 'متطوّع'], no: [['Help', 'Free', 'Charity', 'Work'], ['مساعدة', 'ببلاش', 'خير', 'شغل']] },
  { w: ['Metro', 'المترو'], no: [['Train', 'Station', 'Ticket', 'Underground'], ['قطر', 'محطة', 'تذكرة', 'تحت الأرض']] },
  { w: ['Desert', 'صحرا'], no: [['Sand', 'Camel', 'Hot', 'Dunes'], ['رملة', 'جمل', 'حر', 'كثبان']] },
  { w: ['Birthday', 'عيد ميلاد'], no: [['Cake', 'Candles', 'Gift', 'Age'], ['تورتة', 'شمع', 'هدية', 'سن']] },
  { w: ['Coffee', 'قهوة'], no: [['Cup', 'Morning', 'Caffeine', 'Bitter'], ['فنجان', 'الصبح', 'كافيين', 'مُرّة']] },
];

/* 💣 the 5-second bomb: name three, fast */
export const BOMB = [
  ['Three Egyptian dishes', 'تلات أكلات مصرية'], ['Three cities by the sea', 'تلات مدن على البحر'],
  ['Three things in a café', 'تلات حاجات في القهوة'], ['Three languages', 'تلات لغات'],
  ['Three football clubs', 'تلات نوادي كورة'], ['Three fruits', 'تلات فواكه'],
  ['Three apps on your phone', 'تلات أبلكيشنز على موبايلك'], ['Three things at the beach', 'تلات حاجات على البحر'],
  ['Three Egyptian movies', 'تلات أفلام مصري'], ['Three colours of a sunset', 'تلات ألوان في الغروب'],
  ['Three countries in Europe', 'تلات دول في أوروبا'], ['Three desserts', 'تلات حلويات'],
  ['Three jobs', 'تلات وظايف'], ['Three animals in Egypt', 'تلات حيوانات في مصر'],
  ['Three things you pack for a trip', 'تلات حاجات بتاخدها في السفر'], ['Three singers', 'تلات مطربين'],
];

/* 🔥 Table Sparks — "Who at this table…" and hot takes */
export const WHO = [
  ['…would win a dance-off right now?', '…هيكسب مسابقة رقص دلوقتي؟'],
  ['…has the best travel story?', '…عنده أحلى حكاية سفر؟'],
  ['…would survive a week in the desert?', '…هيعيش أسبوع في الصحرا؟'],
  ['…is most likely to start a business?', '…غالباً هيفتح بيزنس؟'],
  ['…would be the best tour guide?', '…هيبقى أحسن مرشد سياحي؟'],
  ['…has the most photos on their phone?', '…عنده أكتر صور على موبايله؟'],
  ['…would cook the best dinner tonight?', '…هيطبخ أحلى عشا النهارده؟'],
  ['…is the best at keeping a secret?', '…أشطر واحد يشيل سر؟'],
  ['…would learn a new language fastest?', '…هيتعلم لغة جديدة أسرع؟'],
  ['…is most likely to move abroad?', '…غالباً هيسافر يعيش برّه؟'],
  ['…laughs the loudest?', '…ضحكته أعلى واحدة؟'],
  ['…would plan the perfect weekend?', '…هيخطط أحلى ويك إند؟'],
  ['…is the night owl?', '…اللي بيسهر لحد الصبح؟'],
  ['…would make friends anywhere in the world?', '…هيصاحب ناس في أي حتة في الدنيا؟'],
  ['…gives the best advice?', '…بيدّي أحسن نصيحة؟'],
];
export const HOT = [
  ['Koshary is better than any burger.', 'الكشري أحسن من أي برجر.'],
  ['Summer in Alexandria beats summer in Sahel.', 'صيف إسكندرية أحلى من الساحل.'],
  ['Mornings are better than nights.', 'الصبح أحلى من بالليل.'],
  ['You should travel alone at least once.', 'لازم تسافر لوحدك مرة على الأقل.'],
  ['Voice notes are better than texts.', 'الفويس نوت أحسن من الرسايل.'],
  ['Tea beats coffee.', 'الشاي أحسن من القهوة.'],
  ['A road trip beats a flight.', 'رحلة بالعربية أحلى من الطيارة.'],
  ['Books are better than their films.', 'الكتاب دايماً أحلى من الفيلم.'],
  ['Pineapple belongs on pizza.', 'الأناناس مكانه على البيتزا.'],
  ['Every city has a better side at night.', 'كل مدينة أحلى بالليل.'],
  ['Learning a language is easier with friends.', 'تعلّم اللغة أسهل مع صحابك.'],
  ['The best plans are the last-minute ones.', 'أحلى الخروجات اللي بتتعمل في آخر لحظة.'],
  ['Board games beat phone games.', 'ألعاب الترابيزة أحلى من ألعاب الموبايل.'],
  ['A sunrise is worth waking up for.', 'الشروق يستاهل تصحى عشانه.'],
  ['Small towns beat big cities.', 'البلاد الصغيرة أحلى من المدن الكبيرة.'],
];

/* 🎤 Campfire & Karaoke — our own songs, with chords. Each line: [seconds, chord, words] */
export const SONGS = [
  {
    id: 'table-tonight', title: ['At This Table Tonight', 'على الترابيزة الليلة'], lang: 'en', bpm: 92,
    lines: [
      [0, 'Am', 'Strangers at the door, now we save a seat'],
      [4, 'G', 'Someone brought the tea, someone brought the beat'],
      [8, 'F', 'Phones face down, the city in the light'],
      [12, 'C', 'We are only here, at this table tonight'],
      [16, 'Am', 'Tell me where you\'re from, tell me where you\'ll go'],
      [20, 'G', 'Every little story makes the evening glow'],
      [24, 'F', 'Sing it if you know it, hum it if you might'],
      [28, 'C', 'We are only here, at this table tonight'],
    ],
  },
  {
    id: 'ala-el-tarabeeza', title: ['Ala El Tarabeeza', 'على الترابيزة'], lang: 'ar', bpm: 96,
    lines: [
      [0, 'Am', 'جينا من بعيد وقعدنا قريب'],
      [4, 'G', 'كوباية شاي وكلام بيطيب'],
      [8, 'F', 'مين فينا حكى ومين فينا ضحك'],
      [12, 'C', 'الليلة دي لينا والقمر شاهد علينا'],
      [16, 'Am', 'قول اسمك تاني وقولّي منين'],
      [20, 'G', 'بكرة نلف الدنيا وإحنا مع بعض اتنين'],
      [24, 'F', 'غنّي معانا لو تعرف الكلام'],
      [28, 'C', 'الليلة دي لينا ولمّتنا تمام'],
    ],
  },
  {
    id: 'twinkle', title: ['Twinkle, Twinkle (traditional)', 'توينكل توينكل (تراثية)'], lang: 'en', bpm: 84,
    lines: [
      [0, 'C', 'Twinkle, twinkle, little star'],
      [4, 'F', 'How I wonder what you are'],
      [8, 'C', 'Up above the world so high'],
      [12, 'G', 'Like a diamond in the sky'],
      [16, 'C', 'Twinkle, twinkle, little star'],
      [20, 'G', 'How I wonder what you are'],
    ],
  },
];

/* "[Am]words [G]more words" → lines for the host's own song, 4 seconds each */
export const parseCustom = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 60).map((l, i) => {
  const m = l.match(/^\[([A-G][#b]?m?(?:maj7|7|sus4|sus2)?)\]\s*(.*)$/);
  return [i * 4, m ? m[1] : '', m ? m[2] : l];
});

export const pick = (lang, pair) => (Array.isArray(pair) ? pair[lang === 'ar' ? 1 : 0] : pair);
