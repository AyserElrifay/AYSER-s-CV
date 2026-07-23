/* ─── Seko Seko — the art ─────────────────────────────────────────────
   A real Vice-City-sunset top-down neighbourhood, drawn on a 2D canvas
   (not flat rectangles). Buildings with neon trim + lit windows +
   rooftop water tanks/AC (Cairo), palm trees, parked cars, street-lamp
   glow pools, crosswalks, and a warm dusk light overlay. Pure canvas so
   it looks the same everywhere and costs nothing to ship.

   The world is generated ONCE (deterministic) into plain arrays, and
   drawWorld() paints only what the camera can see. */

export const WORLD_W = 1500;
export const WORLD_H = 1050;

const ROAD = 70;
const V_ROADS = [250, 750, 1250];   // vertical street centres
const H_ROADS = [250, 700];         // horizontal street centres

// deterministic PRNG so the city is identical every run
function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const NEON = ['#ff2e88', '#20e3d2', '#ff9e2c', '#9370f7'];
const WIN = ['#ffd27a', '#8ff0ff'];
const ROOFS = ['#3a2456', '#4a2450', '#3a2c52', '#4a2c50', '#33203c'];
const BASES = ['#2c1b42', '#38203c', '#2c2140', '#33203c'];

/* Build the city: buildings inside each block, palms on sidewalks, cars
   on the roads, lamps at corners. Returns { buildings, palms, cars, lamps }. */
export function buildCity() {
  const rnd = mulberry(7);
  const buildings = [], palms = [], cars = [], lamps = [];
  const xs = [0, ...V_ROADS, WORLD_W];
  const ys = [0, ...H_ROADS, WORLD_H];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + (i === 0 ? 30 : ROAD / 2 + 20);
      const x1 = xs[i + 1] - (i + 1 === xs.length - 1 ? 30 : ROAD / 2 + 20);
      const y0 = ys[j] + (j === 0 ? 30 : ROAD / 2 + 20);
      const y1 = ys[j + 1] - (j + 1 === ys.length - 1 ? 30 : ROAD / 2 + 20);
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 80 || bh < 80) continue;
      // 1–2 buildings per block
      const two = bw > 260 && rnd() < 0.7;
      const gap = 22;
      const segs = two ? [[x0, (x0 + x1) / 2 - gap / 2], [(x0 + x1) / 2 + gap / 2, x1]] : [[x0, x1]];
      for (const [sx0, sx1] of segs) {
        buildings.push({
          x: sx0, y: y0, w: sx1 - sx0, h: bh,
          roof: ROOFS[(rnd() * ROOFS.length) | 0],
          base: BASES[(rnd() * BASES.length) | 0],
          edge: NEON[(rnd() * NEON.length) | 0],
          win: WIN[(rnd() * WIN.length) | 0],
          seed: (rnd() * 9999) | 0,
        });
      }
    }
  }
  // palms + lamps along every road edge at intervals
  for (const vx of V_ROADS) {
    for (let y = 120; y < WORLD_H; y += 200) { palms.push({ x: vx - ROAD / 2 - 16, y }); palms.push({ x: vx + ROAD / 2 + 16, y: y + 90 }); }
    for (let y = 250; y < WORLD_H; y += 450) lamps.push({ x: vx, y });
    cars.push({ x: vx - 12, y: 150 + rnd() * 300, col: pick(rnd), vert: true });
    cars.push({ x: vx - 12, y: 600 + rnd() * 300, col: pick(rnd), vert: true });
  }
  for (const hy of H_ROADS) {
    for (let x = 120; x < WORLD_W; x += 220) palms.push({ x, y: hy - ROAD / 2 - 16 });
    for (let x = 250; x < WORLD_W; x += 500) lamps.push({ x, y: hy });
    cars.push({ x: 150 + rnd() * 400, y: hy - 9, col: pick(rnd), vert: false });
    cars.push({ x: 800 + rnd() * 400, y: hy + ROAD - 9, col: pick(rnd), vert: false });
  }
  return { buildings, palms, cars, lamps };
}
function pick(rnd) { return ['#e0455e', '#3bd1c0', '#f2b134', '#8b6cf0', '#ffffff'][(rnd() * 5) | 0]; }

/* Spots where the neighbourhood kids hide — on the streets/corners so the
   player can always reach them (never inside a building). */
export const HIDE_SPOTS = [
  { x: 250, y: 480 }, { x: 750, y: 200 }, { x: 500, y: 700 },
  { x: 1250, y: 620 }, { x: 250, y: 850 }, { x: 980, y: 250 }, { x: 750, y: 900 },
];

