import { Platform } from 'react-native';

/* ─── LIQUID GLASS · TRY IT FIRST ─────────────────────────────────────
   Ayser: "اشتغل على theme Liquid … وخلّيه مش إجبار، نجرّبه الأول".
   Off unless somebody turns it on in Settings → Appearance; kept on
   this phone only while it is being tried.

   What it is: the cards become glass — translucent, blurring what is
   behind them, with a thin light edge — over a soft wash of colour.
   The colours themselves (theme.js) change only in `glass`, `glassHi`,
   `line` and `bg`; every screen already draws its cards with those, so
   nothing else needed touching. The blur is real (backdrop-filter): a
   card is recognised by its own glass colour, which only Liquid uses. */

const KEY = 'moments.liquid';
export const liquidStored = () => {
  try { return Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
};
export const keepLiquid = (on) => {
  try { if (on) window.localStorage.setItem(KEY, '1'); else window.localStorage.removeItem(KEY); } catch (e) {}
};

// the glass colours — unique to Liquid, so the CSS below can find them
export const LIQUID = {
  light: { glass: 'rgba(255, 255, 255, 0.56)', glassHi: 'rgba(255, 255, 255, 0.42)', line: 'rgba(255, 255, 255, 0.7)', bg: 'rgba(246, 245, 250, 0.62)' },
  dark: { glass: 'rgba(38, 38, 48, 0.5)', glassHi: 'rgba(64, 64, 78, 0.42)', line: 'rgba(255, 255, 255, 0.14)', bg: 'rgba(12, 12, 16, 0.66)' },
};

const WASH = {
  light: 'radial-gradient(at 12% 8%, #E7D9FF 0, transparent 46%), radial-gradient(at 88% 18%, #FFE2CF 0, transparent 42%), radial-gradient(at 30% 70%, #D9F1FF 0, transparent 44%), radial-gradient(at 85% 92%, #FBD9EC 0, transparent 40%), #F6F5FA',
  dark: 'radial-gradient(at 12% 8%, #2B1B4E 0, transparent 46%), radial-gradient(at 88% 18%, #3A1E2B 0, transparent 42%), radial-gradient(at 30% 70%, #0F2738 0, transparent 44%), radial-gradient(at 85% 92%, #2A1530 0, transparent 40%), #0C0C10',
};

export function liquidCss(on, dark) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  let el = document.getElementById('mm-liquid');
  if (!on) { if (el) el.remove(); return; }
  const L = LIQUID[dark ? 'dark' : 'light'];
  const edge = dark ? 'inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.35)' : 'inset 0 1px 0 rgba(255,255,255,0.75), 0 10px 30px rgba(40,20,80,0.08)';
  const css = `
html, body { background: ${WASH[dark ? 'dark' : 'light']} fixed !important; }
div[style*="background-color: ${L.glass}"], div[style*="background-color: ${L.glassHi}"] {
  -webkit-backdrop-filter: blur(22px) saturate(175%); backdrop-filter: blur(22px) saturate(175%); box-shadow: ${edge};
}
div[style*="background-color: ${L.bg}"] { -webkit-backdrop-filter: blur(34px) saturate(160%); backdrop-filter: blur(34px) saturate(160%); }`;
  if (!el) { el = document.createElement('style'); el.id = 'mm-liquid'; document.head.appendChild(el); }
  el.textContent = css;
}
