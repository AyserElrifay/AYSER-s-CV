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

const tags = `
  <link rel="manifest" href="manifest.json" />
  <meta name="theme-color" content="#7C3AED" />
  <link rel="apple-touch-icon" href="apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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

if (!html.includes('og:title')) {
  html = html.replace('</head>', tags + '</head>');
}
if (html.includes('<title>')) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
} else {
  html = html.replace('</head>', `<title>${TITLE}</title></head>`);
}
fs.writeFileSync(file, html);
console.log('index.html patched: PWA + OG tags');
