/* ─── HOBBIES IN THE READER'S LANGUAGE ───────────────────────────────
   Ayser: "كل حاجة مضبوطة في العربي". A profile keeps its hobbies as the
   words they were picked in ("☕ Coffee", "walk"); this only changes how
   they read, never what is stored. A word we do not know is shown as is. */
const AR = {
  hiking: 'هايكنج', camping: 'تخييم', diving: 'غطس', photography: 'تصوير', filmmaking: 'صناعة أفلام',
  music: 'مزيكا', gaming: 'جيمز', football: 'كورة', padel: 'بادل', gym: 'جيم', yoga: 'يوجا',
  coffee: 'قهوة', cooking: 'طبخ', reading: 'قراية', travel: 'سفر', art: 'فن', surfing: 'سيرف',
  cycling: 'عجل', chess: 'شطرنج', volunteering: 'تطوع', walk: 'مشي', walking: 'مشي', running: 'جري',
  culture: 'ثقافة', languages: 'لغات', food: 'أكل', movies: 'أفلام', cinema: 'سينما', dance: 'رقص',
  study: 'مذاكرة', writing: 'كتابة', nature: 'طبيعة', beach: 'بحر', board_games: 'ألعاب ترابيزة',
};
/* "☕ Coffee" → "قهوة" in Arabic, "Coffee" elsewhere (the emoji goes either way) */
export function hobbyLabel(h, lang) {
  const word = String(h || '').replace(/^[^A-Za-z؀-ۿ]+/, '').trim();
  if (lang !== 'ar') return word;
  return AR[word.toLowerCase().replace(/\s+/g, '_')] || word;
}
