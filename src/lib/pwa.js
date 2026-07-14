import { Platform } from 'react-native';

/* PWA bootstrap (web only) — registers the service worker and makes
   sure the manifest/theme tags exist even if the HTML wasn't patched
   (the deploy workflow injects them statically for crawlers too). */

export function initPwa() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const base = window.location.pathname.replace(/[^/]*$/, ''); // e.g. /AYSER-s-CV/

    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = base + 'manifest.json';
      document.head.appendChild(link);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#7C3AED';
      document.head.appendChild(meta);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = base + 'apple-touch-icon.png';
      document.head.appendChild(apple);
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(base + 'sw.js', { scope: base }).catch(() => {});
      });
    }
  } catch (e) { /* never block the app on PWA extras */ }
}
