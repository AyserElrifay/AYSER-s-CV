/* Moments service worker — installable & fast, but never stale, and
   never breaks the page.

   Ayser: "بيحمل صفحة قديمة قبل ما عدلها". The page itself was asked
   for "network first", but that fetch went through the browser's own
   cache, and GitHub Pages lets a browser keep index.html for ten
   minutes — so for ten minutes after a deploy the "fresh" page was the
   old one, pointing at the old code. Now:

     · the page and the language files are always checked with the
       server (cache: 'no-cache' — a tiny "has it changed?" request,
       answered 304 when it has not), so a new version shows on the
       very next open, with no reload and no blink;
     · the app's code files have their contents' hash in their names,
       so a name never changes meaning: they come straight from this
       phone, with no network at all, which is what makes opening fast.

   Every cache use is guarded, because some browsers
   (Safari Private Browsing, in-app webviews) expose no CacheStorage —
   there `caches` is undefined, and touching it would throw inside
   respondWith and make the page fail to open. */

const CACHE = 'moments-v96';
// CacheStorage isn't available everywhere (Safari private mode, some
// in-app browsers). Detect once; when absent we simply never cache.
const HAS_CACHES = (typeof caches !== 'undefined');
/* Safari on iPhone plays a video handed over by a service worker badly (a
   black box on the Together hero, November 2026): there it goes straight
   to the network, the phone's own media cache does the rest */
const SAFARI = (() => { try { const u = self.navigator.userAgent || ''; return /Safari/.test(u) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/.test(u); } catch (e) { return false; } })();

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  if (!HAS_CACHES) { self.clients.claim(); return; }
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE && k !== FACE_CACHE && k !== MEDIA_CACHE && k !== VIDEO_CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k)));
    } catch (err) { /* ignore */ }
    await self.clients.claim();
    await precache();
  })());
});

/* ── OFFLINE FIRST ── keep the whole app, not just what was visited.
   precache.json is written at build time (scripts/inject-html.mjs).
   Code from an older version is let go once the new list is kept, so
   the cache holds one version and does not grow forever. */
let lastPrecache = 0;
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
    /* past the browser's cache, to the server: "is this still it?" */
    /* a page load cannot be re-sent with options (the browser throws on
       a navigate-mode Request with an init), so it is asked for by URL */
    const fresh = request.mode === 'navigate'
      ? await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
      : await fetch(request, { cache: 'no-cache' });
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

/* the face model outlives releases: it only changes when its file names do */
const FACE_CACHE = 'moments-face-0.10.21';
async function cacheFirst(request, name) {
  if (HAS_CACHES) {
    try { const cached = await caches.match(request); if (cached) return cached; } catch (e) {}
  }
  const fresh = await fetch(request);
  if (HAS_CACHES && fresh && fresh.ok) {
    try { const c = await caches.open(name || CACHE); c.put(request, fresh.clone()); } catch (e) {}
  }
  return fresh;
}

/* ── PHOTOS FROM SUPABASE, KEPT ON THE PHONE ─────────────────────────
   Ayser, November 2026: Supabase's cached egress passed 5.5 GB. Every
   photo in Storage lives under a name that never changes (src/lib/
   storage.js), but the ones uploaded before that fix say "keep for one
   hour", so every open of Home, Together and Space asked for them again.
   Here a photo from Storage is kept on the phone and answered from it —
   old uploads included. Asked for in cors mode (Storage allows it for
   public files) so the real bytes are kept, not an opaque placeholder.
   Only pictures: a video is fetched in ranges and stays with the browser.
   At most MEDIA_MAX photos; the oldest go first. Releases do not empty it. */
const MEDIA_CACHE = 'moments-media-vault-v1';
const VIDEO_CACHE = 'moments-video-vault-v1';
const STATIC_CACHE = 'moments-static-cache-v1';
const MEDIA_MAX = 400;
/* Cloudflare R2 (the media bucket's public address, written in at build
   by scripts/inject-html.mjs from EXPO_PUBLIC_R2_PUBLIC_URL; any r2.dev
   address too): what is there never changes under the same name, so it
   is kept on the phone exactly like Supabase's */
