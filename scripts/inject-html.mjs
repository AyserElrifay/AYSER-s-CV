// Patches the exported dist/index.html with everything crawlers and
// installers need BEFORE any JS runs: PWA manifest link, theme color,
// apple-touch-icon, and Open Graph / Twitter cards so shared links
// unfurl with a real preview on WhatsApp, iMessage, X…
// Run after `expo export`: node scripts/inject-html.mjs dist
import fs from 'fs';
import path from 'path';

const dist = process.argv[2] || 'dist';
const file = path.join(process.cwd(), dist, 'index.html');
let html = fs.readFileSync(file, 'utf8');

const BASE = 'https://therealmoments.com/';
const TITLE = "Moments — Don't scroll it. Live it.";
const DESC = 'The social super-app: live world map, real mates, moments & reels, deals, and curated adventures.';

// Responsive framing so ONE build fits both screens:
//  • Phone  → the app fills the whole screen (dynamic viewport height so
//    the browser chrome never crops it → fixes the mobile aspect ratio).
//  • Laptop/desktop → the app is centred in a phone-shaped frame on a
//    soft backdrop instead of being stretched across a wide window.
const responsiveCss = `
  <style>
    html, body { margin: 0; height: 100%; background: #0b1020; }
    /* dynamic viewport height fixes the mobile URL-bar aspect crop */
    #root { width: 100%; height: 100vh; height: 100dvh; overflow: hidden; }
    /* Laptop / desktop → a wide app shell (left sidebar + content),
       inspired by the VK / Facebook desktop layout, centred on a soft
       backdrop instead of a stretched full-bleed page. */
    @media (min-width: 820px) {
      body { background: radial-gradient(1400px 900px at 50% -10%, #241b46 0%, #0b1020 60%); }
      #root {
        width: min(1180px, 96vw); height: 94vh; max-height: 900px;
        margin: max(0px, calc((100vh - 900px) / 2)) auto 0;
        border-radius: 20px; overflow: hidden;
        box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
      }
    }
  </style>
`;

/* ─── THE ONE LINE EXPO'S WEB EXPORT FORGETS ─────────────────────────
   Metro really does split the bundle. Ask for a piece of code with
   `await import('x')` and the export writes a separate file for it and
   records where it lives, right there in the main bundle:

     618, {"19":320, "paths":{"813":"/AYSER-s-CV/_expo/.../three-….js"}}

   And then nothing ever fetches it. Metro's async-require module reads
   a function called `__loadBundleAsync` off the global, and on web
   nobody defines it. Its own code says what happens next:

     const u = g[`${__METRO_GLOBAL_PREFIX__}__loadBundleAsync`];
     if (null != u) { … return u(path) }        ← never taken
     …
     return () => r.importAll(moduleId);        ← taken instead

   It falls through to a SYNCHRONOUS require of a module that is, by
   construction, in the other file. "Requiring unknown module 813".

   That is why splitting this app "did not work" and was reverted: the
   split was fine, the fetch was missing. Twelve lines, defined before
   the bundle runs, and the piece arrives when it is asked for. `__d`
   is already a global by then, so the chunk registers itself simply by
   being executed.

   __METRO_GLOBAL_PREFIX__ is '' in this build, checked in the output —
   so the name really is exactly `__loadBundleAsync`. */
const chunkLoader = `
  <script>
    (function () {
      var inflight = {};
      globalThis.__loadBundleAsync = function (path) {
        if (inflight[path]) return inflight[path];
        inflight[path] = new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = path;
          s.async = true;
          s.onload = function () { resolve(); };
          s.onerror = function () {
            // let a later attempt try again rather than caching a failure
            delete inflight[path];
            reject(new Error('Could not load ' + path));
          };
          document.head.appendChild(s);
        });
        return inflight[path];
      };
    })();
  </script>
`;

