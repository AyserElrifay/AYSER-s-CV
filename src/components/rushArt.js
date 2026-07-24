/* ─── ROOFTOP RUSH · the art & level engine ───────────────────────────
   Everything you see is painted on a canvas, frame by frame — no emoji
   standing in for a character, no flat rectangles standing in for a
   city. Parallax skylines, painted facades with lit windows, real
   glossy ice, weather, and a runner with actual arms and legs.

   Levels are generated from a SEED, so two players racing each other
   get the exact same course — that's what makes a fair race possible. */

/* deterministic RNG — same seed, same world, on every device */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GROUND = 250;      // world-y of the default rooftop line
export const RUNNER_W = 26;
export const RUNNER_H = 46;

/* ── the chapters: a real journey, not a colour swap ────────────────── */
export const CHAPTERS = [
  {
    id: 'cairo', city: 'Cairo', flag: '🇪🇬', terrain: 'roof',
    title: 'السطوح · The Rooftops',
    story: 'الشمس بتغيب على القاهرة وصاحبك مستنيك على السطح الأخير. اجري على سطوح الحارة ونطّ كل فجوة — ومتبصش ورا.',
    storyEn: 'The sun is going down over Cairo and your mate is waiting on the last rooftop. Run the skyline, clear every gap — and don\'t look back.',
    chaser: 'mummy', chaserName: 'المومياء', chaserNameEn: 'The Mummy',
    goal: { kind: 'distance', value: 900 },
    sky: ['#3E1E63', '#B4459A', '#F0904B', '#FBC97F'],
    far: '#2A1240', mid: '#3D1B56', near: '#C9A878', accent: '#FFCF7A',
    ground: '#C9A878', edge: '#8A6A44',
  },
  {
    id: 'alps', city: 'The Alps', flag: '🏔️', terrain: 'ice',
    title: 'الجليد · The Ice Run',
    story: 'الطريق قطع بيك على جبل تلج. هنا مفيش فرامل — الجليد بيزحلق، فاستغل السرعة ونطّ من على الحواف.',
    storyEn: 'The trail broke off on a mountain of snow. There are no brakes here — the ice slides, so ride the speed and launch off the edges.',
    chaser: 'yeti', chaserName: 'الييتي', chaserNameEn: 'The Yeti',
    goal: { kind: 'coins', value: 20 },
    sky: ['#0E2A4E', '#2E6EA8', '#8FC4E8', '#DCEEFB'],
    far: '#154066', mid: '#215C8C', near: '#CFE9FA', accent: '#8FE3FF',
    ground: '#DCF0FF', edge: '#8FC4E8',
  },
  {
    id: 'paris', city: 'Paris', flag: '🇫🇷', terrain: 'roof',
    title: 'الأسطح الرمادية · Grey Roofs',
    story: 'باريس بالليل، والشبح لسه وراك. الأسطح هنا ضيقة والفجوات أوسع — التوقيت هو كل حاجة.',
    storyEn: 'Paris at night, and the Phantom is still behind you. The roofs are narrow here and the gaps are wider — timing is everything.',
    chaser: 'phantom', chaserName: 'الشبح', chaserNameEn: 'The Phantom',
    goal: { kind: 'distance', value: 1400 },
    sky: ['#0B1030', '#2A2A66', '#5A4A8A', '#8A6AA8'],
    far: '#0A0E28', mid: '#191F45', near: '#6E7488', accent: '#9FE8FF',
    ground: '#6E7488', edge: '#3E4356',
  },
  {
    id: 'carpath', city: 'The Carpathians', flag: '🏰', terrain: 'ice',
    title: 'الطريق الأخير · The Last Run',
    story: 'آخر فصل. تلج، وقلعة، ودراكولا مش هيسيبك. اوصل للنهاية وخلاص — صاحبك مستنيك هناك.',
    storyEn: 'The final chapter. Snow, a castle, and Dracula is not letting go. Reach the end — your mate is waiting there.',
    chaser: 'dracula', chaserName: 'دراكولا', chaserNameEn: 'Dracula',
    goal: { kind: 'survive', value: 45 },
    sky: ['#08040F', '#1E0B33', '#4A1B4E', '#7A2B4E'],
    far: '#0A0518', mid: '#1B0C2E', near: '#C8D8E8', accent: '#FF6E8A',
    ground: '#C8D8E8', edge: '#7A8FA8',
  },
];

