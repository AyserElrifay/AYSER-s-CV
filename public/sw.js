/* Moments service worker — installable & fast, but never stale, and
   never breaks the page. Strategy: network-first for the app shell AND
   the app's own JS (new deploys ship instantly), cache-first only for
   immutable assets. Every cache use is guarded, because some browsers
   (Safari Private Browsing, in-app webviews) expose no CacheStorage —
   there `caches` is undefined, and touching it would throw inside
   respondWith and make the page fail to open. */

const CACHE = 'moments-v5';
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
    await precache();
  })());
});

/* ── OFFLINE FIRST ── keep the whole app, not just what was visited.
   precache.json is written at build time (scripts/inject-html.mjs).
   Code from an older version is let go once the new list is kept, so
   the cache holds one version and does not grow forever. */
async function precache() {
  if (!HAS_CACHES) return;
  try {
    const res = await fetch('precache.json', { cache: 'no-store' });
    if (!res.ok) return;
    const list = await res.json();
    const c = await caches.open(CACHE);
    const want = new Set(list.map((p) => new URL(p, self.registration.scope).href));
    for (const url of want) {
      try { if (!(await c.match(url))) { const r = await fetch(url); if (r.ok) await c.put(url, r); } } catch (e) {}
    }
    for (const req of await c.keys()) {
      if (/\/_expo\/.*\.(js|css)$/.test(req.url) && !want.has(req.url)) await c.delete(req);
    }
  } catch (e) { /* offline at install, or no list: it fills as you go */ }
}

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
      /* a link with ?invite=… or #… is still the same app: offline, open
         the kept page rather than the browser's dinosaur */
      if (request.mode === 'navigate') {
        try { const shell = await caches.match(self.registration.scope); if (shell) return shell; } catch (e) {}
      }
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
  // the language files too, so the app opens offline in your language
  if (e.request.mode === 'navigate' || /\.js$/.test(url.pathname) || /\/_expo\//.test(url.pathname) || /\/i18n\/[a-z]+\.json$/.test(url.pathname)) {
    e.respondWith(networkFirst(e.request));
    return;
  }
  // Immutable static assets → cache-first (guarded).
  if (/\/assets\/|\.png$|\.jpg$|\.ttf$|\.woff2?$|\.webp$|\.svg$/.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request));
  }
});