const R2_ORIGIN = '__R2_ORIGIN__';
const isR2 = (url) => /\.r2\.dev$/.test(url.hostname) || (R2_ORIGIN.indexOf('http') === 0 && url.origin === R2_ORIGIN);
const isStoragePhoto = (url, req) => ((/\.supabase\.co$/.test(url.hostname)
  && /^\/storage\/v1\/(object|render\/image)\/public\//.test(url.pathname)) || isR2(url))
  && (req.destination === 'image' || /\.(jpe?g|png|webp|avif)$/i.test(url.pathname));
async function photoFromPhone(request) {
  const key = request.url;
  if (HAS_CACHES) {
    try { const c = await caches.open(MEDIA_CACHE); const hit = await c.match(key); if (hit) return hit; } catch (e) {}
  }
  let fresh;
  try { fresh = await fetch(key, { mode: 'cors', credentials: 'omit' }); }
  catch (e) { return fetch(request); }                       // no cors here: let the browser ask as it would have
  if (HAS_CACHES && fresh && fresh.ok) {
    const copy = fresh.clone();
    (async () => {
      try {
        const c = await caches.open(MEDIA_CACHE);
        await c.put(key, copy);
        const keys = await c.keys();
        for (let i = 0; i < keys.length - MEDIA_MAX; i++) await c.delete(keys[i]);
      } catch (e) {}
    })();
  }
  return fresh;
}

/* ── VIDEOS, KEPT ON THE PHONE TOO ────────────────────────────────────
   Ayser, November 2026 (local-first, WhatsApp-style): the Home hero clips
   and the videos in Storage are downloaded whole the first time, kept, and
   from then on played from the phone — a video asks for its bytes in
   pieces ("Range"), and the pieces are cut here from the kept copy. Only
   files up to VIDEO_BYTES, at most VIDEO_MAX of them, oldest out first. */
const VIDEO_MAX = 12;
const VIDEO_BYTES = 30 * 1024 * 1024;
const isVaultVideo = (url, req) => (req.destination === 'video' || /\.(mp4|webm|mov|m4v)$/i.test(url.pathname))
  && ((/\.supabase\.co$/.test(url.hostname) && /^\/storage\/v1\/object\/public\//.test(url.pathname)) || isR2(url)
    || (url.origin === self.location.origin && /\/media\/[^/]+\.(mp4|webm)$/i.test(url.pathname)));
const pieceOf = async (whole, range) => {
  const buf = await whole.arrayBuffer();
  const total = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range || '');
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : total - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, total - parseInt(m[2], 10)); end = total - 1; }   // "bytes=-500"
  end = Math.min(end, total - 1);
  if (start > end || start >= total) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': whole.headers.get('Content-Type') || 'video/mp4', 'Content-Length': String(end - start + 1),
    'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 'Accept-Ranges': 'bytes' } });
};
const keeping = new Set();
const keepVideo = async (c, key, same) => {
  if (keeping.has(key)) return;
  keeping.add(key);
  try {
    const whole = await fetch(key, same ? {} : { mode: 'cors', credentials: 'omit' });
    const size = parseInt(whole.headers.get('Content-Length') || '0', 10);
    if (whole.ok && whole.status === 200 && !(size && size > VIDEO_BYTES)) {
      await c.put(key, whole);
      const keys = await c.keys();
      for (let i = 0; i < keys.length - VIDEO_MAX; i++) await c.delete(keys[i]);
    }
  } catch (e) { /* kept next time */ }
  keeping.delete(key);
};
async function videoFromPhone(request, event) {
  const key = request.url.split('#')[0];
  const range = request.headers.get('range');
  if (!HAS_CACHES) return fetch(request);
  try {
    const c = await caches.open(VIDEO_CACHE);
    const hit = await c.match(key);
    if (hit) return range ? pieceOf(hit, range) : hit;
    const same = new URL(key).origin === self.location.origin;
    /* our own clips (the Home hero): play straight from the network now —
       waiting for the whole file first is what made the hero hang — and
       keep the whole file in the background for next time */
    if (same) {
      const p = keepVideo(c, key, same);
      if (event && event.waitUntil) event.waitUntil(p);
      return fetch(request);
    }
    // Storage videos: the whole file once (no Range), so it can be kept and cut — one download, not two
    const whole = await fetch(key, same ? {} : { mode: 'cors', credentials: 'omit' });
    const size = parseInt(whole.headers.get('Content-Length') || '0', 10);
    if (!whole.ok || whole.status !== 200) return whole;
    if (!(size && size > VIDEO_BYTES)) {                     // too big to keep: played this once, not kept
      await c.put(key, whole.clone());
      const keys = await c.keys();
      for (let i = 0; i < keys.length - VIDEO_MAX; i++) await c.delete(keys[i]);
    }
    return range ? pieceOf(whole, range) : whole;
  } catch (e) {
    return fetch(request);
  }
}