function rrp(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawBuilding(ctx, b) {
  const rnd = mulberry(b.seed);
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; rrp(ctx, b.x + 10, b.y + 12, b.w, b.h, 8); ctx.fill();
  ctx.fillStyle = b.base; rrp(ctx, b.x, b.y, b.w, b.h + 10, 8); ctx.fill();
  ctx.fillStyle = b.roof; rrp(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = b.edge; ctx.shadowColor = b.edge; ctx.shadowBlur = 12;
  rrp(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 7); ctx.stroke(); ctx.shadowBlur = 0;
  const tanks = 1 + ((b.w * b.h) / 24000 | 0);
  for (let i = 0; i < tanks; i++) { const tx = b.x + 14 + rnd() * (b.w - 34), ty = b.y + 14 + rnd() * (b.h - 30); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(tx, ty, 12, 12); ctx.fillStyle = '#9a7a52'; ctx.fillRect(tx, ty, 12, 3); }
  for (let i = 0; i < tanks + 1; i++) { const ax = b.x + 12 + rnd() * (b.w - 26), ay = b.y + 12 + rnd() * (b.h - 24); ctx.fillStyle = '#556'; ctx.fillRect(ax, ay, 9, 7); ctx.fillStyle = '#889'; ctx.fillRect(ax + 1, ay + 1, 7, 2); }
  for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) { const lit = rnd() < 0.6; ctx.fillStyle = lit ? b.win : 'rgba(20,16,30,0.9)'; if (lit) { ctx.shadowColor = b.win; ctx.shadowBlur = 6; } ctx.fillRect(wx, b.y + b.h + 2, 9, 6); ctx.shadowBlur = 0; }
}
function drawPalm(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 4, 16, 7, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#5b3a24'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 16); ctx.stroke();
  ctx.fillStyle = '#1f7a4d'; for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x - 2 + Math.cos(ang) * 12, y - 16 + Math.sin(ang) * 8, 11, 4, ang, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#2fae6b'; ctx.beginPath(); ctx.arc(x - 2, y - 16, 4, 0, 7); ctx.fill();
}
function drawCar(ctx, c) {
  const x = c.x, y = c.y, v = c.vert;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrp(ctx, x + 3, y + 4, v ? 18 : 30, v ? 30 : 18, 5); ctx.fill();
  ctx.fillStyle = c.col; rrp(ctx, x, y, v ? 18 : 30, v ? 30 : 18, 5); ctx.fill();
  ctx.fillStyle = 'rgba(180,230,255,0.9)';
  if (v) { ctx.fillRect(x + 3, y + 5, 12, 7); ctx.fillRect(x + 3, y + 18, 12, 7); } else { ctx.fillRect(x + 5, y + 3, 7, 12); ctx.fillRect(x + 18, y + 3, 7, 12); }
}
function drawLampGlow(ctx, x, y) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, 52); g.addColorStop(0, 'rgba(255,220,140,0.5)'); g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 52, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
}
export function drawPerson(ctx, x, y, shirt, skin, faded) {
  ctx.save(); if (faded) ctx.globalAlpha = 0.16;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 11, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(x, y + 2, 11, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = skin || '#e8b98a'; ctx.beginPath(); ctx.arc(x, y - 2, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a1e14'; ctx.beginPath(); ctx.arc(x, y - 4, 7, Math.PI, 0); ctx.fill();
  ctx.restore();
}

/* Paint the whole visible scene. cam = {x, y} is the world point at the
   top-left of the viewport (already computed by the caller). */
export function drawWorld(ctx, VW, VH, cam, city) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // ground
  const g = ctx.createLinearGradient(cam.x, cam.y, cam.x + VW, cam.y + VH);
  g.addColorStop(0, '#2a2140'); g.addColorStop(0.5, '#33213f'); g.addColorStop(1, '#3b2338');
  ctx.fillStyle = g; ctx.fillRect(cam.x, cam.y, VW, VH);

  // roads (only the ones near the viewport)
  for (const vx of V_ROADS) {
    ctx.fillStyle = '#20182b'; ctx.fillRect(vx - ROAD / 2, cam.y, ROAD, VH);
    ctx.fillStyle = '#4a3d55'; ctx.fillRect(vx - ROAD / 2 - 8, cam.y, 8, VH); ctx.fillRect(vx + ROAD / 2, cam.y, 8, VH);
    ctx.fillStyle = 'rgba(245,200,90,0.5)'; for (let y = Math.floor(cam.y / 52) * 52; y < cam.y + VH; y += 52) ctx.fillRect(vx - 2, y, 4, 26);
  }
  for (const hy of H_ROADS) {
    ctx.fillStyle = '#20182b'; ctx.fillRect(cam.x, hy - ROAD / 2, VW, ROAD);
    ctx.fillStyle = '#4a3d55'; ctx.fillRect(cam.x, hy - ROAD / 2 - 8, VW, 8); ctx.fillRect(cam.x, hy + ROAD / 2, VW, 8);
    ctx.fillStyle = 'rgba(245,200,90,0.5)'; for (let x = Math.floor(cam.x / 52) * 52; x < cam.x + VW; x += 52) ctx.fillRect(x, hy - 2, 26, 4);
  }

  const vis = (x, y, pad) => x > cam.x - pad && x < cam.x + VW + pad && y > cam.y - pad && y < cam.y + VH + pad;
  for (const b of city.buildings) if (vis(b.x, b.y, 260)) drawBuilding(ctx, b);
  for (const c of city.cars) if (vis(c.x, c.y, 60)) drawCar(ctx, c);
  for (const p of city.palms) if (vis(p.x, p.y, 40)) drawPalm(ctx, p.x, p.y);
  for (const l of city.lamps) if (vis(l.x, l.y, 60)) drawLampGlow(ctx, l.x, l.y);

  ctx.restore();

  // sunset light + vignette (screen space)
  const sun = ctx.createRadialGradient(VW * 0.16, VH * 0.14, 20, VW * 0.16, VH * 0.14, VW);
  sun.addColorStop(0, 'rgba(255,150,80,0.24)'); sun.addColorStop(0.4, 'rgba(255,90,140,0.10)'); sun.addColorStop(1, 'rgba(255,90,140,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, VW, VH);
  const vig = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.3, VW / 2, VH / 2, VH * 0.85);
  vig.addColorStop(0, 'rgba(20,10,30,0)'); vig.addColorStop(1, 'rgba(15,8,24,0.5)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, VW, VH);
}
