import { Platform } from 'react-native';

/* ─── MOMENTS BLACK ON THE PAGE ───────────────────────────────────────
   Ayser: Moments Black members see the app in pure black and white.
   The palette is BLACK in blackCss.js; this is what a palette cannot reach:
   a button painted with C.purple is now white (#FFFFFE), and the many
   screens that write its label in '#FFF' would be white on white — so
   every label inside one turns black. The few colours written straight
   into a screen (the old violet, its deeper shades, the yellow spark,
   the violet gradients) turn white, or black with a hairline. Kept on
   this phone too, so a Black member never sees the colours first.
   (`:not(#mm-z)` only lifts a rule above the ones before it: no element
   has that id.) */

const KEY = 'mm.black';
/* the palette itself is kept, so the next open paints Black from the
   first frame without waiting for blackCss.js */
export const blackStored = () => {
  try { const v = Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; }
};
export const keepBlack = (pal) => {
  try { if (pal) window.localStorage.setItem(KEY, JSON.stringify(pal)); else window.localStorage.removeItem(KEY); } catch (e) {}
};
export const loadBlack = (variant) => import('./blackCss').then((m) => (variant === 'white' ? m.WHITE : m.BLACK));

/* the stylesheet itself (blackCss.js) comes in its own small file, fetched
   only when somebody is Black: the first download stays the size it was */
export const blackCss = (on) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!on) { const el = document.getElementById('mm-black'); if (el) el.remove(); return; }
  import('./blackCss').then((m) => m.paintBlack(on === 'white' ? 'white' : 'black')).catch(() => {});
};
