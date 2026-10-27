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
/* what Google shows: the name people type ("Moments", "The Real Moments",
   "مومنتس") in the title, and one honest sentence of what it is */
const TITLE = "Moments app — meet people, gatherings & hangouts near you | The Real Moments";
const DESC = 'Moments app (The Real Moments · مومنتس) is a social community app for real life: gatherings and hangouts near you, Moments people to go out with, trips, workshops and Green Minds clean-ups. Don\'t scroll it. Live it.';
/* what WhatsApp, iMessage and the rest show when the link is shared —
   short, like the first card Ayser liked; the long TITLE/DESC above are
   for search engines */
const SHARE_TITLE = "Moments — Don't scroll it. Live it.";
const SHARE_DESC = 'Meet people, join gatherings and go out together near you — real plans, real people.';
const KEYWORDS = 'Moments, Moments app, The Real Moments, therealmoments, Moments people, gathering, gatherings, community, community app, social, social app, hangouts, hangout app, meet people, make friends, things to do, events near me, Cairo, Egypt, Europe, مومنتس, خروجات, ناس, تجمعات';

// Responsive framing so ONE build fits both screens:
//  • Phone  → the app fills the whole screen (dynamic viewport height so
//    the browser chrome never crops it → fixes the mobile aspect ratio).
//  • Laptop/desktop → the app is centred in a phone-shaped frame on a
//    soft backdrop instead of being stretched across a wide window.
const responsiveCss = `
  <style>
    html, body { margin: 0; height: 100%; background: #0F0D14; }
    @media (prefers-color-scheme: light) { html, body { background: #FAF8F5; } }
    html.mm-dark, html.mm-dark body { background: #0F0D14; }
    html.mm-light, html.mm-light body { background: #FAF8F5; }
    /* the design system, where the screens cannot say it themselves:
       no drop shadows anywhere — a 1px hairline takes their place — and
       everything you can press gives a little under your finger */
    div[style*="box-shadow"] { box-shadow: 0 0 0 1px rgba(23,19,31,0.08) !important; }
    html.mm-dark div[style*="box-shadow"] { box-shadow: 0 0 0 1px rgba(255,255,255,0.08) !important; }
    [role="button"] { transition: transform 200ms ease-out, opacity 200ms ease-out; }
    [role="button"]:active { transform: scale(0.98); }
    body { font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased; }
    /* the app is pinned to the four edges of the screen. A height of
       100dvh fixed the URL-bar crop in the browser, but on an iPhone
       home-screen app it came out one status bar short of the screen —
       a black band under the tab bar ("بدل السواد الي تحتيها ده"). The
       edges themselves are always right, in the browser and installed. */
    #root { position: fixed; top: 0; right: 0; bottom: 0; left: 0; width: auto; height: auto; overflow: hidden; }
    /* Laptop / desktop: the whole window. It used to sit in a framed box
       in the middle of a dark backdrop, which on a laptop screen looked
       like a page that had not finished loading ("ليه الشاشة مش كاملة").
       Now the app fills the window; the sidebar sits on the left and each
       screen keeps a comfortable reading width (TabNavigator sceneStyle). */
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
  <meta name="theme-color" content="#FAF8F5" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0F0D14" media="(prefers-color-scheme: dark)" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <!-- the icon somebody picked (src/lib/appIcon.js), before the phone reads it -->
  <script>(function(){try{var IC=['night','nile','sunset','papyrus','paper'],qi=new URLSearchParams(location.search).get('icon');if(qi==='classic')localStorage.removeItem('mm.icon');else if(IC.indexOf(qi)>=0)localStorage.setItem('mm.icon',qi);var mi=localStorage.getItem('mm.icon');if(IC.indexOf(mi)>=0){var q=function(s){return document.querySelectorAll(s)};q('link[rel=manifest]')[0].href='/icons/manifest-'+mi+'.json';q('link[rel=apple-touch-icon]')[0].href='/icons/'+mi+'-180.png';q('link[rel=icon]').forEach(function(l){l.href='/icons/'+mi+'-192.png'})}}catch(e){}})()</script>
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <!-- iPhone home-screen app: on some iOS versions the page stops one status
       bar short of the bottom of the screen, and the tab bar floats over an
       empty band ("ليه في مساحة فاضية تحت"). If the window is shorter than the
       screen by about a status bar, the app is stretched down to the edge.
       In the browser, or where iOS gets it right, the gap is 0 and nothing moves. -->
  <script>(function(){try{if(!(navigator.standalone||matchMedia('(display-mode: standalone)').matches))return;var fit=function(){var r=document.getElementById('root');if(!r)return;var g=innerHeight>innerWidth?screen.height-innerHeight:0;r.style.bottom=(g>0&&g<80?-g:0)+'px'};addEventListener('resize',fit);addEventListener('orientationchange',function(){setTimeout(fit,300)});document.addEventListener('DOMContentLoaded',fit);setTimeout(fit,0)}catch(e){}})()</script>
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Moments" />
  <meta name="description" content="${DESC}" />
  <meta name="keywords" content="${KEYWORDS}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${BASE}" />
  <meta name="application-name" content="Moments" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': BASE + '#org', name: 'Moments', alternateName: ['The Real Moments', 'therealmoments', 'مومنتس'], url: BASE, logo: BASE + 'icon-512.png', email: 'team@therealmoments.com', contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', email: 'support@therealmoments.com' }, { '@type': 'ContactPoint', contactType: 'partnerships', email: 'partners@therealmoments.com' }, { '@type': 'ContactPoint', contactType: 'community', email: 'community@therealmoments.com' }], founder: { '@type': 'Person', name: 'Ayser Elrifay' } },
      { '@type': 'WebSite', '@id': BASE + '#site', name: 'Moments', alternateName: 'The Real Moments', url: BASE, publisher: { '@id': BASE + '#org' }, inLanguage: ['en', 'ar'] },
      { '@type': 'WebApplication', name: 'Moments', url: BASE, applicationCategory: 'SocialNetworkingApplication', operatingSystem: 'Web, iOS, Android', description: DESC, keywords: KEYWORDS, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    ],
  })}</script>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Moments" />
  <meta property="og:title" content="${SHARE_TITLE}" />
  <meta property="og:description" content="${SHARE_DESC}" />
  <meta property="og:url" content="${BASE}" />
  <meta property="og:image" content="${BASE}og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${SHARE_TITLE}" />
  <meta name="twitter:description" content="${SHARE_DESC}" />
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
/* ── ARABIC THAT LOOKS LIKE MOMENTS ──
   Ayser: "ادعم اللغة العربية والخطوط بشكل أحسن وشبه الهوية". The app
   showed Arabic in whatever the phone had. Now Arabic letters — and only
   Arabic letters, by unicode-range — are drawn in Readex Pro, the same
   face as the notebook and the decks (23 KB, our own origin, OFL — see
   public/fonts/NOTICE.txt). English stays in the phone's own font. The
   face goes first in React Native Web's system stack in the bundle
   (below), so every Text gets it and an icon that names its own font
   keeps it. */
if (!html.includes('MomentsArabic')) {
  html = html.replace('</head>', `<style>@font-face { font-family: 'MomentsArabic'; font-style: normal; font-weight: 300 700; font-display: swap; src: url(fonts/readex-arabic.woff2) format('woff2'); unicode-range: U+0600-06FF, U+0750-077F, U+0870-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC7, U+10EC9-10EEE, U+10EF0-10EFF, U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1; }</style></head>`);
}

/* the colour you chose, before the first paint — not the phone's and then
   yours a moment later (Ayser: "بتلود مرتين، مرة بشكل قديم") */
if (!html.includes('mm-dark')) {
  html = html.replace('</head>', `<script>(function(){try{var t=localStorage.getItem('moments.theme');if(t==='dark'||t==='light')document.documentElement.className+=' mm-'+t;}catch(e){}})();</script></head>`);
}
if (!html.includes('tap-highlight-color')) {
  /* the feel of the whole app, in one place: smooth text, no grey flash
     on every tap, scrolling that glides, no zoom-on-focus jump, and far
     less motion for people who asked their phone for less */
  html = html.replace('</head>', `<style>
  html, body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  * { -webkit-tap-highlight-color: transparent; }
  div { -webkit-overflow-scrolling: touch; }
  ::selection { background: rgba(124,92,255,0.28); }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }
