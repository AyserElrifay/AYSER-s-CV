/* ─── THE WORLD THE GAMES ARE SET IN ──────────────────────────────────
   Both arcade games — the climb and the crossing — travel the same six
   places, in the same order, so they feel like one world rather than two
   unrelated toys.

   Everything in here is real: real heritage that has stood for centuries
   and belongs to everyone, and real customs described the way the people
   who keep them would describe them. Nothing is borrowed from anybody's
   game, film or brand — every monument below is ancient and every drawing
   of it in towerArt.js / hopArt.js is drawn from shapes, by us.

   A player who clears a chapter gets the culture card for that place.
   That is the point of the whole thing: you leave knowing something.  */

export const PLACES = [
  {
    id: 'giza',
    flag: '🇪🇬', country: 'Egypt', countryAr: 'مصر',
    city: 'Giza', cityAr: 'الجيزة',
    site: 'The Great Pyramid', siteAr: 'الهرم الأكبر',
    token: 'scarab', tokenName: 'Scarab', tokenNameAr: 'جعران',
    // the palette every drawing of this chapter pulls from
    sky: ['#2B1055', '#7A3B7A', '#E5813F', '#FFC978'],
    stone: '#D8B87C', stoneDark: '#9C7B47', accent: '#FFD23F', deep: '#1A0E2E',
    fact: 'The Great Pyramid was the tallest thing people had ever built — and it kept that record for about 3,800 years.',
    factAr: 'الهرم الأكبر فضل أطول حاجة بناها البشر لحوالي ٣٨٠٠ سنة.',
    custom: 'You are never let out of an Egyptian home without eating or drinking something. Saying "I\'m fine" is heard as the start of the negotiation, not the end.',
    customAr: 'محدش بيسيب بيت مصري من غير ما ياكل أو يشرب حاجة. لما تقول "متشكر أنا كويس" ده بداية الكلام، مش نهايته.',
  },
  {
    id: 'petra',
    flag: '🇯🇴', country: 'Jordan', countryAr: 'الأردن',
    city: 'Petra', cityAr: 'البتراء',
    site: 'The Treasury', siteAr: 'الخزنة',
    token: 'urn', tokenName: 'Carved urn', tokenNameAr: 'جرة منحوتة',
    sky: ['#241033', '#6B2E4E', '#C4573F', '#F2A46B'],
    stone: '#C2624A', stoneDark: '#7E3A2E', accent: '#FFB37A', deep: '#170B20',
    fact: 'Petra was not built up from the ground — it was carved down into the cliff, from the top, so the scaffolding could be removed as the masons descended.',
    factAr: 'البتراء ما اتبنتش من تحت لفوق — اتنحتت في الصخر من فوق لتحت، عشان السقالة تتشال مع نزول النحاتين.',
    custom: 'Coffee is poured for you in a small cup and kept coming. Wobble the empty cup from side to side to say thank you, enough — words are not needed.',
    customAr: 'القهوة بتتصب لك في فنجان صغير وبتفضل تتصب. هزّ الفنجان يمين وشمال معناها شكراً كفاية — من غير كلام.',
  },
  {
    id: 'marrakech',
    flag: '🇲🇦', country: 'Morocco', countryAr: 'المغرب',
    city: 'Marrakech', cityAr: 'مراكش',
    site: 'The Minaret', siteAr: 'المنارة',
    token: 'tea', tokenName: 'Glass of mint tea', tokenNameAr: 'كاس أتاي',
    sky: ['#331240', '#8C3A5A', '#D9663C', '#F5B562'],
    stone: '#D96F3C', stoneDark: '#8E4322', accent: '#2FBFA0', deep: '#1B0A22',
    fact: 'The old city is built from rammed earth the colour of the ground it stands on — which is why Marrakech is called the red city.',
    factAr: 'المدينة القديمة مبنية بطين مدكوك بلون الأرض اللي واقفة عليها — عشان كده مراكش اسمها المدينة الحمراء.',
    custom: 'Mint tea is poured from high above the glass so it foams. The first glass is offered, the second is expected, the third is friendship — leaving before it is a small insult.',
    customAr: 'الأتاي بيتصب من فوق عشان يعمل رغوة. الكاس الأول ضيافة، والتاني متوقع، والتالت صداقة — واللي يمشي قبله بيزعّل.',
  },
  {
    id: 'rome',
    flag: '🇮🇹', country: 'Italy', countryAr: 'إيطاليا',
    city: 'Rome', cityAr: 'روما',
    site: 'The Amphitheatre', siteAr: 'المدرج',
    token: 'laurel', tokenName: 'Laurel wreath', tokenNameAr: 'إكليل غار',
    sky: ['#141B3A', '#3E3F72', '#8A6E8C', '#E2B48A'],
    stone: '#E3D3B0', stoneDark: '#9A8763', accent: '#7ED9C3', deep: '#0D1128',
    fact: 'The amphitheatre could empty eighty exits in minutes. Modern stadiums still copy the idea, and still call the passages by the Roman name.',
    factAr: 'المدرج كان بيفضى من ٨٠ مخرج في دقايق. الاستادات لحد دلوقتي بتقلد الفكرة وبتسمي الممرات بالاسم الروماني.',
    custom: 'Coffee is drunk standing at the bar, in a mouthful, and milky coffee stops at eleven in the morning. Ordering one after lunch marks you as a visitor faster than a map does.',
    customAr: 'القهوة بتتشرب واقف على البار وفي نفس واحد، والقهوة باللبن بتقف الساعة ١١ الصبح. لو طلبتها بعد الغدا هيعرفوا إنك زائر قبل ما تفتح الخريطة.',
  },
  {
    id: 'agra',
    flag: '🇮🇳', country: 'India', countryAr: 'الهند',
    city: 'Agra', cityAr: 'أجرا',
    site: 'The Marble Dome', siteAr: 'القبة الرخامية',
    token: 'lotus', tokenName: 'Lotus', tokenNameAr: 'لوتس',
    sky: ['#1E1240', '#5B3A82', '#C2708F', '#F6C6A8'],
    stone: '#F2ECE3', stoneDark: '#B9AC9A', accent: '#5BC8E8', deep: '#130B26',
    fact: 'The marble is inlaid with thousands of pieces of cut stone, fitted so tightly that the seams cannot be felt with a fingertip.',
    factAr: 'الرخام مطعّم بآلاف القطع الحجرية، مركّبة جنب بعض لدرجة إنك مش حاسس بالوصلة بصباعك.',
    custom: 'Shoes come off before you step onto the marble, and hands come together at the chest to greet — one gesture that works for hello, thank you and goodbye.',
    customAr: 'الجزمة بتتشال قبل ما تدوس على الرخام، والإيدين بتتجمع على الصدر للتحية — حركة واحدة تنفع سلام وشكر ووداع.',
  },
  {
    id: 'kyoto',
    flag: '🇯🇵', country: 'Japan', countryAr: 'اليابان',
    city: 'Kyoto', cityAr: 'كيوتو',
    site: 'The Pagoda', siteAr: 'الباجودا',
    token: 'crane', tokenName: 'Paper crane', tokenNameAr: 'طائر ورقي',
    sky: ['#12173A', '#42356E', '#8E5A85', '#F0B8C8'],
    stone: '#8E4B3C', stoneDark: '#5A2E24', accent: '#F49FB6', deep: '#0B0F26',
    fact: 'A five-storey pagoda has a free-hanging central pillar. The floors sway against each other instead of with each other, which is why they survive earthquakes.',
    factAr: 'الباجودا ذات الخمس طوابق فيها عمود مركزي معلق. الأدوار بتتمايل عكس بعض مش مع بعض — عشان كده بتقاوم الزلازل.',
    custom: 'Shoes are left at the door pointing back the way you came, so leaving is easy for the next person too. Small courtesies here are always about the person after you.',
    customAr: 'الجزمة بتتساب على الباب ووشها لبرّه، عشان اللي بعدك يخرج بسهولة. كل الذوق هنا مبني على اللي جاي وراك.',
  },
];

export const placeAt = (i) => PLACES[((i % PLACES.length) + PLACES.length) % PLACES.length];

/* Games speak whichever language the player picked for games. Kept here
   so both games read the same flag and never disagree. */
export const gamesAr = () => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('mm_games_ar') === '1'; } catch (e) { return false; }
};

/* Small deterministic RNG — the same seed builds the same level on every
   device, which is what makes a shared leaderboard mean anything. */
export function rng(seed) {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* Rounded rectangle — every drawing file needs it, none of them should
   own it. */
export function rr(c, x, y, w, h, r) {
  const k = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
}

/* The four-stop sky every chapter shares, painted top to bottom. */
export function paintSky(c, W, H, colours) {
  const g = c.createLinearGradient(0, 0, 0, H);
  colours.forEach((col, i) => g.addColorStop(i / (colours.length - 1), col));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}
