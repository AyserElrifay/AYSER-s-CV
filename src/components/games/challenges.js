/* the phone's own date (the same as services/squadGames.js localDay) */
const localDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/* ─── SOMETHING NEW EVERY DAY, THREE EVERY WEEK ───────────────────────
   Ayser: "خليهم أكتر … كل يوم حاجة أو كل أسبوع تلت حاجات … بتتغير عشان
   الناس ماتزهقش". One challenge a day for the whole world (BeReal's one
   prompt, the photo-a-day lists), and three a week (Strava's weekly
   challenges): cook this, go here, do it with people.

   The daily list walks through seven kinds in turn — sky, food, the
   street, a small detail, nature, a kindness, a colour — so no two days
   in a row feel alike, and nothing comes back for 84 days (12 weeks).
   Everybody gets the same one on the same date, wherever they are, so
   the strip really is the world doing one thing. The server only
   checks the date (RUN_ME.sql, "SOMETHING NEW EVERY DAY"). */

/* our own photographs with nobody's face in them, one per kind, shown
   until somebody shares today's */
export const LOOK = {
  sky: 'welcome-sunset.jpg', food: 'welcome-breakfast.jpg', city: 'rooftop-giza.jpg', detail: 'welcome-tea.jpg',
  nature: 'welcome-trees.jpg', kind: 'welcome-cat.jpg', colour: 'welcome-dahab.jpg',
  cook: 'welcome-breakfast.jpg', go: 'welcome-catherine.jpg', together: 'welcome-tea.jpg',
};

