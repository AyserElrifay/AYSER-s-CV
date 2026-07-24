/* ─── Seko Seko — the art · مصر: القاهرة القديمة ─────────────────────
   A warm, sunny OLD-CAIRO alley (حارة إسلامية) drawn top-down on canvas:
   sandstone buildings with wooden mashrabiya balconies, a cobblestone
   street, a mosque + minaret landmark, classic black Cairo taxis, shop
   awnings & signs (كشري الزعيم…), hanging lanterns, potted plants and
   palms — under warm daylight. Pure canvas, no external assets, so it
   ships free with zero copyright. (Not photoreal 3D — that needs a 3D
   engine — but the same mood, in the game's own 2D art.) */

export const WORLD_W = 1500;
export const WORLD_H = 1050;

const ROAD = 96;                    // wide cobbled alleys
const V_ROADS = [300, 800, 1200];
const H_ROADS = [320, 760];

function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// warm sandstone tones for the buildings
const SAND = ['#d9b878', '#cfa864', '#c39a56', '#d3b06e', '#bd9147'];
const SAND_DK = ['#a8813f', '#9c7636', '#8f6b30', '#a17c3c', '#8a6329'];
const AWN = [['#b8433b', '#efe4cd'], ['#2f6b4e', '#efe4cd'], ['#c98a2e', '#3a2a1a'], ['#3a5a8a', '#efe4cd']];
const SHOP = ['كشري الزعيم', 'الأجرة', 'فطير مشلتت', 'عصير قصب', 'مكوى الحاج', 'خضار وفاكهة'];

export function buildCity() {
  const rnd = mulberry(11);
  const buildings = [], palms = [], taxis = [], lanterns = [], stalls = [], plants = [];
  const xs = [0, ...V_ROADS, WORLD_W];
  const ys = [0, ...H_ROADS, WORLD_H];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + (i === 0 ? 26 : ROAD / 2 + 16);
      const x1 = xs[i + 1] - (i + 1 === xs.length - 1 ? 26 : ROAD / 2 + 16);
      const y0 = ys[j] + (j === 0 ? 26 : ROAD / 2 + 16);
      const y1 = ys[j + 1] - (j + 1 === ys.length - 1 ? 26 : ROAD / 2 + 16);
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 90 || bh < 90) continue;
      const two = bw > 300 && rnd() < 0.6;
      const gap = 20;
      const segs = two ? [[x0, (x0 + x1) / 2 - gap / 2], [(x0 + x1) / 2 + gap / 2, x1]] : [[x0, x1]];
      for (const [sx0, sx1] of segs) {
        const k = (rnd() * SAND.length) | 0;
        const b = {
          x: sx0, y: y0, w: sx1 - sx0, h: bh,
          sand: SAND[k], dark: SAND_DK[k], seed: (rnd() * 9999) | 0,
          mash: rnd() < 0.8, // mashrabiya balcony toward the street
          awning: rnd() < 0.5 ? { c: AWN[(rnd() * AWN.length) | 0], sign: SHOP[(rnd() * SHOP.length) | 0] } : null,
        };
        buildings.push(b);
        if (b.awning) stalls.push({ x: sx0 + 12 + rnd() * (sx1 - sx0 - 40), y: y1 + 6, c: b.awning.c });
      }
    }
  }
  // palms + potted plants + lanterns + parked taxis along the alleys
  for (const vx of V_ROADS) {
    for (let y = 140; y < WORLD_H; y += 230) { palms.push({ x: vx - ROAD / 2 - 14, y }); plants.push({ x: vx + ROAD / 2 + 12, y: y + 60 }); }
    for (let y = 200; y < WORLD_H; y += 260) lanterns.push({ x: vx - ROAD / 2 - 6, y });
    taxis.push({ x: vx - 13, y: 180 + rnd() * 260, vert: true });
    taxis.push({ x: vx - 13, y: 640 + rnd() * 240, vert: true });
  }
  for (const hy of H_ROADS) {
    for (let x = 130; x < WORLD_W; x += 240) plants.push({ x, y: hy - ROAD / 2 - 8 });
    for (let x = 260; x < WORLD_W; x += 300) lanterns.push({ x, y: hy - ROAD / 2 - 6 });
    taxis.push({ x: 220 + rnd() * 380, y: hy - 11, vert: false });
  }
  // the landmark — a mosque with dome + minaret, placed off a main corner
  const mosque = { x: 810, y: 150, w: 150, h: 130 };
  return { buildings, palms, taxis, lanterns, stalls, plants, mosque };
}