const tags = `
  ${chunkLoader}
  ${responsiveCss}
  <!-- Absolute, not relative. A relative href resolves against whatever
       URL the page happens to be on, so one visit without the trailing
       slash and the manifest 404s — at which point iOS has nothing to
       read and adds a plain bookmark instead of the app. -->
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#7C3AED" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <!-- the icon somebody picked (src/lib/appIcon.js), before the phone reads it -->
  <script>(function(){try{var IC=['night','nile','sunset','papyrus','paper'],qi=new URLSearchParams(location.search).get('icon');if(qi==='classic')localStorage.removeItem('mm.icon');else if(IC.indexOf(qi)>=0)localStorage.setItem('mm.icon',qi);var mi=localStorage.getItem('mm.icon');if(IC.indexOf(mi)>=0){var q=function(s){return document.querySelectorAll(s)};q('link[rel=manifest]')[0].href='/icons/manifest-'+mi+'.json';q('link[rel=apple-touch-icon]')[0].href='/icons/'+mi+'-180.png';q('link[rel=icon]').forEach(function(l){l.href='/icons/'+mi+'-192.png'})}}catch(e){}})()</script>
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Moments" />
  <meta name="description" content="${DESC}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Moments" />
  <meta property="og:title" content="${TITLE}" />
  <meta property="og:description" content="${DESC}" />
  <meta property="og:url" content="${BASE}" />
  <meta property="og:image" content="${BASE}og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${TITLE}" />
  <meta name="twitter:description" content="${DESC}" />
  <meta name="twitter:image" content="${BASE}og-image.png" />
`;

// Make the viewport cover the notch/safe-areas so the app fills the
// phone edge-to-edge (part of fixing the mobile aspect ratio).
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, shrink-to-fit=no" />'
);

if (!html.includes('og:title')) {
  html = html.replace('</head>', tags + '</head>');
}
if (!html.includes('__loadBundleAsync')) {
  // an index.html patched by an older version of this script still needs it
  html = html.replace('</head>', chunkLoader + '</head>');
}
if (html.includes('<title>')) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
} else {
  html = html.replace('</head>', `<title>${TITLE}</title></head>`);
}

/* ─── THE STAR THAT BECOMES A KITE ───────────────────────────────────
   Ayser: the Moments star turning into a kite the moment the app opens.
   The kite is Dahab — the first time his mind went quiet, out by the
   sea — and a star that lifts off and flies away says "go out" without
   a word.

   It is plain HTML and CSS in the page itself, so it plays while the
   app's code is still arriving and adds no wait of its own: about 1.4
   seconds, once per open (a tab switch never reloads the page). A tap
   ends it. With Reduce Motion switched on it is not drawn at all —
   motion people asked their phone to spare them is not ours to add. */