self.addEventListener('fetch', (e) => {
  let url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  if (e.request.method === 'GET' && isStoragePhoto(url, e.request)) {
    e.respondWith(photoFromPhone(e.request));
    return;
  }
  if (e.request.method === 'GET' && !SAFARI && isVaultVideo(url, e.request)) {
    e.respondWith(videoFromPhone(e.request, e));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // The app's code: its name carries a hash of its contents, so what is
  // kept here can never be out of date → straight from the phone.
  if (/\/_expo\/static\/.*-[0-9a-f]{16,}\.(js|css)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request));
    return;
  }
  // The face model and its runtime (src/lib/faceMesh.js): 13 MB fetched
  // once, the first time somebody picks a lens → kept on the phone.
  if (/\/mediapipe\//.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request, FACE_CACHE));
    return;
  }
  // The page, any other JS, and the language files → asked of the server
  // every time (fresh the moment a version ships), kept for offline.
  if (e.request.mode === 'navigate' || /\.js$/.test(url.pathname) || /\/_expo\//.test(url.pathname) || /\/i18n\/(challenges\/)?[a-z]+\.json$/.test(url.pathname)) {
    e.respondWith(networkFirst(e.request));
    /* a new page may mean a new version: keep its code for offline too
       (at most every ten minutes; precache only fetches what is missing) */
    if (e.request.mode === 'navigate' && Date.now() - lastPrecache > 600000) {
      lastPrecache = Date.now();
      e.waitUntil(precache());
    }
    return;
  }
  // The showcase stills under /media/ (hero posters, onboarding, map photos) → kept for good in
  // their own cache, which a new release does not empty (Ayser, November 2026: local-first)
  if (/\/media\/[^/]+\.(jpe?g|png|webp)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(e.request, STATIC_CACHE));
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
  push_creator_plan: '{name} started something new: {title}',
  push_booking: 'New booking on Moments',
  push_food_order: 'A new order in your kitchen',
  push_food_status: 'Your order was updated',
  push_venue_decision: 'News about your organisation on Moments',
  push_trip_open: 'A trip you wanted is open now',
  push_team_reply: 'The Moments team answered you',
  push_daily_line: '{title}',
  push_partner_watch: '{n} partner places need a look',
  push_trip_invite: 'Your invitation is ready 🎟',
  push_level_up: 'Your next level is open 🧭',
  push_event_update: 'Where to meet is updated 📌',
  push_buddy: '{name} is your Moments Buddy now 🤝',
  push_buddy_ping: '{name} invites you to their table: {title}',
  push_circle_open: 'The English Circle is open — 30 minutes only.',
  push_drop_open: "This week's outing is open: {title}",
  push_drop_open_call: 'The call for {title} is open — come in and say hi',
  push_drop_open_after: 'How was {title}? Rate it and share your photos',
  push_drop_open_book: 'Book the place for 10 — {title}',
  bardi_focus: '{n} people near you are {what} right now — focus together?',
  bardi_focus_at: '{n} people near you are {what} right now — a session at {venue}?',
  bd_kind_studying: 'Studying',
  bd_kind_deep_work: 'Deep work',
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
    /* body doubling: "n|studying|venue" */
    const focus = d.kind === 'bardi_match' && (parts[1] === 'studying' || parts[1] === 'deep_work');
    if (focus) parts[1] = String(S['bd_kind_' + parts[1]] || parts[1]).toLowerCase();
    const drop = d.kind === 'drop_open' ? { id: String(d.drop || '').split('|')[0], tag: String(d.drop || '').split('|')[1] || '' } : null;   // drop: id|tag
    const key = focus ? (parts[2] ? 'bardi_focus_at' : 'bardi_focus') : drop && S['push_drop_open_' + drop.tag] ? 'push_drop_open_' + drop.tag : 'push_' + d.kind;
    const ring = !!(drop && drop.tag === 'call' && /^[0-9a-f-]{36}$/.test(drop.id));
    const line = String(S[key] || 'Moments')
      .replace('{venue}', parts[2] || '')
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
      // the same person writing again replaces their line — and buzzes again, like a messenger
      renotify: true,
      // the call before a Drop rings like a call: it stays until answered, and opens the room
      requireInteraction: ring, vibrate: ring ? [400, 200, 400, 200, 400] : undefined,
      data: { url: base + (ring ? '?room=' + drop.id : d.kind === 'circle_open' ? '' : d.kind === 'plan_soon' || d.kind === 'green_invite' || d.kind === 'creator_plan' ? '?tab=TOGETHER' : d.kind === 'message' || d.kind === 'call' ? '?tab=CHATS' : '?notifications=1') },
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
