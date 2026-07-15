/* Moments service worker — installable & fast, but never stale.
   Strategy: network-first for the app shell AND the app's own JS
   bundles (so a new deploy is picked up the moment you're online),
   cache-first only for truly immutable assets (icons, fonts, images).
   Falls back to the last good cached copy when offline. */

const CACHE = 'moments-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Let the page tell a waiting worker to take over immediately.
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

const networkFirst = async (request) => {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const c = await caches.open(CACHE);
      c.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    const c = await caches.open(CACHE);
    c.put(request, fresh.clone());
  }
  return fresh;
};

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // App shell + all JavaScript → always try the network first, so new
  // code ships the instant it's deployed (no more "no difference").
  if (e.request.mode === 'navigate' || /\.js$/.test(url.pathname) || /\/_expo\//.test(url.pathname)) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Immutable static assets (icons, fonts, images) → cache-first.
  if (/\/assets\/|\.png$|\.jpg$|\.ttf$|\.woff2?$|\.webp$|\.svg$/.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request));
  }
});
