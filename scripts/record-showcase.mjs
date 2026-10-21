/* ─── THE REEL, AS A FILE ─────────────────────────────────────────────
   public/showcase/ draws every frame from one number, t (see the note at
   the top of its index.html). This steps t through the film at a fixed
   rate, photographs each frame and hands the pictures to ffmpeg — so the
   .mp4 is the page, frame for frame, with no screen recording and no
   dropped frames.

   Usage:  node scripts/record-showcase.mjs [916|169] [out.mp4]
   Env:    URL   where the built site is served (default http://localhost:8792)
           FPS   frames a second (default 30)
           PW    path to the playwright package (default: resolve 'playwright')
   Needs ffmpeg on the PATH, and the site built (dist/) and served. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ratio = process.argv[2] === '169' ? '169' : '916';
const out = process.argv[3] || `Moments-reel-${ratio === '169' ? '16x9' : '9x16'}.mp4`;
const URL = process.env.URL || 'http://localhost:8792';
const FPS = Number(process.env.FPS) || 30;
const DUR = 60;
const [W, H] = ratio === '169' ? [1920, 1080] : [1080, 1920];
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`${URL}/showcase/?record=1&ratio=${ratio}`);
await page.evaluate(() => window.__ready());
await page.waitForTimeout(800);
const total = DUR * FPS;
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.__seek(t), i / FPS);
  await page.screenshot({ path: path.join(dir, String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  if (i % (FPS * 5) === 0) console.log(`  ${ratio} · ${Math.round(i / FPS)}s`);
}
await browser.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', out], { stdio: 'inherit' });
fs.rmSync(dir, { recursive: true, force: true });
console.log('wrote ' + out);
