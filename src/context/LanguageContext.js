import React, { createContext, useContext, useState, useEffect } from 'react';
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

  return (
    <Ctx.Provider value={{ lang, setLang, t, rtl: !!meta.rtl, meta, langs: LANGS }}>
      {children}
    </Ctx.Provider>
  );
};
