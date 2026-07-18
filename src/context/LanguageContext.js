import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STRINGS, LANGS } from '../constants/i18n';

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

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v && STRINGS[v]) setLangState(v); }).catch(() => {});
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