/* ── level generation ───────────────────────────────────────────────
   A run of platforms with gaps you must jump, obstacles on top of some
   of them, and loot floating over the gaps to reward brave jumps. */
export function makeLevel(seed, chapterIndex) {
  const ch = CHAPTERS[chapterIndex % CHAPTERS.length];
  const r = rng(seed + chapterIndex * 7919);
  const ice = ch.terrain === 'ice';
  const platforms = [];
  const items = [];
  const hazards = [];

  let x = 0;
  let y = GROUND;
  // a generous, flat opening so nobody dies before they've understood the game
  platforms.push({ x: -200, y, w: 620, kind: ice ? 'ice' : 'roof' });
  x = 420;

  const LEN = 200; // number of platforms — long enough for every goal
  for (let i = 0; i < LEN; i++) {
    // gaps and heights ramp up gently with distance
    const t = Math.min(1, i / 90);
    const gap = (ice ? 54 : 52) + r() * ((ice ? 40 : 58) + t * (ice ? 40 : 62));
    // Platforms are never narrower than a full jump carries you, so a
    // committed jump always lands ON the next roof instead of sailing
    // clean over it into the gap beyond — that death felt like a cheat.
    const w = (ice ? 300 : 250) + r() * (ice ? 260 : 200);
    const rise = (r() - 0.45) * (54 + t * 48);
    y = Math.max(GROUND - 130, Math.min(GROUND + 74, y + rise));

    x += gap;
    platforms.push({ x, y, w, kind: ice ? 'ice' : 'roof', i });

    // loot floating over the gap you just cleared — jumping IS the reward
    if (r() < 0.72) {
      const kind = r() < 0.08 ? 'gem' : r() < 0.3 ? 'star' : 'coin';
      items.push({ x: x - gap / 2, y: y - 60 - r() * 46, kind, got: false });
    }
    // a couple of coins along the platform itself
    if (r() < 0.5) {
      const n = 2 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) items.push({ x: x + 40 + k * 34, y: y - 40, kind: 'coin', got: false });
    }
    // an obstacle to jump on the wider platforms
    if (w > 210 && r() < (ice ? 0.3 : 0.55)) {
      hazards.push({ x: x + w * (0.4 + r() * 0.35), y, kind: ice ? 'rock' : (r() < 0.5 ? 'chimney' : 'ac'), h: 30 + r() * 16 });
    }
    x += w;
  }

  return { chapter: ch, chapterIndex, platforms, items, hazards, endX: x, ice };
}

/* ── small painting helpers ─────────────────────────────────────── */
const rr = (c, x, y, w, h, r) => {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
};

/* ── the sky: a real painted gradient + sun/moon + weather ─────────── */
function drawSky(c, W, H, ch, t) {
  const g = c.createLinearGradient(0, 0, 0, H);
  const stops = ch.sky;
  stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // the sun (or moon) with a soft bloom
  const sx = W * 0.74, sy = H * 0.26;
  const warm = ch.terrain === 'roof' && ch.id === 'cairo';
  const bloom = c.createRadialGradient(sx, sy, 4, sx, sy, 190);
  bloom.addColorStop(0, warm ? 'rgba(255,214,150,0.85)' : 'rgba(220,238,255,0.5)');
  bloom.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = bloom;
  c.fillRect(0, 0, W, H);
  c.fillStyle = warm ? '#FFE6A8' : '#EAF4FF';
  c.beginPath(); c.arc(sx, sy, warm ? 34 : 26, 0, 7); c.fill();

  // stars on the night chapters
  if (ch.id === 'paris' || ch.id === 'carpath') {
    for (let i = 0; i < 46; i++) {
      const a = (i * 97.13) % W;
      const b = (i * 53.77) % (H * 0.45);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.002 + i));
      c.fillStyle = 'rgba(255,255,255,' + (0.35 * tw) + ')';
      c.fillRect(a, b, 2, 2);
    }
  }
}

