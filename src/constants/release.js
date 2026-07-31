/* WHAT'S NEW — one page, shown once.

   When we ship something worth knowing about, add it here and bump the
   id. Everyone sees the page on their next open, once, and never again
   until the id changes. Old entries stay below as the changelog.

   Rules that keep it from becoming spam:
     • bump the id only for things a person would actually notice
     • say what they can now DO, not what we changed
     • four items at most — anything longer gets skipped, not read */

export const RELEASE = {
  id: '2026-07-31',
  title: { en: 'Now you can…', ar: 'دلوقتي تقدر…' },
  items: [
    {
      emoji: '🧭',
      en: { t: 'Find your people', s: 'Browse everyone by country and city, see friends of friends, who is nearby, and who shares your interests.' },
      ar: { t: 'تلاقي ناسك', s: 'اتصفّح الناس بالبلد والمدينة، وشوف صحاب صحابك، ومين قريب منك، ومين بيحب اللي بتحبه.' },
    },
    {
      emoji: '👤',
      en: { t: 'Open anyone from anywhere', s: 'Tap a face or a name in reels and their profile opens — the same one the feed and the map open.' },
      ar: { t: 'افتح أي حد من أي مكان', s: 'دوس على صورة أو اسم في الريلز والبروفايل يفتح — نفس البروفايل اللي بيفتح من الهوم والخريطة.' },
    },
    {
      emoji: '🎥',
      en: { t: 'Reels that actually record', s: 'Video on iPhone came out black. It records properly now, and a clip that looks wrong is caught before you post it.' },
      ar: { t: 'ريلز بتتسجّل بجد', s: 'الفيديو على الآيفون كان بيطلع أسود. دلوقتي بيتسجّل صح، وأي كليب غلط بيتمسك قبل ما تنزله.' },
    },
    {
      emoji: '🌱',
      en: { t: 'Bardi has its own home', s: 'Bardi runs on its own server now, so it answers straight away instead of queueing behind everyone else.' },
      ar: { t: 'بردي بقى ليه بيت', s: 'بردي بقى شغال على سيرفر خاص بيه، فبيرد على طول من غير ما يستنى في طابور.' },
    },
  ],
};
