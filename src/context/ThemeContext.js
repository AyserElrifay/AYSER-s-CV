import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, applyThemeMode } from '../constants/theme';

/* Real dark mode. `C` is one shared, mutable object every screen reads
   straight from at render time (see theme.js) — so switching here just
   mutates C's properties in place, then bumps `gen` to force one full
   remount of the app tree (App.js keys the root on `gen`). That remount
   is what guarantees every already-mounted screen re-reads the new
   colors, since nothing in this app caches styles via StyleSheet.create
   or React.memo.

   ── Three settings, two of them the same thing ──
   The preference is 'auto', 'light' or 'dark'. Only the last two are a
   decision; 'auto' means "whatever the phone is doing", and it's the
   right default because the phone already knows — most people set dark
   at sunset once, system-wide, and then expect every app to follow. An
   app that ignores that is the odd one out at midnight.

   'auto' is live, not read-once: if the phone flips at sunset while
   Moments is open, the app flips with it. */

const Ctx = createContext(null);
export const useTheme = () => useContext(Ctx) || fallback;
const fallback = { mode: 'light', pref: 'auto', isDark: false, gen: 0, toggleTheme: () => {}, setThemePref: () => {} };

const KEY = 'moments.theme';

/* What the phone itself is set to, right now. Web has the media query;
   native has Appearance. Either can be unavailable — an older browser,
   a webview — and the honest answer there is light. */
function systemIsDark() {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return Appearance.getColorScheme() === 'dark';
  } catch (e) {
    return false;
  }
}

const resolve = (pref) => (pref === 'auto' ? (systemIsDark() ? 'dark' : 'light') : pref);

export const ThemeProvider = ({ children }) => {
  /* Resolved once, synchronously, before the first paint. Reading the
     stored preference is async, so a phone already in dark mode would
     otherwise flash a white app for as long as AsyncStorage takes. */
  const [pref, setPref] = useState('auto');
  const [mode, setMode] = useState(() => {
    const m = resolve('auto');
    if (m === 'dark') applyThemeMode('dark');
    return m;
  });
  const [gen, setGen] = useState(0);

  const applyPref = (nextPref, persist) => {
    const next = resolve(nextPref);
    setPref(nextPref);
    if (next !== mode) {
      applyThemeMode(next);
      setMode(next);
      setGen((g) => g + 1);
    }
    if (persist) AsyncStorage.setItem(KEY, nextPref).catch(() => {});
  };

  // the stored choice, if they ever made one
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'dark' || v === 'light' || v === 'auto') applyPref(v, false);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* On 'auto', follow the phone as it changes — not only at launch. */
  useEffect(() => {
    if (pref !== 'auto') return undefined;
    const onChange = () => applyPref('auto', false);
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return undefined;
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) { mq.addEventListener('change', onChange); return () => mq.removeEventListener('change', onChange); }
      if (mq.addListener) { mq.addListener(onChange); return () => mq.removeListener(onChange); }
      return undefined;
    }
    const sub = Appearance.addChangeListener(onChange);
    return () => sub && sub.remove && sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pref, mode]);

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

  /* Kept for anything still calling it: a toggle is a deliberate
     choice, so it stops following the phone and lands on the opposite
     of what's on screen. */
  const toggleTheme = () => applyPref(mode === 'dark' ? 'light' : 'dark', true);
  const setThemePref = (p) => applyPref(p === 'auto' || p === 'dark' ? p : 'light', true);

  return (
    <Ctx.Provider value={{ mode, pref, isDark: mode === 'dark', gen, toggleTheme, setThemePref }}>
      {children}
    </Ctx.Provider>
  );
};
