/* Moments service worker — installable & fast, but never stale, and
   never breaks the page. Strategy: network-first for the app shell AND
   the app's own JS (new deploys ship instantly), cache-first only for
   immutable assets. Every cache use is guarded, because some browsers
   (Safari Private Browsing, in-app webviews) expose no CacheStorage —
   there `caches` is undefined, and touching it would throw inside
   respondWith and make the page fail to open. */

const CACHE = 'moments-v4';
// CacheStorage isn't available everywhere (Safari private mode, some
// in-app browsers). Detect once; when absent we simply never cache.
const HAS_CACHES = (typeof caches !== 'undefined');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  if (!HAS_CACHES) { self.clients.claim(); return; }
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    } catch (err) { /* ignore */ }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (HAS_CACHES && fresh && fresh.ok) {
      try { const c = await caches.open(CACHE); c.put(request, fresh.clone()); } catch (e) {}
    }
    return fresh;
  } catch (err) {
    if (HAS_CACHES) {
      try { const cached = await caches.match(request); if (cached) return cached; } catch (e) {}
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  if (HAS_CACHES) {
    try { const cached = await caches.match(request); if (cached) return cached; } catch (e) {}
  }
  const fresh = await fetch(request);
  if (HAS_CACHES && fresh && fresh.ok) {
    try { const c = await caches.open(CACHE); c.put(request, fresh.clone()); } catch (e) {}
  }
  return fresh;
}

self.addEventListener('fetch', (e) => {
  let url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // App shell + all JS → network-first (fresh code the moment it ships).
  if (e.request.mode === 'navigate' || /\.js$/.test(url.pathname) || /\/_expo\//.test(url.pathname)) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  // Immutable static assets → cache-first (guarded).
  if (/\/assets\/|\.png$|\.jpg$|\.ttf$|\.woff2?$|\.webp$|\.svg$/.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request));
  }
});
