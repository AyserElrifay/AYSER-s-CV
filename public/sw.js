/* Moments service worker — makes the app installable and fast.
   Strategy: network-first for navigations (always fresh app),
   cache-first for hashed static assets (instant loads, offline shell). */

const CACHE = 'moments-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // the app shell: try the network, fall back to the last good copy
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request);
        const c = await caches.open(CACHE);
        c.put(e.request, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match(e.request);
        return cached || Response.error();
      }
    })());
    return;
  }

  // hashed bundles / assets / icons: cache-first (they never change in place)
  if (/\/_expo\/|\/assets\/|\.png$|\.ttf$|\.js$/.test(url.pathname)) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      const fresh = await fetch(e.request);
      if (fresh.ok) {
        const c = await caches.open(CACHE);
        c.put(e.request, fresh.clone());
      }
      return fresh;
    })());
  }
});
