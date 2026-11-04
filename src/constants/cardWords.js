/* ─── THE WORDS OF THE 3-PHOTO CARD AND THE BLURRED SEATS ─────────────
   Ayser, November 2026 (RUN_ME.sql, "THE 3-PHOTO CARD"). English and
   Arabic; other languages read English until they are written. On its
   own so only the screens that use it carry it. */

const W = {
  en: {
    title: 'Your profile card',
    sub: 'Three photos and two short answers. The people at your table see them after you both scan the table’s QR.',
    need: 'Make your profile card to book a seat',
    needSub: 'Three photos and two short answers, once. +30 points',
    ready: 'Your card is ready',
    edit: 'Edit my card',
    p1: 'Your face',
    p1Sub: 'Clear, just you, no sunglasses.',
    p2: 'Your life',
    p3: 'Your thing',
    p23Sub: 'Travel, a run, music, a hobby — something that is you.',
    faceNote: 'Photo 1 will be checked against your Safety Pass selfie once the Safety Pass is switched on. Until then it is not marked as verified.',
    add: 'Add photo',
    change: 'Change',
    prompts: 'Two short answers',
    pick: 'Pick a question',
    answer: 'Your answer',
    save: 'Save my card',
    saving: 'Saving…',
    saved: 'Saved. +{n} points',
    savedNoXp: 'Saved.',
    missing: 'Add all three photos and both answers.',
    err: 'That did not go through. Try again.',
    close: 'Close',
    q: [
      'A perfect Friday looks like…',
      'Ask me about…',
      'This year I want to try…',
      'My go-to table talk is…',
      'You will find me at…',
      'A small thing that makes my day…',
    ],
    seat: 'Seat #{n}',
    organizer: 'Organizer',
    you: 'You',
    lockPeek: 'Scan the Table QR on-site to unblur Seat #{n}’s 3 photos & identity',
    lockMe: 'You are in. Seat #{n} has not scanned the table’s QR yet.',
    tapPeek: 'Tap a seat to peek',
    noCard: 'No card yet.',
    sparks: 'Friday Sparks',
    sparksSub: 'For three hours after the table, send up to 3 secret Sparks to people who were really there. If two Sparks meet, you are connected.',
    sparksLeft: '{n} Sparks left',
    sparksSoon: 'Sparks open when the table ends, for three hours.',
    sparksOver: 'Sparks for this table have closed.',
    send: 'Send Secret Spark',
    sent: 'Spark sent',
    mutual: 'You both sent a Spark. You are connected.',
    connected: 'Connected',
    three: 'You have sent your three Sparks for this table.',
    nobody: 'Nobody else checked in at this table.',
  },
  ar: {
    title: 'كارت البروفايل بتاعك',
    sub: 'تلات صور وإجابتين قصيرين. اللي على ترابيزتك بيشوفوهم بعد ما انتوا الاتنين تمسحوا QR الترابيزة.',
    need: 'اعمل كارت البروفايل عشان تحجز كرسي',
    needSub: 'تلات صور وإجابتين قصيرين، مرة واحدة. +٣٠ نقطة',
    ready: 'الكارت بتاعك جاهز',
    edit: 'عدّل الكارت',
    p1: 'وشّك',
    p1Sub: 'واضح، إنت لوحدك، من غير نضارة شمس.',
    p2: 'حياتك',
    p3: 'حاجتك',
    p23Sub: 'سفر، جري، مزيكا، هواية — حاجة تشبهك.',
    faceNote: 'الصورة الأولى هتتقارن بسيلفي الـSafety Pass أول ما يتفتح. لحد ساعتها مش هتتعلّم إنها متأكدة.',
    add: 'زوّد صورة',
    change: 'غيّر',
    prompts: 'إجابتين قصيرين',
    pick: 'اختار سؤال',
    answer: 'إجابتك',
    save: 'احفظ الكارت',
    saving: 'بيتحفظ…',
    saved: 'اتحفظ. +{n} نقطة',
    savedNoXp: 'اتحفظ.',
    missing: 'زوّد التلات صور والإجابتين.',
    err: 'ماتمّتش. جرّب تاني.',
    close: 'اقفل',
    q: [
      'يوم الجمعة المثالي بالنسبالي…',
      'اسألني عن…',
      'السنة دي نفسي أجرّب…',
      'الكلام اللي بحب أفتحه على الترابيزة…',
      'هتلاقيني في…',
      'حاجة صغيرة بتفرّح يومي…',
    ],
    seat: 'كرسي #{n}',
    organizer: 'المنظّم',
    you: 'إنت',
    lockPeek: 'امسح QR الترابيزة في المكان عشان تشوف صور وشخصية كرسي #{n}',
    lockMe: 'إنت عملت تشيك إن. كرسي #{n} لسه ما مسحش QR الترابيزة.',
    tapPeek: 'دوس على أي كرسي وبُص',
    noCard: 'لسه مفيش كارت.',
    sparks: 'سباركس الجمعة',
    sparksSub: 'لمدة ٣ ساعات بعد الترابيزة، ابعت لحد ٣ سباركس سرّية للناس اللي كانوا موجودين فعلاً. لو اتنين سباركس اتقابلوا، بتبقوا متوصّلين.',
    sparksLeft: 'فاضلك {n} سباركس',
    sparksSoon: 'السباركس بتتفتح لما الترابيزة تخلص، لمدة ٣ ساعات.',
    sparksOver: 'سباركس الترابيزة دي اتقفلت.',
    send: 'ابعت سبارك سرّي',
    sent: 'السبارك اتبعت',
    mutual: 'انتوا الاتنين بعتوا سبارك. بقيتوا متوصّلين.',
    connected: 'متوصّلين',
    three: 'بعت السباركس التلاتة بتوع الترابيزة دي.',
    nobody: 'محدش تاني عمل تشيك إن على الترابيزة دي.',
  },
};

