/* ─── WHAT A PLAN, OR A POST, IS ABOUT ───────────────────────────────
   One list of words per activity, in English and Arabic, shared by the
   plan covers (src/components/green/PlanPhoto.js) and the "join one"
   line under a post (src/components/PostLink.js). What you DO comes
   first (a sunset walk is a walk); where it happens — the beach, a
   church, a rooftop — only when nothing else matched. */
export const ACTIVITIES = [
  { id: 'animals', emoji: '🐾', re: /animal|shelter|rescue|strays?\b|\bpets?\b|\bdogs?\b|\bcats?\b|حيوان|قطط|قطة|كلاب|كلبك|ملجأ|ملجا|🐾|🐶|🐱/i },
  { id: 'cleanup', emoji: '🧹', re: /clean|litter|pick-?up|trash|garbage|تنضيف|تنظيف|نضافة|نظافة|زبال|🧹/i },
  { id: 'school', emoji: '🏫', re: /schools?\b|awareness|parents|مدرس|مدارس|توعي|مخدرات|أولياء الأمور|اولياء الامور|نشر ثقافة|نشر الثقافة|🏫/i },
  { id: 'kids', emoji: '👧', re: /orphan|\bkids\b|children|child care|أيتام|ايتام|اطفال|أطفال/i },
  { id: 'volunteer', emoji: '🤝', re: /volunteer|charity|donat|food bank|تطوع|متطوع|خيري|تبرع/i },
  { id: 'talk', emoji: '💬', re: /language|exchange|conversation|\bspeak|english|\bcircle\b|لغات|لغة|لغه|تبادل|محادث|دردش|كلام|💬/i },
  { id: 'opera', emoji: '🎭', re: /opera|ballet|theat(er|re)|symphony|orchestra|concert hall|\bstage\b|أوبرا|اوبرا|باليه|مسرح|سيمفوني|أوركستر|🎭|🩰/i },
  { id: 'music', emoji: '🎸', re: /music|\bjam\b|guitar|\bsing|karaoke|campfire|bonfire|\bcamp\b|مزيك|موسيق|غنا|جيتار|كاريوكي|كامب|🎸|🎶|🎤/i },
  { id: 'match', emoji: '📺', re: /\bmatch|watch party|ماتش|مباراة|نشجع|تشجيع|\bcheer|📺/i },
  { id: 'climb', emoji: '🧗', re: /climb|zip ?line|abseil|rappel|high ropes|mario|تسلق|زيب|ماريو|🧗/i },
  { id: 'padel', emoji: '🎾', re: /padel|(^|[^ت])بادل|tennis|تنس|🎾/i },
  { id: 'football', emoji: '⚽', re: /foot|soccer|pitch|five-a-side|كورة|كوره|ملعب|خماسي|⚽/i },
  { id: 'crochet', emoji: '🧶', re: /crochet|knit|yarn|كروشيه|كروشية|تريكو|🧶/i },
  { id: 'photo', emoji: '📷', re: /photo ?(walk|session|shoot)|portraits?|تصوير|فوتو ?سيشن|📷|📸/i },
  { id: 'sketch', emoji: '🎨', re: /sketch|draw|رسم(?!ي)|اسكتش|✏️|🎨|\bart\b/i },
  { id: 'walk', emoji: '🥾', re: /walk|hike|hiking|trail|stroll|مشي|تمشي|مشوار|🥾|🚶/i },
  { id: 'swim', emoji: '🏊', re: /swim|pool|سباح|حمام سباحة|🏊/i },
  { id: 'read', emoji: '📚', re: /\bread|\bbook|library|كتاب|قراء|مكتب[ةه]|📚|📖|\bfocus\b/i },
  { id: 'coffee', emoji: '☕', re: /coffee|caf[eé]|espresso|latte|قهو|كافيه|☕/i },
  { id: 'movie', emoji: '🍿', re: /movie|cinema|film|سينما|فيلم|افلام|أفلام|🍿|🎬/i },
  { id: 'beach', emoji: '🏖️', re: /beach|\bsea\b|seaside|شاطئ|بحر|🏖|🌊/i },
  { id: 'church', emoji: '⛪', re: /church|monastery|كنيس|⛪/i },
  { id: 'rooftop', emoji: '🌅', re: /rooftop|\broof\b|الروف|روف توب|سطوح/i },
];

export const RE_OF = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a.re]));

export const activityOf = (text) => {
  const s = String(text || '');
  return ACTIVITIES.find((a) => a.re.test(s)) || null;
};