const kiteIntro = `
<div id="mm-kite" aria-hidden="true">
  <svg viewBox="-60 -60 120 120" width="132" height="132">
    <g class="mm-k-star"><path d="M0,-34 C4,-8 8,-4 34,0 C8,4 4,8 0,34 C-4,8 -8,4 -34,0 C-8,-4 -4,-8 0,-34Z" fill="#F5B301"/></g>
    <g class="mm-k-kite">
      <path d="M0,-38 L26,-4 L0,38 L-26,-4 Z" fill="#7C3AED"/>
      <path d="M0,-38 L26,-4 L0,-4 Z" fill="#A78BFA"/>
      <path d="M0,-4 L-26,-4 L0,38 Z" fill="#5B21B6"/>
      <path d="M0,-38 L0,38 M-26,-4 L26,-4" stroke="#F5B301" stroke-width="2"/>
      <path class="mm-k-tail" d="M0,38 C-10,48 10,56 0,66 C-10,76 8,84 -2,94" stroke="#F5B301" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M-5,50 L0,47 L5,50 L0,53Z M-5,72 L0,69 L5,72 L0,75Z" fill="#F5B301"/>
    </g>
  </svg>
</div>
<style>
  #mm-kite { position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center;
    background: #111111; animation: mmKiteBg 1.45s ease forwards; cursor: pointer; }
  #mm-kite svg { overflow: visible; }
  .mm-k-star { transform-origin: 0 0; animation: mmKiteStar 1.45s cubic-bezier(.4,0,.2,1) forwards; }
  .mm-k-kite { transform-origin: 0 0; opacity: 0; animation: mmKiteFly 1.45s cubic-bezier(.5,0,.3,1) forwards; }
  .mm-k-tail { animation: mmKiteTail 0.35s ease-in-out infinite alternate; transform-origin: 0 38px; }
  @keyframes mmKiteStar { 0% { transform: scale(0.4) rotate(-90deg); opacity: 0; } 25% { transform: scale(1) rotate(0); opacity: 1; }
    45% { transform: scale(1.1) rotate(45deg); opacity: 1; } 55% { transform: scale(0.6) rotate(45deg); opacity: 0; } 100% { opacity: 0; } }
  @keyframes mmKiteFly { 0%, 45% { opacity: 0; transform: scale(0.6) rotate(0); } 58% { opacity: 1; transform: scale(1) rotate(-8deg); }
    100% { opacity: 1; transform: translate(150px, -560px) scale(0.55) rotate(18deg); } }
  @keyframes mmKiteTail { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
  @keyframes mmKiteBg { 0%, 62% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
  @media (prefers-reduced-motion: reduce) { #mm-kite { display: none; } }
</style>
<script>
  (function () {
    var el = document.getElementById('mm-kite');
    if (!el) return;
    var done = function () { if (el && el.parentNode) el.parentNode.removeChild(el); el = null; };
    el.addEventListener('click', done);
    el.addEventListener('touchstart', done, { passive: true });
    setTimeout(done, 1500);
  })();
</script>
`;
/* ─── THE OLD ADDRESS ─────────────────────────────────────────────────
   The app moved from ayserelrifay.github.io/AYSER-s-CV to its own
   domain, and now lives at the root of therealmoments.com. A phone that
   still opens the old address (an old home-screen icon, an old link)
   gets a page whose pictures point nowhere. So the old address goes
   straight on to the new one, keeping whatever was after the "?" — a
   trip link, an invite — and before anything else loads. */
const moveHome = `<script>(function(){try{var h=location.hostname;if(/\\.github\\.io$/i.test(h)){location.replace('https://therealmoments.com/'+location.search+location.hash);}}catch(e){}})();</script>`;
html = html.replace(/<head([^>]*)>/, (m) => m + moveHome);
html = html.replace(/<body([^>]*)>/, (m) => m + kiteIntro);
fs.writeFileSync(file, html);
console.log('index.html patched: PWA + OG tags');

/* ── THE MAIN FILE'S NAME HAS TO CHANGE WHEN IT DOES ──
   Ayser opened the map after an update and got "Could not load
   MapScreen-7365….js". Expo names AppEntry by a hash taken BEFORE the
   names of the other pieces are written into it, so a new map piece
   gives AppEntry new contents under the very same name. A phone that
   kept the old AppEntry (the browser's ten minutes, or the offline
   copy, which trusts a hashed name never to change) then asks for a
   map piece that no longer exists, and reloading does not help: the
   page asks for "AppEntry-bb66…" again and gets the old one again.
   So it is renamed here by a hash of what it finally contains. */
{
  const web = path.join(process.cwd(), dist, '_expo', 'static', 'js', 'web');
  if (fs.existsSync(web)) {
    const crypto = await import('crypto');
    for (const name of fs.readdirSync(web)) {
      const m = /^AppEntry-[0-9a-f]+\.js$/.exec(name);
      if (!m) continue;
      const body = fs.readFileSync(path.join(web, name));
      const hash = crypto.createHash('md5').update(body).digest('hex');
      const next = 'AppEntry-' + hash + '.js';
      if (next === name) continue;
      fs.renameSync(path.join(web, name), path.join(web, next));
      const page = fs.readFileSync(file, 'utf8');
      if (!page.includes(name)) throw new Error('index.html does not load ' + name);
      fs.writeFileSync(file, page.split(name).join(next));
      console.log('main file named by its contents: ' + next);
    }
  }
}

