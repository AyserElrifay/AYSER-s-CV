/* ─── لمّة · WHICH LANGUAGE THE QUESTIONS ARE IN ─────────────────────
   Not the same choice as the app's language, and that is the point.

   Somebody who keeps Moments in Arabic may want the questions in
   English because that is what the rest of the room is reading. A
   Romanian visiting Cairo may want the opposite. One room, six
   languages, everybody reading the same question at the same time in
   whichever one they think fastest in.

   ONLY LANGUAGES THE QUESTIONS ARE ACTUALLY WRITTEN IN APPEAR HERE.
   The app speaks thirteen; the packs are written in five. Offering
   German and then showing English is a lie the player finds out about
   halfway through a countdown, so it is not offered.

   MOLDOVA. Moldova's official language is Romanian — the same words,
   not a dialect of them. A separate button would show identical text
   twice and pretend otherwise, so one option carries both flags and
   means it.                                                          */

export const PLAY_LANGS = [
  { code: 'ar', native: 'العربية',  flag: '🇪🇬' },
  { code: 'en', native: 'English',  flag: '🇬🇧' },
  { code: 'fr', native: 'Français', flag: '🇫🇷' },
  { code: 'es', native: 'Español',  flag: '🇪🇸' },
  { code: 'ro', native: 'Română',   flag: '🇷🇴🇲🇩' },
];

const CODES = PLAY_LANGS.map((l) => l.code);

/* The app's language if the questions exist in it, English otherwise.
   Never a blank screen, never a language nobody asked for. */
export const playLangFor = (appLang) => (CODES.indexOf(appLang) >= 0 ? appLang : 'en');

/* The flags of the languages a pack says it is written in, in the
   order they are offered. A pack that claims nothing gets nothing —
   silence is honest, and a guessed flag is a promise the questions
   cannot keep. */
export const packFlags = (pack) => {
  const claimed = pack && Array.isArray(pack.languages) ? pack.languages : [];
  return PLAY_LANGS.filter((l) => claimed.indexOf(l.code) >= 0).map((l) => l.flag);
};

/* ─── THE TEXT, IN THE LANGUAGE THE PLAYER CHOSE ─────────────────────
   text_ar and text_en are columns because they came first. Everything
   since lives in text_i18n — on the question, and inside each option.
   One rule reads both.

   Falls back rather than blanking: your language → English → Arabic. A
   pack written in one language still plays. And nothing here is
   machine-translated at runtime — a quiz answer that drifts a shade in
   meaning is a second right answer, so a missing translation shows the
   language it was really written in.                                 */
export const say = (row, lang) => {
  if (!row) return '';
  const i18n = row.text_i18n;
  const mine = (i18n && typeof i18n === 'object' ? i18n[lang] : null) || row['text_' + lang];
  return mine || row.text_en || row.text_ar || '';
};