/* Mountain ranges for the snow chapters — a city skyline behind an
   alpine run would look wrong, so the backdrop follows the terrain. */
function drawMountains(c, W, H, camX, layer, speed, colour, baseY, seed) {
  const step = layer === 'far' ? 190 : 260;
  const off = (camX * speed) % step;
  const startI = Math.floor((camX * speed) / step);
  const peakH = layer === 'far' ? 150 : 240;
  c.fillStyle = colour;
  c.beginPath();
  c.moveTo(-40, baseY + 240);
  for (let i = -1; i < W / step + 3; i++) {
    const idx = startI + i;
    const r2 = rng(seed + idx * 977);
    const x = i * step - off;
    const h = peakH * (0.55 + r2() * 0.7);
    c.lineTo(x, baseY);
    c.lineTo(x + step * 0.5, baseY - h);
    c.lineTo(x + step, baseY);
  }
  c.lineTo(W + 60, baseY + 240);
  c.closePath();
  c.fill();

  // snow caps on the near range
  if (layer === 'mid') {
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = -1; i < W / step + 3; i++) {
      const idx = startI + i;
      const r2 = rng(seed + idx * 977);
      const x = i * step - off;
      const h = peakH * (0.55 + r2() * 0.7);
      const capH = h * 0.3;
      c.beginPath();
      c.moveTo(x + step * 0.5, baseY - h);
      c.lineTo(x + step * 0.5 + capH * 0.55, baseY - h + capH);
      c.lineTo(x + step * 0.5 + capH * 0.2, baseY - h + capH * 0.82);
      c.lineTo(x + step * 0.5 - capH * 0.16, baseY - h + capH * 1.05);
      c.lineTo(x + step * 0.5 - capH * 0.55, baseY - h + capH);
      c.closePath();
      c.fill();
    }
  }
}

/* far + mid skyline silhouettes, scrolling at their own speeds */
function drawSkyline(c, W, H, camX, ch, layer, speed, colour, baseY, seed) {
  if (ch.terrain === 'ice') { drawMountains(c, W, H, camX, layer, speed, colour, baseY, seed); return; }
  const r = rng(seed);
  const step = layer === 'far' ? 78 : 104;
  const off = (camX * speed) % step;
  const startI = Math.floor((camX * speed) / step);
  c.fillStyle = colour;
  for (let i = -1; i < W / step + 3; i++) {
    const idx = startI + i;
    const rr2 = rng(seed + idx * 131);
    const h = (layer === 'far' ? 60 : 110) + rr2() * (layer === 'far' ? 80 : 150);
    const w = step * (0.62 + rr2() * 0.3);
    const x = i * step - off;
    c.fillRect(x, baseY - h, w, h + 200);
    // lit windows on the mid layer — the city feels alive
    if (layer === 'mid') {
      for (let wy = baseY - h + 14; wy < baseY - 8; wy += 20) {
        for (let wx = x + 8; wx < x + w - 8; wx += 16) {
          if (rng(Math.round(wx * 7 + wy * 13 + idx))() < 0.32) {
            c.fillStyle = ch.accent;
            c.globalAlpha = 0.5;
            c.fillRect(wx, wy, 6, 9);
            c.globalAlpha = 1;
            c.fillStyle = colour;
          }
        }
      }
    }
  }
  void r;
}