/* ── OFFLINE: the list of the app's own code ──
   public/sw.js reads this once a new version is live and keeps every
   file in it, so the app opens on a phone with no signal — every tab,
   not only the ones visited while online. Fonts, icons and pictures
   are kept as they are used. */
{
  const root = path.join(process.cwd(), dist);
  const out = ['./'];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(js|css)$/.test(name)) out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  const js = path.join(root, '_expo');
  if (fs.existsSync(js)) walk(js);
  fs.writeFileSync(path.join(root, 'precache.json'), JSON.stringify(out));
  console.log('precache.json: ' + out.length + ' files');
}

/* ─── THE PLACES, SMALL ───────────────────────────────────────────────
   The composer suggests the places near you when a moment is from an
   outing. Importing the full list (descriptions and all) into the
   composer pulled ninety kilobytes into everybody's first download, so
   the build writes just what a suggestion needs — id, name, emoji and
   where — to places.json, fetched only when somebody posts. */
{
  const { pathToFileURL } = await import('url');
  const mod = await import(pathToFileURL(path.join(process.cwd(), 'src/constants/destinations.js')).href);
  const pts = (mod.DESTINATIONS || []).map((d) => (d.photo ? [d.id, d.name, d.emoji, d.lat, d.lng, d.photo, d.area || ''] : [d.id, d.name, d.emoji, d.lat, d.lng]));
  fs.writeFileSync(path.join(process.cwd(), dist, 'places.json'), JSON.stringify(pts));
  console.log('places.json: ' + pts.length + ' places');
  /* one place per country, for the line under a post from that country
     (src/components/PostLink.js): [country, flag, id, lat, lng] */
  const byCountry = {};
  (mod.DESTINATIONS || []).forEach((d) => {
    if (!d.country) return;
    if (!byCountry[d.country] || (d.hero && !byCountry[d.country].hero)) byCountry[d.country] = d;
  });
  const cs = Object.values(byCountry).map((d) => [d.country, d.flag || '', d.id, d.lat, d.lng]);
  fs.writeFileSync(path.join(process.cwd(), dist, 'countries.json'), JSON.stringify(cs));
  console.log('countries.json: ' + cs.length + ' countries');
}

/* ─── WHAT THIS PAGE WILL RUN, AND WHO MAY FRAME IT ──────────────────
   Ayser: "خلي الأبلكيشن آمن جدًا". The last step, after every other
   script above is in the page:

   · A Content Security Policy. Scripts run only from this site, from
     the two pinned map/globe libraries on unpkg (each also carries its
     own fingerprint, src/lib/leaflet.js), and the few small scripts
     written into this page — each allowed by its exact hash, worked out
     here. So text somebody manages to slip into the page (a caption, a
     name) can never become code. No plugins, no <base> tricks, forms
     only to here and to the payment page.
   · Never inside somebody else's frame: GitHub Pages cannot send the
     frame-ancestors header, so the page leaves any frame it is put in
     (clickjacking — a fake page over a real button).
   · Links to other sites carry only our address, not the page's. */
{
  const crypto = await import('crypto');
  let page = fs.readFileSync(file, 'utf8');
  page = page.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/g, '');
  const unframe = "<script>if(window.top!==window.self){try{window.top.location.replace(window.location.href)}catch(e){document.documentElement.style.display='none'}}</script>";
  if (!page.includes(unframe)) page = page.replace('<head>', '<head>' + unframe);
  const hashes = [];
  page.replace(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g, (m, body) => {
    hashes.push("'sha256-" + crypto.createHash('sha256').update(body, 'utf8').digest('base64') + "'");
    return m;
  });
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://unpkg.com " + [...new Set(hashes)].join(' '),
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss://*.supabase.co",
    "worker-src 'self' blob:",
    "frame-src https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accept.paymob.com",
    'upgrade-insecure-requests',
  ].join('; ');
  const metas = '<meta http-equiv="Content-Security-Policy" content="' + csp + '" />'
    + (page.includes('name="referrer"') ? '' : '<meta name="referrer" content="strict-origin-when-cross-origin" />');
  page = page.replace('<head>', '<head>' + metas);
  fs.writeFileSync(file, page);
  console.log('content security policy: ' + hashes.length + ' inline scripts allowed by hash');
}