/* hide spots on the streets/corners (reachable, never inside a building) */
export const HIDE_SPOTS = [
  { x: 300, y: 520 }, { x: 800, y: 320 }, { x: 540, y: 760 },
  { x: 1200, y: 600 }, { x: 300, y: 880 }, { x: 1040, y: 320 }, { x: 800, y: 900 },
];

function rrp(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// ── cobblestone pattern, built once ──
let cobble = null;
function cobbleTile() {
  if (cobble || typeof document === 'undefined') return cobble;
  const t = document.createElement('canvas'); t.width = 54; t.height = 54;
  const x = t.getContext('2d');
  x.fillStyle = '#8a7c5d'; x.fillRect(0, 0, 54, 54); // grout
  const stones = [[4, 4, 20, 15], [28, 3, 20, 16], [3, 24, 17, 15], [24, 22, 24, 14], [5, 42, 22, 10], [31, 41, 18, 11]];
  const cols = ['#c4b592', '#b8a983', '#cabb98', '#b0a079'];
  stones.forEach((s, i) => { x.fillStyle = cols[i % cols.length]; rrp(x, s[0], s[1], s[2], s[3], 5); x.fill(); x.fillStyle = 'rgba(255,255,255,0.12)'; rrp(x, s[0], s[1], s[2], 3, 3); x.fill(); });
  cobble = t; return t;
}

// 2.5D building — a real EXTRUDED block: a lit sandstone roof lifted by H,
// with a shaded front wall dropping to the street carrying arched windows,
// a mashrabiya balcony, a door, and a shop awning+sign. Reads as 3D.
const EXT = 52; // extrusion height (px) — tall facades read as 3D
function shade(hex, amt) { // darken a #rrggbb by amt (0..1)
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, r * (1 - amt)) | 0; g = Math.max(0, g * (1 - amt)) | 0; b = Math.max(0, b * (1 - amt)) | 0;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function drawBuildingCairo(ctx, b) {
  const rnd = mulberry(b.seed);
  const H = EXT;
  const roofY = b.y - H, groundFront = b.y + b.h; // wall goes from (b.y+b.h-H)..(b.y+b.h)
  const wallTop = b.y + b.h - H;
  // ground shadow (sun high on the right → shadow to lower-left)
  ctx.fillStyle = 'rgba(60,40,15,0.30)'; rrp(ctx, b.x - 8, b.y + 10, b.w + 8, b.h + 6, 6); ctx.fill();
  // ── FRONT WALL (street-facing) ──
  const wallCol = shade(b.sand, 0.30);
  ctx.fillStyle = wallCol; ctx.fillRect(b.x, wallTop, b.w, H);
  // vertical light gradient down the wall (top brighter, base in shade)
  const wg = ctx.createLinearGradient(0, wallTop, 0, groundFront);
  wg.addColorStop(0, shade(b.sand, 0.16)); wg.addColorStop(1, shade(b.sand, 0.4));
  ctx.fillStyle = wg; ctx.fillRect(b.x, wallTop, b.w, H);
  // arched windows in three rows, some warmly lit
  const winW = 10, gap = 19;
  for (let row = 0; row < 3; row++) {
    const wy = wallTop + 6 + row * 14;
    if (wy > groundFront - 14) break;
    for (let wx = b.x + 9; wx < b.x + b.w - 11; wx += gap) {
      const lit = rnd() < 0.32;
      ctx.fillStyle = lit ? '#ffcf7a' : shade(b.sand, 0.56);
      if (lit) { ctx.shadowColor = '#ffcf7a'; ctx.shadowBlur = 5; }
      // arched top
      ctx.beginPath(); ctx.moveTo(wx, wy + 9); ctx.lineTo(wx, wy + 4); ctx.arc(wx + winW / 2, wy + 4, winW / 2, Math.PI, 0); ctx.lineTo(wx + winW, wy + 9); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = shade(b.sand, 0.62); ctx.lineWidth = 1; ctx.stroke();
    }
  }
  // door on some
  if (rnd() < 0.6) { const dw = 12, dx = b.x + 8 + rnd() * (b.w - dw - 16); ctx.fillStyle = '#5a3a1e'; rrp(ctx, dx, groundFront - 15, dw, 15, 2); ctx.fill(); ctx.fillStyle = '#7a5230'; ctx.fillRect(dx + dw / 2 - 0.5, groundFront - 13, 1, 11); }
  // ── ROOF (lifted, brighter) ──
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x, wallTop - 1, b.w, 2); // wall/roof seam shadow
  ctx.fillStyle = shade(b.sand, -0.06 < 0 ? b.sand : b.sand); ctx.fillStyle = b.sand;
  rrp(ctx, b.x, roofY, b.w, b.h, 5); ctx.fill();
  // parapet highlight
  ctx.fillStyle = 'rgba(255,240,200,0.22)'; ctx.fillRect(b.x, roofY, b.w, 2);
  // seams
  ctx.strokeStyle = 'rgba(120,90,45,0.18)'; ctx.lineWidth = 1;
  for (let yy = roofY + 16; yy < roofY + b.h - 4; yy += 18) { ctx.beginPath(); ctx.moveTo(b.x + 3, yy); ctx.lineTo(b.x + b.w - 3, yy); ctx.stroke(); }
  // rooftop clutter (on the roof face)
  for (let i = 0; i < 1 + ((b.w * b.h) / 30000 | 0); i++) {
    const tx = b.x + 14 + rnd() * (b.w - 34), ty = roofY + 12 + rnd() * (b.h - 30);
    ctx.fillStyle = 'rgba(50,32,12,0.25)'; ctx.fillRect(tx + 2, ty + 2, 13, 13);
    ctx.fillStyle = '#7c5a38'; ctx.fillRect(tx, ty, 13, 13); ctx.fillStyle = '#9c7a50'; ctx.fillRect(tx, ty, 13, 4);
  }
  if (rnd() < 0.6) { const dx = b.x + 14 + rnd() * (b.w - 30), dy = roofY + 14 + rnd() * (b.h - 24); ctx.strokeStyle = '#d8ccb4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(dx, dy, 6, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
  // ── MASHRABIYA — protruding wooden lattice balcony on the front wall ──
  if (b.mash) {
    const mw = Math.min(b.w - 14, 58), mx = b.x + (b.w - mw) / 2, my = wallTop + H - 20;
    ctx.fillStyle = 'rgba(40,26,12,0.4)'; ctx.fillRect(mx + 3, my + 5, mw, 16); // depth shadow
    ctx.fillStyle = '#6e4a28'; rrp(ctx, mx, my, mw, 17, 3); ctx.fill();
    ctx.fillStyle = '#3a2410'; // lattice holes
    for (let lx = mx + 3; lx < mx + mw - 3; lx += 5) for (let ly = my + 3; ly < my + 14; ly += 4) ctx.fillRect(lx, ly, 2.5, 2.5);
    ctx.fillStyle = '#8a5e34'; ctx.fillRect(mx, my, mw, 2.5); // lit top rail
    ctx.fillStyle = '#4a3018'; ctx.fillRect(mx, my + 15, mw, 2);
  }
  // ── shop awning + sign at street level ──
  if (b.awning) {
    const aw = Math.min(b.w - 8, 82), ax = b.x + (b.w - aw) / 2, ay = groundFront - 2;
    ctx.fillStyle = '#4a3016'; rrp(ctx, ax, ay - 22, aw, 11, 2); ctx.fill(); // sign board
    ctx.fillStyle = '#f0e4cb'; ctx.font = '700 8px "SF Arabic",Tahoma,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.awning.sign, ax + aw / 2, ay - 16.5);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    const [c1, c2] = b.awning.c; const stripe = aw / 6;
    for (let s = 0; s < 6; s++) { ctx.fillStyle = s % 2 ? c2 : c1; ctx.fillRect(ax + s * stripe, ay - 10, stripe, 9); }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(ax, ay - 1, aw, 3); // awning shadow on ground
  }
}

function drawMinaret(ctx, m) {
  const cx = m.x + m.w * 0.72;
  // mosque base (sandstone)
  ctx.fillStyle = 'rgba(70,45,15,0.28)'; rrp(ctx, m.x + 9, m.y + 11, m.w, m.h, 8); ctx.fill();
  ctx.fillStyle = '#d9c089'; rrp(ctx, m.x, m.y, m.w, m.h, 8); ctx.fill();
  // dome
  const dx = m.x + m.w * 0.34, dy = m.y + m.h * 0.5;
  ctx.fillStyle = '#3f8f7d'; ctx.beginPath(); ctx.arc(dx, dy, 30, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(dx - 8, dy - 8, 12, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2c6b5d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dx, dy, 30, 0, 7); ctx.stroke();
  ctx.fillStyle = '#c9a25f'; ctx.fillRect(dx - 1.5, dy - 40, 3, 12); ctx.beginPath(); ctx.arc(dx, dy - 42, 3, 0, 7); ctx.fill(); // crescent finial
  // minaret — a tall round tower with a long shadow (reads as vertical)
  ctx.fillStyle = 'rgba(70,45,15,0.3)'; ctx.beginPath(); ctx.ellipse(cx + 20, m.y + m.h * 0.55 + 30, 30, 12, 0, 0, 7); ctx.fill();
  for (let r = 0; r < 3; r++) {
    const ry = m.y + m.h * 0.55 - r * 16, rad = 15 - r * 3;
    ctx.fillStyle = r % 2 ? '#e7cf98' : '#d9be82'; ctx.beginPath(); ctx.arc(cx, ry, rad, 0, 7); ctx.fill();
    ctx.strokeStyle = '#a8813f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, ry, rad, 0, 7); ctx.stroke();
  }
  ctx.fillStyle = '#3f8f7d'; ctx.beginPath(); ctx.arc(cx, m.y + m.h * 0.55 - 3 * 16, 6, 0, 7); ctx.fill(); // top cap
}

function drawPalm(ctx, x, y) {
  ctx.fillStyle = 'rgba(70,45,15,0.28)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 4, 16, 7, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 16); ctx.stroke();
  ctx.fillStyle = '#3f8a3a'; for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x - 2 + Math.cos(ang) * 12, y - 16 + Math.sin(ang) * 8, 11, 4, ang, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#57a84e'; ctx.beginPath(); ctx.arc(x - 2, y - 16, 4, 0, 7); ctx.fill();
}
function drawPlant(ctx, x, y) { // potted plant
  ctx.fillStyle = 'rgba(70,45,15,0.25)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 9, 4, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#b5623a'; ctx.fillRect(x - 6, y - 2, 12, 8); // terracotta pot
  ctx.fillStyle = '#3f8a3a'; ctx.beginPath(); ctx.arc(x, y - 4, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#57a84e'; ctx.beginPath(); ctx.arc(x - 3, y - 6, 4, 0, 7); ctx.arc(x + 3, y - 5, 4, 0, 7); ctx.fill();
}
function drawTaxi(ctx, c) { // classic black-&-white Cairo taxi (top-down)
  const x = c.x, y = c.y, v = c.vert, w = v ? 22 : 34, h = v ? 34 : 22;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrp(ctx, x + 3, y + 4, w, h, 5); ctx.fill();
  ctx.fillStyle = '#161616'; rrp(ctx, x, y, w, h, 5); ctx.fill();               // black body
  ctx.fillStyle = '#ececec';                                                     // white roof/doors band
  if (v) ctx.fillRect(x + 2, y + 9, w - 4, h - 18); else ctx.fillRect(x + 9, y + 2, w - 18, h - 4);
  ctx.fillStyle = 'rgba(150,205,235,0.9)';                                       // windshields
  if (v) { ctx.fillRect(x + 4, y + 4, w - 8, 5); ctx.fillRect(x + 4, y + h - 9, w - 8, 5); } else { ctx.fillRect(x + 4, y + 4, 5, h - 8); ctx.fillRect(x + w - 9, y + 4, 5, h - 8); }
  ctx.fillStyle = '#f2c14e'; if (v) ctx.fillRect(x + w / 2 - 4, y + h / 2 - 3, 8, 6); else ctx.fillRect(x + w / 2 - 4, y + h / 2 - 3, 8, 6); // TAXI roof sign
}
function drawLantern(ctx, x, y) { // فانوس with warm glow
  const g = ctx.createRadialGradient(x, y, 2, x, y, 40); g.addColorStop(0, 'rgba(255,200,110,0.45)'); g.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 40, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a5a24'; ctx.fillRect(x - 1, y - 12, 2, 6);
  ctx.fillStyle = '#f0b64a'; rrp(ctx, x - 5, y - 6, 10, 13, 2); ctx.fill();
  ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 1; ctx.strokeRect(x - 5, y - 6, 10, 13);
  ctx.fillStyle = '#fff2c8'; ctx.fillRect(x - 2, y - 3, 4, 7);
}

export function drawPerson(ctx, x, y, shirt, skin, faded) {
  ctx.save(); if (faded) ctx.globalAlpha = 0.16;
  ctx.fillStyle = 'rgba(60,40,15,0.32)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 11, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(x, y + 2, 11, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = skin || '#e0a870'; ctx.beginPath(); ctx.arc(x, y - 2, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a1e14'; ctx.beginPath(); ctx.arc(x, y - 4, 7, Math.PI, 0); ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, VW, VH, cam, city) {
  const tile = cobbleTile();
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // warm sandy ground
  ctx.fillStyle = '#c9b892'; ctx.fillRect(cam.x, cam.y, VW, VH);

  // cobblestone streets (grid of alleys)
  const pat = tile ? ctx.createPattern(tile, 'repeat') : null;
  const paveH = (y) => { ctx.fillStyle = '#b3a37e'; ctx.fillRect(cam.x, y - ROAD / 2, VW, ROAD); if (pat) { ctx.fillStyle = pat; ctx.fillRect(cam.x, y - ROAD / 2, VW, ROAD); } ctx.fillStyle = '#a89370'; ctx.fillRect(cam.x, y - ROAD / 2 - 5, VW, 5); ctx.fillRect(cam.x, y + ROAD / 2, VW, 5); };
  const paveV = (x) => { ctx.fillStyle = '#b3a37e'; ctx.fillRect(x - ROAD / 2, cam.y, ROAD, VH); if (pat) { ctx.fillStyle = pat; ctx.fillRect(x - ROAD / 2, cam.y, ROAD, VH); } ctx.fillStyle = '#a89370'; ctx.fillRect(x - ROAD / 2 - 5, cam.y, 5, VH); ctx.fillRect(x + ROAD / 2, cam.y, 5, VH); };
  for (const hy of H_ROADS) paveH(hy);
  for (const vx of V_ROADS) paveV(vx);

  const vis = (x, y, pad) => x > cam.x - pad && x < cam.x + VW + pad && y > cam.y - pad && y < cam.y + VH + pad;
  if (city.mosque && vis(city.mosque.x, city.mosque.y, 200)) drawMinaret(ctx, city.mosque);
  // depth sort: farther (smaller y) buildings first, so nearer ones' walls
  // overlap the roofs behind them — that's what sells the 2.5D height.
  if (!city._sorted) { city.buildings.sort((a, z) => (a.y + a.h) - (z.y + z.h)); city._sorted = true; }
  for (const b of city.buildings) if (vis(b.x, b.y, 300)) drawBuildingCairo(ctx, b);
  for (const t of city.taxis) if (vis(t.x, t.y, 60)) drawTaxi(ctx, t);
  for (const p of city.plants) if (vis(p.x, p.y, 30)) drawPlant(ctx, p.x, p.y);
  for (const p of city.palms) if (vis(p.x, p.y, 40)) drawPalm(ctx, p.x, p.y);
  for (const l of city.lanterns) if (vis(l.x, l.y, 50)) drawLantern(ctx, l.x, l.y);

  ctx.restore();

  // warm daylight wash + soft vignette (bright, sunny — not a night scene)
  const sun = ctx.createRadialGradient(VW * 0.72, VH * 0.1, 20, VW * 0.72, VH * 0.1, VW);
  sun.addColorStop(0, 'rgba(255,236,180,0.22)'); sun.addColorStop(0.5, 'rgba(255,210,130,0.07)'); sun.addColorStop(1, 'rgba(255,210,130,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, VW, VH);
  const vig = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, VH * 0.95);
  vig.addColorStop(0, 'rgba(60,40,15,0)'); vig.addColorStop(1, 'rgba(60,40,15,0.28)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, VW, VH);
}