export const DAILY = [
  { c: 'sky', en: "Golden hour", ar: "ساعة الغروب", s_en: "One photo of the sky tonight, wherever you are.", s_ar: "صورة للسما النهارده بالليل، من أي حتة." },
  { c: 'food', en: "Breakfast as it is", ar: "الفطار زي ما هو", s_en: "No styling. Just the real plate.", s_ar: "من غير ترتيب، الطبق الحقيقي." },
  { c: 'city', en: "Your street", ar: "شارعك", s_en: "The way it looks right now.", s_ar: "زي ما هو دلوقتي." },
  { c: 'detail', en: "Something round", ar: "حاجة مدوّرة", s_en: "Look closer than usual.", s_ar: "بص أقرب من العادي." },
  { c: 'nature', en: "One tree", ar: "شجرة واحدة", s_en: "The one you would miss if it went.", s_ar: "اللي هتوحشك لو اختفت." },
  { c: 'kind', en: "Something you fixed", ar: "حاجة صلّحتها", s_en: "Instead of throwing it away.", s_ar: "بدل ما ترميها." },
  { c: 'colour', en: "Something yellow", ar: "حاجة صفرا", s_en: "The first one you see.", s_ar: "أول حاجة تشوفها." },
  { c: 'sky', en: "First light", ar: "أول نور", s_en: "The sky before the city wakes up.", s_ar: "السما قبل ما المدينة تصحى." },
  { c: 'food', en: "Street food", ar: "أكل الشارع", s_en: "The thing you buy on the way.", s_ar: "الحاجة اللي بتشتريها وإنت ماشي." },
  { c: 'city', en: "A door you love", ar: "باب بتحبه", s_en: "Old, painted, or just yours.", s_ar: "قديم، ملوّن، أو بتاعك." },
  { c: 'detail', en: "Your keys", ar: "مفاتيحك", s_en: "The little things you carry.", s_ar: "الحاجات الصغيرة اللي معاك." },
  { c: 'nature', en: "Green in the city", ar: "أخضر في المدينة", s_en: "Plants where you do not expect them.", s_ar: "زرع في مكان مش متوقع." },
  { c: 'kind', en: "A note for a stranger", ar: "ورقة لحد ماتعرفوش", s_en: "Leave it somewhere kind.", s_ar: "سيبها في مكان لطيف." },
  { c: 'colour', en: "Something blue", ar: "حاجة زرقا", s_en: "The first one you see.", s_ar: "أول حاجة تشوفها." },
  { c: 'sky', en: "A cloud with a shape", ar: "سحابة ليها شكل", s_en: "Find one that looks like something.", s_ar: "دوّر على سحابة شبه حاجة." },
  { c: 'food', en: "A dish from home", ar: "أكلة من البيت", s_en: "The one that tastes like family.", s_ar: "اللي طعمها زي العيلة." },
  { c: 'city', en: "Stairs", ar: "سلالم", s_en: "Going up or down somewhere.", s_ar: "طالعة أو نازلة لمكان." },
  { c: 'detail', en: "Hands at work", ar: "إيدين بتشتغل", s_en: "Making, fixing, writing. No faces needed.", s_ar: "بتعمل، بتصلّح، بتكتب. من غير وشوش." },
  { c: 'nature', en: "A flower", ar: "وردة", s_en: "Wild or in a pot.", s_ar: "برية أو في أصيص." },
  { c: 'kind', en: "One thing off the ground", ar: "حاجة شلتها من الأرض", s_en: "Litter, gone.", s_ar: "زبالة واتشالت." },
  { c: 'colour', en: "Something red", ar: "حاجة حمرا", s_en: "The first one you see.", s_ar: "أول حاجة تشوفها." },
  { c: 'sky', en: "The moon tonight", ar: "القمر النهارده", s_en: "Whatever shape it is where you are.", s_ar: "بأي شكل هو عندك." },
  { c: 'food', en: "Tea or coffee, your way", ar: "شاي أو قهوة على طريقتك", s_en: "The cup you actually drink.", s_ar: "الكوباية اللي بتشربها فعلًا." },
  { c: 'city', en: "A sign in your language", ar: "لافتة بلغتك", s_en: "Letters from where you are.", s_ar: "حروف من المكان اللي إنت فيه." },
  { c: 'detail', en: "Something old you keep", ar: "حاجة قديمة شايلها", s_en: "And one line on why.", s_ar: "وسطر واحد ليه." },
  { c: 'nature', en: "Water moving", ar: "مية بتتحرك", s_en: "A river, a fountain, a tap.", s_ar: "نهر، نافورة، أو حنفية." },
  { c: 'kind', en: "A gift you made", ar: "هدية عملتها", s_en: "Big or tiny.", s_ar: "كبيرة أو صغيرة." },
  { c: 'colour', en: "Something green", ar: "حاجة خضرا", s_en: "The first one you see.", s_ar: "أول حاجة تشوفها." },
  { c: 'sky', en: "Blue hour", ar: "الساعة الزرقا", s_en: "Just after sunset, before dark.", s_ar: "بعد الغروب وقبل الضلمة." },
  { c: 'food', en: "Bread", ar: "العيش", s_en: "However your country makes it.", s_ar: "بأي شكل بلدك بتعمله." },
  { c: 'city', en: "On the way", ar: "في الطريق", s_en: "Your daily trip in one frame.", s_ar: "مشوارك اليومي في صورة واحدة." },
  { c: 'detail', en: "Pattern", ar: "نقشة", s_en: "Tiles, fabric, a wall.", s_ar: "بلاط، قماش، حيطة." },
  { c: 'nature', en: "A bird", ar: "عصفورة", s_en: "Or any animal that lives near you.", s_ar: "أو أي حيوان عايش جنبك." },
  { c: 'kind', en: "Food you shared", ar: "أكل شاركته", s_en: "With a neighbour, a friend, anyone.", s_ar: "مع جار، صاحب، أو أي حد." },
  { c: 'colour', en: "Black and white", ar: "أبيض وأسود", s_en: "Try the Mono look.", s_ar: "جرّب فلتر أبيض وأسود." },
  { c: 'sky', en: "Sky through a window", ar: "السما من الشباك", s_en: "The view you get every day.", s_ar: "المنظر اللي بتشوفه كل يوم." },
  { c: 'food', en: "One fruit", ar: "فاكهة واحدة", s_en: "In season where you are.", s_ar: "من موسمها عندك." },
  { c: 'city', en: "A small shop", ar: "محل صغير", s_en: "The one you always pass.", s_ar: "اللي دايمًا بتعدي عليه." },
  { c: 'detail', en: "Your desk", ar: "مكتبك", s_en: "Where your day happens.", s_ar: "المكان اللي يومك بيعدي فيه." },
  { c: 'nature', en: "Leaves, up close", ar: "ورق شجر من قريب", s_en: "Closer than you think.", s_ar: "أقرب مما تتخيل." },
  { c: 'kind', en: "Water for the birds", ar: "مية للعصافير", s_en: "A bowl on the balcony counts.", s_ar: "طبق على البلكونة يتحسب." },
  { c: 'colour', en: "Something pink", ar: "حاجة بمبي", s_en: "The first one you see.", s_ar: "أول حاجة تشوفها." },
  { c: 'sky', en: "Light on a wall", ar: "نور على حيطة", s_en: "Where the sun lands this afternoon.", s_ar: "المكان اللي الشمس واقعة عليه العصر." },
  { c: 'food', en: "A shared table", ar: "ترابيزة مشتركة", s_en: "Food for more than one. Hands are fine.", s_ar: "أكل لأكتر من واحد. الإيدين ماشي." },
  { c: 'city', en: "Balconies", ar: "البلكونات", s_en: "How people live above the street.", s_ar: "إزاي الناس عايشة فوق الشارع." },
  { c: 'detail', en: "Shoes that walked today", ar: "جزمة مشيت النهارده", s_en: "Where did they take you?", s_ar: "ودّتك فين؟" },
  { c: 'nature', en: "The ground you stand on", ar: "الأرض اللي واقف عليها", s_en: "Sand, soil or stone.", s_ar: "رمل، طين، أو حجر." },
  { c: 'kind', en: "Something you gave away", ar: "حاجة اديتها لحد", s_en: "Clothes, a book, your time.", s_ar: "هدوم، كتاب، أو وقتك." },
  { c: 'colour', en: "Something orange", ar: "حاجة برتقاني", s_en: "The first one you see.", s_ar: "أول حاجة تشوفها." },
  { c: 'sky', en: "After the rain", ar: "بعد المطر", s_en: "Or the closest thing to it today.", s_ar: "أو أقرب حاجة ليه النهارده." },
  { c: 'food', en: "Something sweet", ar: "حاجة حلوة", s_en: "A dessert from where you live.", s_ar: "حلو من المكان اللي إنت فيه." },
  { c: 'city', en: "Old and new", ar: "قديم وجديد", s_en: "Two times in one picture.", s_ar: "زمنين في صورة واحدة." },
  { c: 'detail', en: "The book you are reading", ar: "الكتاب اللي بتقراه", s_en: "The page you are on.", s_ar: "الصفحة اللي إنت فيها." },
  { c: 'nature', en: "A cat or dog you know", ar: "قطة أو كلب تعرفه", s_en: "Tell us their name.", s_ar: "وقولنا اسمه." },
  { c: 'kind', en: "A thank-you", ar: "شكرًا", s_en: "Write it down, then give it.", s_ar: "اكتبها، وبعدين اديها." },
  { c: 'colour', en: "Something purple", ar: "حاجة بنفسجي", s_en: "The colour of Moments.", s_ar: "لون Moments." },
  { c: 'sky', en: "Straight up", ar: "فوق على طول", s_en: "The sky above you, no buildings.", s_ar: "السما اللي فوقك، من غير مباني." },
  { c: 'food', en: "The market", ar: "السوق", s_en: "The colours of what is for sale.", s_ar: "ألوان الحاجات اللي بتتباع." },
  { c: 'city', en: "A bench", ar: "دكة", s_en: "A place to sit and watch.", s_ar: "مكان تقعد وتتفرج." },
  { c: 'detail', en: "Something handmade", ar: "حاجة معمولة بإيد", s_en: "By you or someone you know.", s_ar: "بإيدك أو بإيد حد تعرفه." },
  { c: 'nature', en: "The closest water", ar: "أقرب مية ليك", s_en: "However far it is.", s_ar: "مهما كانت بعيدة." },
  { c: 'kind', en: "A hand with the shopping", ar: "ساعدت في المشتريات", s_en: "For someone older, or busy.", s_ar: "لحد كبير أو مشغول." },
  { c: 'colour', en: "Gold", ar: "دهبي", s_en: "Try the Golden look.", s_ar: "جرّب الفلتر الدهبي." },
  { c: 'sky', en: "A long shadow", ar: "ضل طويل", s_en: "Late sun makes everything taller.", s_ar: "شمس آخر النهار بتطوّل كل حاجة." },
  { c: 'food', en: "Spices", ar: "التوابل", s_en: "What gives your food its taste.", s_ar: "اللي بيدي لأكلك طعمه." },
  { c: 'city', en: "Your corner café", ar: "كافيه الناصية", s_en: "Where your neighbourhood meets.", s_ar: "المكان اللي الحي بيتقابل فيه." },
  { c: 'detail', en: "Texture", ar: "ملمس", s_en: "Wood, stone, sand, bread.", s_ar: "خشب، حجر، رمل، عيش." },
  { c: 'nature', en: "The wind", ar: "الهوا", s_en: "Show something it is moving.", s_ar: "صوّر حاجة الهوا بيحرّكها." },
  { c: 'kind', en: "A plant you watered", ar: "زرع سقيته", s_en: "Yours or the street’s.", s_ar: "بتاعك أو بتاع الشارع." },
  { c: 'colour', en: "Only two colours", ar: "لونين بس", s_en: "A frame with just two.", s_ar: "صورة فيها لونين بس." },
  { c: 'sky', en: "Sky and water", ar: "سما ومية", s_en: "Sea, river, a puddle — anything that shines back.", s_ar: "بحر، نهر، أو حتى بركة مية." },
  { c: 'food', en: "Lunch today", ar: "غدا النهارده", s_en: "Whatever it is, honestly.", s_ar: "أيًّا كان، بصراحة." },
  { c: 'city', en: "Getting around", ar: "المواصلات", s_en: "Bus, tram, boat, tuk-tuk.", s_ar: "أتوبيس، ترام، مركب، توكتوك." },
  { c: 'detail', en: "A reflection", ar: "انعكاس", s_en: "In a window, a spoon, a puddle.", s_ar: "في إزاز، معلقة، أو مية." },
  { c: 'nature', en: "A park", ar: "جنينة", s_en: "Where your city breathes.", s_ar: "المكان اللي مدينتك بتتنفس فيه." },
  { c: 'kind', en: "Something you learned today", ar: "حاجة اتعلمتها النهارده", s_en: "Show it in one picture.", s_ar: "وريها في صورة واحدة." },
  { c: 'colour', en: "Something white", ar: "حاجة بيضا", s_en: "The first one you see.", s_ar: "أول حاجة تشوفها." },
  { c: 'sky', en: "Night lights", ar: "نور الليل", s_en: "Your city after dark.", s_ar: "مدينتك بعد الضلمة." },
  { c: 'food', en: "A first taste", ar: "أول مرة تدوقها", s_en: "Something you never ate before.", s_ar: "حاجة عمرك ما أكلتها قبل كده." },
  { c: 'city', en: "From up high", ar: "من فوق", s_en: "A roof, a hill, a bridge.", s_ar: "سطح، تل، أو كوبري." },
  { c: 'detail', en: "A ticket or a note", ar: "تذكرة أو ورقة", s_en: "Something with a story.", s_ar: "حاجة وراها حكاية." },
  { c: 'nature', en: "Something growing", ar: "حاجة بتكبر", s_en: "A seed, a sprout, a plant at home.", s_ar: "بذرة، نبتة، زرع في البيت." },
  { c: 'kind', en: "Your calm place", ar: "مكانك الهادي", s_en: "Where you go to breathe.", s_ar: "المكان اللي بتروحه ترتاح." },
  { c: 'colour', en: "Every colour", ar: "كل الألوان", s_en: "The most colourful thing near you.", s_ar: "أكتر حاجة ملوّنة جنبك." },
];

