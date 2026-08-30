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

const BASE = 'https://ayserelrifay.github.io/AYSER-s-CV/';
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
  <link rel="manifest" href="/AYSER-s-CV/manifest.json" />
  <meta name="theme-color" content="#7C3AED" />
  <link rel="apple-touch-icon" sizes="180x180" href="/AYSER-s-CV/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/AYSER-s-CV/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/AYSER-s-CV/icon-192.png" />
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
fs.writeFileSync(file, html);
console.log('index.html patched: PWA + OG tags');
