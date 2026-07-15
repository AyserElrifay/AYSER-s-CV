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
      // When a new version is deployed, take it live automatically:
      // once the updated worker takes control, reload once so the fresh
      // code shows without the user having to clear anything.
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(base + 'sw.js', { scope: base }).then((reg) => {
          // check for a new deploy right away, and whenever the tab
          // regains focus (so returning to the app pulls the latest)
          const check = () => reg.update().catch(() => {});
          check();
          document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              // a new worker is ready and an old one controls the page →
              // tell it to activate; controllerchange above then reloads
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                nw.postMessage('skipWaiting');
              }
            });
          });
        }).catch(() => {});
      });
    }
  } catch (e) { /* never block the app on PWA extras */ }
}
