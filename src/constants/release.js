/* WHAT'S NEW — one page, shown once.

   When we ship something worth knowing about, add it here and bump the
   id. Everyone sees the page on their next open, once, and never again
   until the id changes. Old entries stay below as the changelog.

   Rules that keep it from becoming spam:
     • bump the id only for things a person would actually notice
     • say what they can now DO, not what we changed
     • four items at most — anything longer gets skipped, not read */

export const RELEASE = {
  id: '2026-08-01',
  title: { en: 'Now you can…', ar: 'دلوقتي تقدر…' },
  items: [
    {
      emoji: '🔁',
      en: { t: 'Repost so people see it', s: 'A repost now carries the moment back out under your name — into feeds and onto your profile — and tells whoever made it.' },
      ar: { t: 'الريبوست بقى ليه لازمة', s: 'لما تعمل ريبوست، اللحظة بتخرج تاني باسمك — في الفيد وعلى بروفايلك — وصاحبها بيعرف.' },
    },
    {
      emoji: '🏷️',
      en: { t: 'Tag whoever was there', s: 'Put people in your moment. They get told, their names sit on the card, and they can take themselves out any time.' },
      ar: { t: 'اعمل تاج للي كانوا معاك', s: 'حط الناس في لحظتك. هيوصلهم إشعار، وأساميهم تبان على البوست، ويقدروا يشيلوا نفسهم في أي وقت.' },
    },
    {
      emoji: '💥',
      en: { t: 'Stickers and an arcade camera', s: 'A whole comic pack — half of it in Arabic — and an Arcade filter that turns your shot into a fighting game.' },
      ar: { t: 'استيكرز وكاميرا أركيد', s: 'باكدج كوميكس كاملة — نصها عربي — وفلتر أركيد بيحوّل صورتك للعبة قتال.' },
    },
    {
      emoji: '⛷️',
      en: { t: 'Keep your best stories, and ski', s: 'Highlights hold on to stories past their day. And Rooftop Rush has a downhill chapter with slalom gates.' },
      ar: { t: 'احتفظ بأحسن ستوريهاتك، واتزلج', s: 'الهايلايتس بتحافظ على الستوري بعد ما تنتهي. وفي فصل تزلج جديد في Rooftop Rush.' },
    },
  ],
};