/* ── platforms: painted rooftops or glossy ice ─────────────────────── */
function drawPlatform(c, p, ch, camX, camY) {
  const x = p.x - camX;
  const y = p.y - camY;
  const w = p.w;
  const DEPTH = 190; // how far the building body drops below the roof line

  if (p.kind === 'ice') {
    // ice slab: cool gradient, a glossy top highlight, cracks, icicles
    const g = c.createLinearGradient(0, y, 0, y + DEPTH);
    g.addColorStop(0, '#F2FBFF');
    g.addColorStop(0.14, ch.ground);
    g.addColorStop(1, '#5E9AC4');
    c.fillStyle = g;
    c.fillRect(x, y, w, DEPTH);
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fillRect(x, y, w, 7);                       // snow cap
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(x + 6, y + 10, Math.max(0, w - 12), 3); // gloss line
    c.strokeStyle = 'rgba(120,180,220,0.55)';
    c.lineWidth = 1.5;
    for (let i = 1; i < 4; i++) {
      const cx = x + (w * i) / 4;
      c.beginPath();
      c.moveTo(cx, y + 8);
      c.lineTo(cx - 7, y + 40);
      c.lineTo(cx + 5, y + 78);
      c.stroke();
    }
    // icicles hanging off the leading edge
    c.fillStyle = 'rgba(230,248,255,0.9)';
    for (let ix = x + 8; ix < x + w - 6; ix += 26) {
      const hh = 9 + ((ix * 7) % 13);
      c.beginPath();
      c.moveTo(ix, y + DEPTH * 0.06);
      c.lineTo(ix + 5, y + DEPTH * 0.06);
      c.lineTo(ix + 2.5, y + DEPTH * 0.06 + hh);
      c.closePath();
      c.fill();
    }
    return;
  }

  // rooftop: sandstone/greystone facade with a lip, windows and a shadow side
  const g = c.createLinearGradient(0, y, 0, y + DEPTH);
  g.addColorStop(0, ch.ground);
  g.addColorStop(1, ch.edge);
  c.fillStyle = g;
  c.fillRect(x, y, w, DEPTH);
  // roof lip
  c.fillStyle = 'rgba(255,255,255,0.28)';
  c.fillRect(x, y, w, 5);
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fillRect(x, y + 5, w, 4);
  // windows
  for (let wy = y + 26; wy < y + DEPTH - 10; wy += 34) {
    for (let wx = x + 12; wx < x + w - 20; wx += 30) {
      const lit = rng(Math.round(wx * 3 + wy * 11))() < 0.42;
      c.fillStyle = lit ? ch.accent : 'rgba(20,16,26,0.55)';
      rr(c, wx, wy, 15, 19, 3);
      c.fill();
      if (lit) {
        c.fillStyle = 'rgba(255,190,90,0.16)';
        c.fillRect(wx - 3, wy - 2, 21, 24);
      }
    }
  }
  // darker right edge so buildings read as separate blocks
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.fillRect(x + w - 7, y + 5, 7, DEPTH - 5);
}

function drawHazard(c, h, ch, camX, camY) {
  const x = h.x - camX;
  const y = h.y - camY;
  if (h.kind === 'rock') {
    c.fillStyle = '#8FA8BC';
    c.beginPath();
    c.moveTo(x - 16, y);
    c.lineTo(x - 9, y - h.h);
    c.lineTo(x + 4, y - h.h * 0.8);
    c.lineTo(x + 15, y);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)';   // snow cap
    c.beginPath();
    c.moveTo(x - 10, y - h.h * 0.86);
    c.lineTo(x - 9, y - h.h);
    c.lineTo(x + 4, y - h.h * 0.8);
    c.closePath();
    c.fill();
    return;
  }
  if (h.kind === 'chimney') {
    c.fillStyle = '#7A4B36';
    c.fillRect(x - 11, y - h.h, 22, h.h);
    c.fillStyle = '#5E3728';
    c.fillRect(x - 13, y - h.h - 6, 26, 7);
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fillRect(x - 11, y - h.h, 6, h.h);
    return;
  }
  // AC / satellite box
  c.fillStyle = '#9AA3B0';
  rr(c, x - 15, y - h.h, 30, h.h, 4); c.fill();
  c.fillStyle = '#6E7684';
  c.fillRect(x - 11, y - h.h + 5, 22, 4);
  c.fillRect(x - 11, y - h.h + 12, 22, 4);
  c.fillStyle = 'rgba(255,255,255,0.2)';
  c.fillRect(x - 15, y - h.h, 30, 3);
}