const AR = (x) => String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const cw = (lang, k, vars) => {
  const row = W[lang === 'ar' ? 'ar' : 'en'];
  let s = row[k] != null ? row[k] : W.en[k];
  if (typeof s !== 'string') return s;
  Object.keys(vars || {}).forEach((v) => { s = s.replace('{' + v + '}', lang === 'ar' ? AR(vars[v]) : String(vars[v])); });
  return s;
};

/* "04" — a seat number as the table reads it */
export const seatNo = (n) => String(n || 0).padStart(2, '0');

/* the first two interests, "Coffee & Art" */
export const interestLine = (s) => String(s || '').split(/[,،|/]+/).map((x) => x.trim()).filter(Boolean).slice(0, 2).join(' & ');

/* a line-drawn badge for an interest (charcoal outline icons, no emoji) */
const ICONS = [
  [/coffee|cafe|café|قهوة|كافيه/i, 'cafe-outline'],
  [/art|paint|draw|design|رسم|فن/i, 'color-palette-outline'],
  [/music|guitar|sing|piano|مزيكا|موسيقى|غنا/i, 'musical-notes-outline'],
  [/run|jog|gym|sport|football|fitness|جري|رياضة|كورة/i, 'walk-outline'],
  [/travel|trip|hike|سفر|رحلات/i, 'airplane-outline'],
  [/book|read|writ|كتب|قراءة|كتابة/i, 'book-outline'],
  [/food|cook|bak|أكل|طبخ/i, 'restaurant-outline'],
  [/photo|camera|film|تصوير|أفلام/i, 'camera-outline'],
  [/tech|code|program|برمجة/i, 'code-slash-outline'],
  [/language|english|لغة|إنجليزي/i, 'chatbubbles-outline'],
  [/volunteer|impact|تطوع/i, 'leaf-outline'],
];
export const interestIcon = (s) => { const t = String(s || ''); for (const [re, ic] of ICONS) if (re.test(t)) return ic; return 'sparkles-outline'; };
