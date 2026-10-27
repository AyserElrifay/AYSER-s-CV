import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, applyThemeMode } from '../constants/theme';
import { subscribeAccountSettings, cachedAccountSettings, saveThemePref } from '../services/accountSettings';
import { liquidStored, keepLiquid, liquidCss } from '../lib/liquid';
import { blackStored, keepBlack, blackCss, loadBlack } from '../lib/black';

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
const fallback = { mode: 'light', pref: 'auto', isDark: false, gen: 0, liquid: false, black: false, toggleTheme: () => {}, setThemePref: () => {}, setLiquid: () => {}, setBlack: () => {} };

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

const storedNow = () => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      const v = window.localStorage.getItem(KEY);
      if (v === 'dark' || v === 'light' || v === 'auto') return v;
    }
  } catch (e) {}
  return 'auto';
};
const resolve = (pref) => (pref === 'auto' ? (systemIsDark() ? 'dark' : 'light') : pref);

export const ThemeProvider = ({ children }) => {
  /* Resolved once, synchronously, before the first paint. Reading the
     stored preference is async, so a phone already in dark mode would
     otherwise flash a white app for as long as AsyncStorage takes. */
  /* On the web the stored choice is in localStorage, readable right now —
     waiting for it used to paint the app in the phone's colours first and
     then rebuild it in the chosen ones (Ayser: "الصفحات بتلود مرتين، مرة
     بشكل قديم ومرة بشكل جديد"). */
  const [pref, setPref] = useState(storedNow);
  const [liquid, setLiquidState] = useState(liquidStored);
  // Moments Black members: pure black and white, whatever the mode (lib/black.js)
  const [black, setBlackState] = useState(() => !!blackStored());
  const blackNow = useRef(black);   // read by setBlack, which callers may hold from an older render
  const [mode, setMode] = useState(() => {
    const m = resolve(storedNow());
    const lq = liquidStored(), bl = blackStored();
    if (m === 'dark' || lq || bl) applyThemeMode(m, lq, bl);
    liquidCss(lq && !bl, m === 'dark');
    blackCss(!!bl);
    return m;
  });
  const [gen, setGen] = useState(0);

  const applyPref = (nextPref, persist) => {
    const next = resolve(nextPref);
    setPref(nextPref);
    if (next !== mode) {
      applyThemeMode(next, liquid, black && blackStored());
      liquidCss(liquid, next === 'dark');
      setMode(next);
      setGen((g) => g + 1);
    }
    if (persist) {
      AsyncStorage.setItem(KEY, nextPref).catch(() => {});
      // and onto the account, so it comes with you to another phone
      saveThemePref(nextPref);
    }
  };

  /* The stored choice, if they ever made one. This phone's copy first,
     because it answers immediately and a theme that arrives late is a
     flash of the wrong colour; then the account's, which wins, because
     that is the one that followed you here from another phone. */
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'dark' || v === 'light' || v === 'auto') applyPref(v, false);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onAccount = (s) => {
      if (s && (s.theme === 'dark' || s.theme === 'light' || s.theme === 'auto')) {
        applyPref(s.theme, false);
        // kept on this phone too, so the next open is already right
        AsyncStorage.setItem(KEY, s.theme).catch(() => {});
      }
    };
    const stop = subscribeAccountSettings(onAccount);
    onAccount(cachedAccountSettings());
    return stop;
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
    // the page's own CSS (hairlines in place of shadows) follows the mode too
    document.documentElement.classList.toggle('mm-dark', mode === 'dark' || black);
    document.documentElement.classList.toggle('mm-light', mode !== 'dark' && !black);
    if (document.body) document.body.style.backgroundColor = C.bg;
    // the browser's own bar is the page, not a purple band — every theme-color tag (light and dark) follows the app
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (!metas.length) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = C.bg;
      document.head.appendChild(meta);
    }
    metas.forEach((m) => { m.content = C.bg; });
  }, [mode, black]);

  /* Kept for anything still calling it: a toggle is a deliberate
     choice, so it stops following the phone and lands on the opposite
     of what's on screen. */
  const toggleTheme = () => applyPref(mode === 'dark' ? 'light' : 'dark', true);
  const setThemePref = (p) => applyPref(p === 'auto' || p === 'dark' ? p : 'light', true);
  /* Liquid Glass: tried on this phone, off by default (src/lib/liquid.js) */
  const setLiquid = (on) => {
    keepLiquid(!!on);
    setLiquidState(!!on);
    applyThemeMode(mode, !!on, black && blackStored());
    liquidCss(!!on && !black, mode === 'dark');
    setGen((g) => g + 1);
  };
  /* the membership says Moments Black (App.js, MemberGate) — or no longer does */
  const setBlack = (on) => {
    if (!!on === blackNow.current) return;
    blackNow.current = !!on;
    const paint = (pal) => {
      if (blackNow.current !== !!pal) return;          // changed again while the palette was on its way
      keepBlack(pal);
      setBlackState(!!pal);
      applyThemeMode(mode, liquid, pal);
      liquidCss(liquid && !pal, mode === 'dark');
      blackCss(!!pal);
      setGen((g) => g + 1);
    };
    if (on) loadBlack().then(paint).catch(() => { blackNow.current = false; });
    else paint(null);
  };

  return (
    <Ctx.Provider value={{ mode, pref, isDark: mode === 'dark' || black, gen, liquid, black, toggleTheme, setThemePref, setLiquid, setBlack }}>
      {children}
    </Ctx.Provider>
  );
};