function drawItem(c, it, camX, camY, t) {
  if (it.got) return;
  const x = it.x - camX;
  const y = it.y - camY + Math.sin(t * 0.005 + it.x * 0.02) * 5;
  if (it.kind === 'coin') {
    const wob = Math.abs(Math.cos(t * 0.006 + it.x));   // spinning coin
    c.fillStyle = '#F5B301';
    c.beginPath(); c.ellipse(x, y, 9 * (0.35 + wob * 0.65), 9, 0, 0, 7); c.fill();
    c.fillStyle = '#FFDE7A';
    c.beginPath(); c.ellipse(x, y, 5 * (0.35 + wob * 0.65), 5, 0, 0, 7); c.fill();
    return;
  }
  if (it.kind === 'star') {
    c.fillStyle = '#FFD23F';
    c.save(); c.translate(x, y); c.rotate(t * 0.002);
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? 5 : 12;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      i ? c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    c.closePath(); c.fill(); c.restore();
    return;
  }
  // gem
  c.save(); c.translate(x, y); c.rotate(Math.sin(t * 0.003) * 0.25);
  c.fillStyle = '#5BE3D2';
  c.beginPath(); c.moveTo(0, -13); c.lineTo(11, -2); c.lineTo(0, 14); c.lineTo(-11, -2); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath(); c.moveTo(0, -13); c.lineTo(11, -2); c.lineTo(0, 0); c.closePath(); c.fill();
  c.restore();
}