</style></head>`);
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
/* Without JavaScript (and for a crawler that reads before it renders)
   the page said only "You need to enable JavaScript". Now it says what
   Moments is, in English and Arabic, with a link to the company page. */
html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>
      <h1>Moments — The Real Moments</h1>
      <p>${DESC}</p>
      <p>Moments is where people find a gathering or a hangout near them and go — a community for meeting real people, not scrolling. Moments people walk, play, clean up a park, travel and learn together.</p>
      <p>مومنتس — أبلكيشن للحياة الحقيقية: خروجات وتجمعات قريبة منك، ناس حقيقيين تخرج معاهم، رحلات وورش.</p>
      <p><a href="/company/">About Moments</a> · support@therealmoments.com · partners@therealmoments.com</p>
    </noscript>`);
fs.writeFileSync(file, html);
console.log('index.html patched: PWA + OG tags');

/* the Arabic face first in the system stack (see ARABIC THAT LOOKS LIKE
   MOMENTS above) — before the main file is named by its contents */
{
  const web = path.join(process.cwd(), dist, '_expo', 'static', 'js', 'web');
  const STACK = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  let n = 0;
  if (fs.existsSync(web)) {
    for (const name of fs.readdirSync(web)) {
      if (!name.endsWith('.js')) continue;
      const body = fs.readFileSync(path.join(web, name), 'utf8');
      if (!body.includes("'" + STACK + "'")) continue;
      fs.writeFileSync(path.join(web, name), body.split("'" + STACK + "'").join("'MomentsArabic," + STACK + "'"));
      n++;
    }
    if (!n) throw new Error('the system font stack was not found in the bundle — the Arabic face would not apply');
  }
}

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
    // 'wasm-unsafe-eval' lets WebAssembly compile (the face model, src/lib/faceMesh.js)
    // and nothing else: plain eval and new Function stay forbidden
    "script-src 'self' 'wasm-unsafe-eval' https://unpkg.com " + [...new Set(hashes)].join(' '),
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

