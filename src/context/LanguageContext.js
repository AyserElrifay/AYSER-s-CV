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
    if (STRINGS[code] && LANGS.some((l) => l.code === code)) return code;
  }
  return null;
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v && STRINGS[v]) { setLangState(v); return; }   // a real choice wins
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

  const t = (key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
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