/* ── the runner: an actual little person, animated ─────────────────── */
export function drawRunner(c, sx, sy, opts) {
  const { phase = 0, airborne = false, sliding = false, shirt = '#FF2E88', ghost = false, flip = false } = opts || {};
  c.save();
  c.translate(sx, sy);
  if (flip) c.scale(-1, 1);
  if (ghost) c.globalAlpha = 0.42;

  const swing = Math.sin(phase);
  const swing2 = Math.sin(phase + Math.PI);
  const bob = airborne ? 0 : Math.abs(Math.sin(phase)) * 2;

  if (sliding) {
    // crouched slide pose
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath(); c.ellipse(0, 0, 22, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#2B2F3A';
    rr(c, -16, -14, 30, 10, 5); c.fill();                 // legs out front
    c.fillStyle = shirt;
    rr(c, -6, -26, 20, 16, 7); c.fill();                  // torso leaning back
    c.fillStyle = '#E8B98A';
    c.beginPath(); c.arc(10, -32, 8, 0, 7); c.fill();     // head
    c.fillStyle = '#2A1A10';
    c.beginPath(); c.arc(10, -34, 8, Math.PI, 0); c.fill();
    c.restore();
    return;
  }

  // shadow
  c.fillStyle = 'rgba(0,0,0,' + (airborne ? 0.1 : 0.24) + ')';
  c.beginPath(); c.ellipse(0, 0, 15, 4.5, 0, 0, 7); c.fill();

  // legs
  c.strokeStyle = '#2B2F3A';
  c.lineWidth = 6;
  c.lineCap = 'round';
  if (airborne) {
    c.beginPath(); c.moveTo(-2, -18); c.lineTo(-10, -4); c.stroke();
    c.beginPath(); c.moveTo(3, -18); c.lineTo(11, -9); c.stroke();
  } else {
    c.beginPath(); c.moveTo(-1, -18); c.lineTo(-1 + swing * 11, -1); c.stroke();
    c.beginPath(); c.moveTo(1, -18); c.lineTo(1 + swing2 * 11, -1); c.stroke();
  }

  // torso
  c.fillStyle = shirt;
  rr(c, -9, -38 - bob, 19, 22, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.16)';
  rr(c, -9, -38 - bob, 8, 22, 7); c.fill();

  // arms
  c.strokeStyle = shirt;
  c.lineWidth = 5.5;
  if (airborne) {
    c.beginPath(); c.moveTo(-4, -33 - bob); c.lineTo(-16, -42 - bob); c.stroke();
    c.beginPath(); c.moveTo(6, -33 - bob); c.lineTo(15, -24 - bob); c.stroke();
  } else {
    c.beginPath(); c.moveTo(0, -33 - bob); c.lineTo(swing2 * 13, -23 - bob); c.stroke();
    c.beginPath(); c.moveTo(0, -33 - bob); c.lineTo(swing * 13, -23 - bob); c.stroke();
  }

  // head + hair
  c.fillStyle = '#E8B98A';
  c.beginPath(); c.arc(1, -47 - bob, 8.5, 0, 7); c.fill();
  c.fillStyle = '#2A1A10';
  c.beginPath(); c.arc(1, -49 - bob, 8.5, Math.PI, 0); c.fill();
  c.fillRect(-7.5, -50 - bob, 4, 5);

  c.restore();
}

/* ── the chaser: a real drawn character per chapter ─────────────────── */
export function drawChaser(c, sx, sy, kind, t) {
  c.save();
  c.translate(sx, sy);
  const bob = Math.sin(t * 0.008) * 4;

  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.beginPath(); c.ellipse(0, 0, 18, 5, 0, 0, 7); c.fill();

  if (kind === 'phantom' || kind === 'dracula') {
    const body = kind === 'phantom' ? 'rgba(226,236,255,0.9)' : '#1B0B22';
    // floating cloak with a wavy hem
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(-17, -18 + bob);
    c.quadraticCurveTo(-20, -52 + bob, 0, -56 + bob);
    c.quadraticCurveTo(20, -52 + bob, 17, -18 + bob);
    for (let i = 0; i <= 6; i++) {
      const x = 17 - (i * 34) / 6;
      c.quadraticCurveTo(x - 2.8, -18 + bob + (i % 2 ? 9 : -3), x - 5.6, -18 + bob);
    }
    c.closePath(); c.fill();
    if (kind === 'dracula') {
      c.fillStyle = '#8E1B33';                       // collar
      c.beginPath(); c.moveTo(-14, -42 + bob); c.lineTo(0, -34 + bob); c.lineTo(14, -42 + bob); c.lineTo(0, -50 + bob); c.closePath(); c.fill();
      c.fillStyle = '#E8C8A8';
      c.beginPath(); c.arc(0, -48 + bob, 8, 0, 7); c.fill();
    }
    c.fillStyle = kind === 'phantom' ? '#2A2440' : '#FF3B5C';
    c.beginPath(); c.arc(-5, -46 + bob, 2.6, 0, 7); c.fill();
    c.beginPath(); c.arc(5, -46 + bob, 2.6, 0, 7); c.fill();
    c.restore();
    return;
  }

  if (kind === 'yeti') {
    c.fillStyle = '#EAF4FF';
    rr(c, -18, -46 + bob, 36, 44, 15); c.fill();          // furry body
    c.fillStyle = '#D2E6F5';
    for (let i = -16; i < 16; i += 7) c.fillRect(i, -12 + bob, 4, 12);
    c.fillStyle = '#EAF4FF';
    c.beginPath(); c.arc(0, -52 + bob, 13, 0, 7); c.fill();
    c.fillStyle = '#2A3440';
    c.beginPath(); c.arc(-5, -54 + bob, 2.6, 0, 7); c.fill();
    c.beginPath(); c.arc(5, -54 + bob, 2.6, 0, 7); c.fill();
    c.fillStyle = '#FFF';
    rr(c, -6, -46 + bob, 12, 6, 2); c.fill();             // teeth
    c.restore();
    return;
  }

  // mummy — wrapped bandages, arms out
  c.fillStyle = '#E4DCC4';
  rr(c, -13, -44 + bob, 26, 44, 9); c.fill();
  c.strokeStyle = 'rgba(150,132,96,0.75)';
  c.lineWidth = 2;
  for (let i = -40; i < -2; i += 7) {
    c.beginPath(); c.moveTo(-13, i + bob); c.lineTo(13, i + 3 + bob); c.stroke();
  }
  c.strokeStyle = '#E4DCC4'; c.lineWidth = 6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-8, -36 + bob); c.lineTo(-22, -34 + bob); c.stroke();
  c.beginPath(); c.moveTo(8, -36 + bob); c.lineTo(22, -34 + bob); c.stroke();
  c.fillStyle = '#E4DCC4';
  c.beginPath(); c.arc(0, -52 + bob, 10, 0, 7); c.fill();
  c.fillStyle = '#3A2E1E';
  c.beginPath(); c.arc(-4, -53 + bob, 2.4, 0, 7); c.fill();
  c.beginPath(); c.arc(4, -53 + bob, 2.4, 0, 7); c.fill();
  c.restore();
}

