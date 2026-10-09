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

/* ── PUSH ── a notification from supabase/functions/push. The payload
   carries only the kind, a first name and (for a plan) its title; the
   sentence is written here, in the reader's language, from the same
   language file the app uses — kept in the cache above. */
const PUSH_EN = {
  push_message: '{name} sent you a message',
  push_call: '{name} is calling you',
  push_mate_request: '{name} wants to be mates',
  push_mate_accept: '{name} is now your mate',
  push_comment: '{name} commented on your moment',
  push_tag: '{name} tagged you in a moment',
  push_green_invite: '{name} invites you: {title}',
  push_bardi_match: '{n} people near you are into {what} right now',
  push_plan_soon: '{title} starts in an hour',
  push_food_order: 'A new order in your kitchen',
  push_food_status: 'Your order was updated',
};

async function pushStrings(lang) {
  if (!lang || lang === 'en' || !HAS_CACHES) return PUSH_EN;
  try {
    const url = new URL('i18n/' + lang + '.json', self.registration.scope).href;
    let res = await caches.match(url);
    if (!res) res = await fetch(url);
    const all = await res.json();
    return Object.assign({}, PUSH_EN, all);
  } catch (e) { return PUSH_EN; }
}

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  e.waitUntil((async () => {
    const S = await pushStrings(d.lang);
    const parts = String(d.body || '').split('|');
    const line = String(S['push_' + d.kind] || 'Moments')
      .replace('{name}', d.actor || '')
      .replace('{title}', d.title || '')
      .replace('{n}', parts[0] || '')
      .replace('{what}', parts[1] || '');
    const base = self.registration.scope;
    await self.registration.showNotification('Moments', {
      body: line.trim(),
      icon: base + 'icon-192.png',
      badge: base + 'favicon-32.png',
      tag: d.id || d.kind || 'moments',
      data: { url: base + (d.kind === 'plan_soon' || d.kind === 'green_invite' ? '?tab=TOGETHER' : '?notifications=1') },
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        try { w.postMessage({ type: 'open', url }); } catch (err) {}
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
