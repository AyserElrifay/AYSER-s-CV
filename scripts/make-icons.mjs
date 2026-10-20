// Generates the PWA icons + OG card as real PNGs with zero image deps —
// raw RGBA pixels → zlib deflate → hand-built PNG chunks.
// Design: Moments purple rounded square, gold four-point star.
// Run: node scripts/make-icons.mjs
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(w, h, pixels /* RGBA Buffer */) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a + (b - a) * t;

/* Purple rounded square (superellipse) + gold 4-point star (astroid). */
function drawIcon(S, { transparentCorners = true } = {}) {
  const px = Buffer.alloc(S * S * 4);
  const c = S / 2;
  const R = S * 0.47;      // card radius
  const star = S * 0.30;   // star radius
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const dx = (x - c) / R, dy = (y - c) / R;
      const inCard = Math.pow(Math.abs(dx), 4) + Math.pow(Math.abs(dy), 4) <= 1;
      if (!inCard) { if (!transparentCorners) { px[i] = 124; px[i+1] = 58; px[i+2] = 237; px[i+3] = 255; } continue; }
      // vertical gradient purple → deep violet
      const t = y / S;
      let r = mix(139, 62, t), g = mix(92, 22, t), b = mix(246, 143, t);
      // astroid star: |x|^(2/3)+|y|^(2/3) <= r^(2/3)
      const sx = Math.abs(x - c) / star, sy = Math.abs(y - c) / star;
      if (Math.pow(sx, 2 / 3) + Math.pow(sy, 2 / 3) <= 1) { r = 245; g = 179; b = 1; }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return png(S, S, px);
}

/* OG card 1200×630: purple gradient, gold star left, white dots wordmark. */
function drawOg() {
  const W = 1200, H = 630;
  const px = Buffer.alloc(W * H * 4);
  const cx = 300, cy = H / 2, star = 150;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const t = (x / W + y / H) / 2;
      let r = mix(139, 42, t), g = mix(92, 15, t), b = mix(246, 99, t);
      const sx = Math.abs(x - cx) / star, sy = Math.abs(y - cy) / star;
      if (Math.pow(sx, 2 / 3) + Math.pow(sy, 2 / 3) <= 1) { r = 245; g = 179; b = 1; }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return png(W, H, px);
}

const out = path.join(process.cwd(), 'public');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(out, 'icon-512.png'), drawIcon(512));
fs.writeFileSync(path.join(out, 'icon-maskable-512.png'), drawIcon(512, { transparentCorners: false }));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), drawIcon(180, { transparentCorners: false }));
fs.writeFileSync(path.join(out, 'og-image.png'), drawOg());
console.log('icons written to public/');
