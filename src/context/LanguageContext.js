import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STRINGS, LANGS } from '../constants/i18n';
import { publishLang } from '../lib/plumbing';

/* Language state for the whole app. t(key) resolves the current
   language and falls back to English, then to the raw key — never a
   blank. The choice persists across launches. */

const Ctx = createContext(null);
export const useLang = () => useContext(Ctx) || fallback;

const fallback = {
  lang: 'en',
  rtl: false,
  langs: LANGS,
  setLang: () => {},
  t: (k) => (STRINGS.en[k] || k),
};

const KEY = 'moments.lang';

/* ─── THE FIRST SCREEN SHOULD ALREADY BE IN YOUR LANGUAGE ────────────
   Until now everybody's first visit was in English, whatever phone
   they opened it on, because the app only ever restored a choice
   somebody had already made — and the place to make it is inside, past
   the sign-up nobody has read yet.

   The phone already knows. It sends the languages its owner reads,
   in the order they prefer them, and an Egyptian phone says Arabic
   first. So the first run asks it.

   IT IS A GUESS, AND IT IS NOT SAVED. Only tapping a language saves
   anything. That keeps "I chose English on an Arabic phone" a real,
   surviving choice instead of something the next launch overrules. */
const deviceLang = () => {
  if (typeof navigator === 'undefined') return null;
  const list = (navigator.languages && navigator.languages.length)
    ? navigator.languages : [navigator.language];
  for (const tag of list) {
    // 'ar-EG' and 'ar' are both Arabic; 'pt-BR' is Portuguese.
    const code = String(tag || '').toLowerCase().split('-')[0];
    if (LANGS.some((l) => l.code === code)) return code;
  }
  return null;
};

/* ── THE OTHER TWELVE LANGUAGES ARRIVE OVER THE WIRE ─────────────────
   They used to be compiled in — 424 KB of the first download, thirteen
   languages sent so one could be read. They are files in public/i18n
   now, fetched the first time somebody needs them.

   Why fetch rather than a dynamic import: Expo's web export emits
   split chunks and never fetches them, failing with "Requiring unknown
   module". A plain HTTP request for a JSON file has no bundler in it
   and cannot fail that way.

   The cache is a plain object plus localStorage, so a returning phone
   pays nothing. Until a language lands, t() answers from English —
   which is what it already did for any missing key. */
const loaded = { en: STRINGS.en };
const CACHE_PREFIX = 'moments.i18n.';

/* Where public/ ends up once deployed. app.json sets baseUrl to
   /AYSER-s-CV, and reading it back off the document is what keeps this
   correct if that ever changes. */
const i18nUrl = (code) => {
  let base = '/';
  try {
    if (typeof document !== 'undefined' && document.baseURI) base = document.baseURI;
  } catch (e) { /* fall through to root */ }
  return String(base).replace(/[^/]*$/, '') + 'i18n/' + code + '.json';
};

async function loadLanguage(code) {
  if (loaded[code]) return loaded[code];
  try {
    const cached = await AsyncStorage.getItem(CACHE_PREFIX + code);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') { loaded[code] = parsed; return parsed; }
    }
  } catch (e) { /* a bad cache entry is not worth failing over */ }
  try {
    const res = await fetch(i18nUrl(code));
    if (!res.ok) return null;
    const dict = await res.json();
    if (!dict || typeof dict !== 'object') return null;
    loaded[code] = dict;
    AsyncStorage.setItem(CACHE_PREFIX + code, JSON.stringify(dict)).catch(() => {});
    return dict;
  } catch (e) {
    return null;   // English is already on screen; nothing breaks
  }
}

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState('en');
  /* Bumped when a language finishes arriving, purely so the tree
     re-renders with the new words. */
  const [, setReady] = useState(0);

  useEffect(() => {
    if (lang === 'en' || loaded[lang]) return;
    let alive = true;
    loadLanguage(lang).then(() => { if (alive) setReady((n) => n + 1); });
    return () => { alive = false; };
  }, [lang]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v && LANGS.some((l) => l.code === v)) { setLangState(v); return; }   // a real choice wins
      const guess = deviceLang();
      if (guess) setLangState(guess);
    }).catch(() => {
      const guess = deviceLang();
      if (guess) setLangState(guess);
    });
  }, []);

  const setLang = (l) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  };

  const t = (key) => (loaded[lang] && loaded[lang][key]) || STRINGS.en[key] || key;
  const meta = LANGS.find((l) => l.code === lang) || LANGS[0];

  // ── REAL RTL, not just swapped words ──
  // Setting the document's writing direction hands the mirroring to the
  // browser's own bidi engine: flex rows reverse, the tab bar flips
  // sides, message bubbles swap alignment — the whole layout, not just
  // the text — because `direction: rtl` genuinely changes which edge is
  // the flex "start" for every `flexDirection: 'row'` in the app.
  /* Sentences chosen outside React — in catch blocks and services —
     need the language too. See src/lib/plumbing.js */
  useEffect(() => { publishLang(lang); }, [lang]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const dir = meta.rtl ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    if (document.body) document.body.dir = dir;
  }, [lang, meta.rtl]);

  return (
    <Ctx.Provider value={{ lang, setLang, t, rtl: !!meta.rtl, meta, langs: LANGS }}>
      {children}
    </Ctx.Provider>
  );
};
