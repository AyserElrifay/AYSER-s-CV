import { Platform } from 'react-native';

/* ─── THE APP ICON YOU PICKED ─────────────────────────────────────────
   Ayser: "لو مشتركين premium … تغيّر شكل الـ app icon لو فضلت دايس على
   علامة moments كتير". Hold the Moments logo on Home and pick one.

   Every icon is our own mark — the m and its gold spark — in a different
   coat; nothing borrowed. The files are made once and live in
   public/icons/, with a manifest for each.

   What a web app can honestly do: the page points the phone at the
   picked icon (here, and before anything else in the <head> written by
   scripts/inject-html.mjs, so it is right from the first moment). The
   tab icon changes at once; the home-screen icon is read by the phone
   when Moments is added to it — so somebody who added it already
   removes it and adds it again. The screen says exactly that. */

export const ICONS = [
  { id: 'classic', file: '/icon-192.png', apple: '/apple-touch-icon.png', manifest: '/manifest.json' },
  ...['night', 'nile', 'sunset', 'papyrus', 'paper'].map((id) => ({
    id, file: '/icons/' + id + '-192.png', apple: '/icons/' + id + '-180.png', manifest: '/icons/manifest-' + id + '.json',
  })),
];

const KEY = 'mm.icon';

export function currentIcon() {
  try { const k = localStorage.getItem(KEY); return ICONS.some((i) => i.id === k) ? k : 'classic'; } catch (e) { return 'classic'; }
}

export function setAppIcon(id) {
  const ic = ICONS.find((i) => i.id === id) || ICONS[0];
  try { if (ic.id === 'classic') localStorage.removeItem(KEY); else localStorage.setItem(KEY, ic.id); } catch (e) {}
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  try {
    const m = document.querySelector('link[rel=manifest]'); if (m) m.href = ic.manifest;
    const a = document.querySelector('link[rel=apple-touch-icon]'); if (a) a.href = ic.apple;
    document.querySelectorAll('link[rel=icon]').forEach((l) => { l.href = ic.id === 'classic' && l.sizes && String(l.sizes) === '32x32' ? '/favicon-32.png' : ic.file; });
  } catch (e) {}
}

/* is Moments running from the home screen right now? */
export const installed = () => {
  try { return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; } catch (e) { return false; }
};