/* ── weather: snow on the ice chapters, dust on the roofs ───────────── */
function drawWeather(c, W, H, ch, t, camX) {
  if (ch.terrain === 'ice') {
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 70; i++) {
      const sx = (i * 137.5 + t * 0.05) % (W + 40) - 20;
      const sy = (i * 91.7 + t * (0.06 + (i % 5) * 0.02)) % (H + 40) - 20;
      const r2 = 1 + (i % 3);
      c.beginPath(); c.arc(sx + Math.sin(t * 0.001 + i) * 8, sy, r2, 0, 7); c.fill();
    }
  } else {
    c.fillStyle = 'rgba(255,220,170,0.18)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 211.3 - camX * 0.35) % (W + 30);
      const sy = (i * 77.1 + Math.sin(t * 0.0012 + i) * 20) % H;
      c.fillRect(sx < 0 ? sx + W + 30 : sx, sy, 2, 2);
    }
  }
}

/* ── the whole frame ────────────────────────────────────────────────
   Draws the world for one frame. `cam` is the world-space top-left. */
export function drawScene(c, W, H, cam, level, t, extras) {
  const ch = level.chapter;
  drawSky(c, W, H, ch, t);
  drawSkyline(c, W, H, cam.x, ch, 'far', 0.14, ch.far, H * 0.62, 1337);
  drawSkyline(c, W, H, cam.x, ch, 'mid', 0.34, ch.mid, H * 0.78, 4242);

  // the ground haze that separates the playfield from the backdrop
  const haze = c.createLinearGradient(0, H * 0.55, 0, H);
  haze.addColorStop(0, 'rgba(0,0,0,0)');
  haze.addColorStop(1, ch.terrain === 'ice' ? 'rgba(140,190,225,0.5)' : 'rgba(30,14,46,0.5)');
  c.fillStyle = haze;
  c.fillRect(0, H * 0.55, W, H * 0.45);

  const left = cam.x - 120, right = cam.x + W + 120;
  for (const p of level.platforms) {
    if (p.x + p.w < left || p.x > right) continue;
    drawPlatform(c, p, ch, cam.x, cam.y);
  }
  for (const h of level.hazards) {
    if (h.x < left || h.x > right) continue;
    drawHazard(c, h, ch, cam.x, cam.y);
  }
  for (const it of level.items) {
    if (it.x < left || it.x > right) continue;
    drawItem(c, it, cam.x, cam.y, t);
  }

  if (extras && extras.particles) {
    for (const p of extras.particles) {
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.col;
      c.beginPath(); c.arc(p.x - cam.x, p.y - cam.y, p.r, 0, 7); c.fill();
      c.globalAlpha = 1;
    }
  }

  drawWeather(c, W, H, ch, t, cam.x);
}
