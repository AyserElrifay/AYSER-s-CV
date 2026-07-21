import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, applyThemeMode } from '../constants/theme';

/* Real dark mode. `C` is one shared, mutable object every screen reads
   straight from at render time (see theme.js) — so toggling here just
   mutates C's properties in place, then bumps `gen` to force one full
   remount of the app tree (App.js keys the root on `gen`). That remount
   is what guarantees every already-mounted screen re-reads the new
   colors, since nothing in this app caches styles via StyleSheet.create
   or React.memo. */

const Ctx = createContext(null);
export const useTheme = () => useContext(Ctx) || fallback;
const fallback = { mode: 'light', isDark: false, gen: 0, toggleTheme: () => {} };

const KEY = 'moments.theme';

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState('light');
  const [gen, setGen] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'dark') {
        applyThemeMode('dark');
        setMode('dark');
        setGen((g) => g + 1);
      }
    }).catch(() => {});
  }, []);

  // Paint the browser chrome (address bar / PWA splash) to match, and
  // avoid a white flash behind the app on load.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = C.bg;
    if (document.body) document.body.style.backgroundColor = C.bg;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = C.bg2;
  }, [mode]);

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    applyThemeMode(next);
    setMode(next);
    setGen((g) => g + 1);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };

  return (
    <Ctx.Provider value={{ mode, isDark: mode === 'dark', gen, toggleTheme }}>
      {children}
    </Ctx.Provider>
  );
};