const COOK = [
  { en: "Lentil soup", ar: "شوربة عدس" },
  { en: "Pancakes", ar: "بان كيك" },
  { en: "Falafel", ar: "فلافل" },
  { en: "Bread from scratch", ar: "عيش في البيت" },
  { en: "A cold salad from your country", ar: "سلطة باردة من بلدك" },
  { en: "Grilled corn", ar: "دُرة مشوية" },
  { en: "Lemonade", ar: "ليمونادة" },
  { en: "Stuffed vegetables", ar: "محشي" },
  { en: "Rice pudding", ar: "رز بلبن" },
  { en: "Your grandmother’s recipe", ar: "وصفة تيتة" },
  { en: "Soup for a cold night", ar: "شوربة لليلة باردة" },
  { en: "Something with eggs", ar: "حاجة بالبيض" },
];
const GO = [
  { en: "A sunrise somewhere new", ar: "شروق في مكان جديد" },
  { en: "A walk you have never taken", ar: "مشوار عمرك ما مشيته" },
  { en: "A museum or gallery", ar: "متحف أو معرض" },
  { en: "The oldest building near you", ar: "أقدم مبنى جنبك" },
  { en: "A market you have never been to", ar: "سوق عمرك ما رحته" },
  { en: "A library", ar: "مكتبة" },
  { en: "Somewhere with water", ar: "مكان فيه مية" },
  { en: "A place from your childhood", ar: "مكان من طفولتك" },
  { en: "A neighbourhood you do not know", ar: "حي ماتعرفوش" },
  { en: "A rooftop", ar: "سطح" },
  { en: "A garden or a farm", ar: "جنينة أو مزرعة" },
  { en: "The last stop of a bus line", ar: "آخر محطة في خط أتوبيس" },
];
const TOGETHER = [
  { en: "Eat with someone new", ar: "كُل مع حد جديد" },
  { en: "Play a game outside", ar: "العب لعبة برا" },
  { en: "Teach someone something", ar: "علّم حد حاجة" },
  { en: "Walk with a friend", ar: "اتمشى مع صاحب" },
  { en: "Cook for someone", ar: "اطبخ لحد" },
  { en: "A picnic", ar: "نزهة" },
  { en: "Watch a sunset with someone", ar: "اتفرج على الغروب مع حد" },
  { en: "Visit someone you miss", ar: "زور حد واحشك" },
  { en: "Join a plan on Moments", ar: "انضم لخطة على Moments" },
  { en: "Clean a spot together", ar: "نضّفوا مكان سوا" },
  { en: "Make music together", ar: "اعملوا مزيكا سوا" },
  { en: "Write a letter by hand", ar: "اكتب جواب بإيدك" },
];

// day 0 is 21 Oct 2026 (a Wednesday), so the list starts with Golden hour
const EPOCH = Date.UTC(2026, 9, 21);
const dayNo = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 864e5);
const mod = (n, m) => ((n % m) + m) % m;

/* ISO week of the phone's own date: week-year and week number */
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return { y, w };
}

export function todayChallenge(d = new Date()) {
  const it = DAILY[mod(dayNo(d), DAILY.length)];
  return { ...it, key: 'day-' + localDay(d), img: LOOK[it.c] };
}

export function weekChallenges(d = new Date()) {
  const { y, w } = isoWeek(d);
  // weeks run Monday to Sunday, like the ISO week in the key (19 Oct 2026 is day -2)
  const n = Math.floor((dayNo(d) + 2) / 7);
  const tag = 'wk-' + y + '-' + String(w).padStart(2, '0') + '-';
  return [
    { ...COOK[mod(n, COOK.length)], c: 'cook', key: tag + '1', img: LOOK.cook },
    { ...GO[mod(n + 5, GO.length)], c: 'go', key: tag + '2', img: LOOK.go },
    { ...TOGETHER[mod(n + 9, TOGETHER.length)], c: 'together', key: tag + '3', img: LOOK.together },
  ];
}
