import React, { createContext, useContext } from 'react';

/* One design for everybody (theme.js, MONO): OLED black, white type,
   one inverted white action. There is no light/dark switch, no Liquid
   Glass and no separate Black look any more, so this only answers the
   questions screens still ask — "is it dark?" (yes: the map, the status
   bar and a few pictures choose their dark version) — and keeps the old
   setters as no-ops so nothing that calls them breaks. The page's own
   stylesheet (scripts/inject-html.mjs) paints the canvas black from the
   first frame. */

const VALUE = {
  mode: 'dark', pref: 'dark', isDark: true, gen: 0, liquid: false, black: true,
  toggleTheme: () => {}, setThemePref: () => {}, setLiquid: () => {}, setBlack: () => {},
};
const Ctx = createContext(VALUE);
export const useTheme = () => useContext(Ctx) || VALUE;
export const ThemeProvider = ({ children }) => <Ctx.Provider value={VALUE}>{children}</Ctx.Provider>;
