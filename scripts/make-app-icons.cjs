/* ─── THE MOMENTS APP ICON, EVERY SIZE AND COAT ───────────────────────
   Ayser: the old icon looked fake — a lump on the m, a shine and a
   shadow that weren't right. This one is flat: the m in Inter Display
   ExtraBold (the wordmark's weight) and the same four-point spark that
   sits over the wordmark. One design, six coats, drawn by Chromium so
   the letter is a real font, not a hand-made shape.

   Run: PW=$(npm root -g)/playwright node scripts/make-app-icons.cjs
   (needs Playwright's Chromium and the Inter Display font) */
const { chromium } = require(process.env.PW);
const fs = require('fs');
const FONT = 'file:///usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf';
const G = { mx: 422, my: 772, fs: 600, sx: 744, sy: 352, sr: 104 };
const THEMES = {
  classic: { bg: '#7C3AED', m: '#FFFFFF', s: '#FBBF24' },
  night:   { bg: '#16161D', m: '#FFFFFF', s: '#FBBF24' },
  nile:    { bg: '#0F766E', m: '#FFFFFF', s: '#FBBF24' },
  sunset:  { bg: '#E8505B', m: '#FFFFFF', s: '#FFD166' },
  papyrus: { bg: '#EFE4C8', m: '#2F5D3A', s: '#C98A00' },
  paper:   { bg: '#FAFAF7', m: '#16161D', s: '#F5A700' },
};
// four-point spark, same family as the one over the wordmark
const spark = (cx, cy, r, fill) => {
  const k = 0.26 * r;
  return `<path fill="${fill}" d="M${cx},${cy - r} C${cx + k * 0.6},${cy - k} ${cx + k},${cy - k * 0.6} ${cx + r},${cy} C${cx + k},${cy + k * 0.6} ${cx + k * 0.6},${cy + k} ${cx},${cy + r} C${cx - k * 0.6},${cy + k} ${cx - k},${cy + k * 0.6} ${cx - r},${cy} C${cx - k},${cy - k * 0.6} ${cx - k * 0.6},${cy - k} ${cx},${cy - r} Z"/>`;
};
const svg = (t, S, rounded, safe) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 1024 1024">
  <defs>
  <clipPath id="c"><rect width="1024" height="1024" rx="${rounded ? 229 : 0}"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="1024" height="1024" fill="${t.bg}"/>
    <g transform="${safe ? 'translate(512 512) scale(0.78) translate(-512 -512)' : ''}">
    <text id="m" x="${t.mx || 470}" y="${t.my || 700}" text-anchor="middle" font-family="IDX" font-size="${t.fs || 620}" fill="${t.m}" letter-spacing="0">m</text>
    ${spark(t.sx || 790, t.sy || 300, t.sr || 112, t.s)}
    </g>
  </g></svg>`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  const out = process.env.OUT || require('path').join(__dirname, '..', 'public');
  const jobs = process.env.JOBS ? JSON.parse(process.env.JOBS) : [
    ['classic', 192, true, 'icon-192.png'], ['classic', 512, true, 'icon-512.png'],
    ['classic', 512, false, 'icon-maskable-512.png', true], ['classic', 180, false, 'apple-touch-icon.png'],
    ['classic', 32, true, 'favicon-32.png'], ['classic', 256, true, '../src/assets/brand/mark.png'],
    ...['night', 'nile', 'sunset', 'papyrus', 'paper'].flatMap((id) => [
      [id, 180, false, 'icons/' + id + '-180.png'], [id, 192, true, 'icons/' + id + '-192.png'],
      [id, 512, true, 'icons/' + id + '-512.png'], [id, 512, false, 'icons/' + id + '-maskable-512.png', true],
    ]),
  ];
  for (const [theme, S, rounded, file, safe] of jobs) {
    await p.setViewportSize({ width: S, height: S });
    fs.writeFileSync(require('os').tmpdir() + '/moments-icon.html', `<html><head><style>@font-face{font-family:IDX;src:url(${FONT});}</style></head><body style="margin:0;background:transparent">${svg({ ...G, ...THEMES[theme] }, S, rounded, safe)}</body></html>`);
    await p.goto('file://' + require('os').tmpdir() + '/moments-icon.html');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    if (process.env.MEASURE) {
      const bb = await p.evaluate(() => { const r = document.getElementById('m').getBBox(); return [r.x, r.y, r.width, r.height]; });
      console.log('m bbox', bb);
    }
    await p.screenshot({ path: out + '/' + file, omitBackground: true, clip: { x: 0, y: 0, width: S, height: S } });
  }
  await b.close();
})();
