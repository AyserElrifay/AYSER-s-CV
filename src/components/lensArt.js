/* ── LENSES ─────────────────────────────────────────────────────────
   Every lens in here is drawn by us, in code, with lines and curves.
   None of it is downloaded, traced, or lifted from anywhere — which is
   the only way to hand people a beard, a crown and a pair of dog ears
   without inheriting somebody's copyright along with them.

   There is no face tracking. Browsers cannot do it reliably on a phone
   without shipping a model, so instead you DRAG a lens onto your face
   and pinch it to size. It is a second of work and it never slides off
   your chin mid-recording, which is the honest trade.

   Each lens draws into a box of side `s` centred on (x, y). Nothing
   reads the camera, so the same function works for the live preview,
   the baked photo and the video compositor. */

const T = Math.PI * 2;

const path = (c, pts, close) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (close) c.closePath();
};

/* ── faces & hair ────────────────────────────────────────────────── */

function beard(c, x, y, s, tone = '#2A1A10') {
  // a full beard hanging from the jaw, with a moustache above it
  c.fillStyle = tone;
  c.beginPath();
  c.moveTo(x - s * 0.42, y - s * 0.16);
  c.quadraticCurveTo(x - s * 0.40, y + s * 0.34, x, y + s * 0.50);
  c.quadraticCurveTo(x + s * 0.40, y + s * 0.34, x + s * 0.42, y - s * 0.16);
  c.quadraticCurveTo(x + s * 0.22, y + s * 0.06, x, y + s * 0.04);
  c.quadraticCurveTo(x - s * 0.22, y + s * 0.06, x - s * 0.42, y - s * 0.16);
  c.fill();
  // moustache
  c.beginPath();
  c.moveTo(x - s * 0.24, y - s * 0.22);
  c.quadraticCurveTo(x, y - s * 0.10, x + s * 0.24, y - s * 0.22);
  c.quadraticCurveTo(x, y - s * 0.02, x - s * 0.24, y - s * 0.22);
  c.fill();
  // a little sheen so it reads as hair and not a shape
  c.strokeStyle = 'rgba(255,255,255,0.10)';
  c.lineWidth = Math.max(1, s * 0.012);
  for (let i = -3; i <= 3; i++) {
    c.beginPath();
    c.moveTo(x + i * s * 0.09, y - s * 0.06);
    c.quadraticCurveTo(x + i * s * 0.10, y + s * 0.20, x + i * s * 0.06, y + s * 0.36);
    c.stroke();
  }
}

function hijab(c, x, y, s, cloth = '#6D4AA8') {
  // a wrap that frames the face and falls over the shoulders
  c.fillStyle = cloth;
  c.beginPath();
  c.moveTo(x - s * 0.52, y + s * 0.62);
  c.quadraticCurveTo(x - s * 0.60, y - s * 0.34, x, y - s * 0.56);
  c.quadraticCurveTo(x + s * 0.60, y - s * 0.34, x + s * 0.52, y + s * 0.62);
  c.quadraticCurveTo(x, y + s * 0.42, x - s * 0.52, y + s * 0.62);
  c.fill();
  // the face opening
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.ellipse(x, y + s * 0.02, s * 0.30, s * 0.38, 0, 0, T);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  // fold shadow
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.beginPath();
  c.moveTo(x - s * 0.52, y + s * 0.62);
  c.quadraticCurveTo(x - s * 0.30, y + s * 0.30, x - s * 0.34, y - s * 0.10);
  c.quadraticCurveTo(x - s * 0.48, y + s * 0.20, x - s * 0.52, y + s * 0.62);
  c.fill();
}

function dogEars(c, x, y, s) {
  const ear = (sx) => {
    c.fillStyle = '#6B4A32';
    c.beginPath();
    c.moveTo(x + sx * s * 0.34, y - s * 0.30);
    c.quadraticCurveTo(x + sx * s * 0.62, y - s * 0.04, x + sx * s * 0.40, y + s * 0.30);
    c.quadraticCurveTo(x + sx * s * 0.22, y + s * 0.02, x + sx * s * 0.34, y - s * 0.30);
    c.fill();
    c.fillStyle = '#C89B79';
    c.beginPath();
    c.moveTo(x + sx * s * 0.36, y - s * 0.20);
    c.quadraticCurveTo(x + sx * s * 0.50, y - s * 0.02, x + sx * s * 0.38, y + s * 0.18);
    c.quadraticCurveTo(x + sx * s * 0.28, y + s * 0.02, x + sx * s * 0.36, y - s * 0.20);
    c.fill();
  };
  ear(-1); ear(1);
  // nose + tongue, the bit that makes it read as a dog
  c.fillStyle = '#2A2A2A';
  c.beginPath(); c.ellipse(x, y + s * 0.12, s * 0.11, s * 0.085, 0, 0, T); c.fill();
  c.fillStyle = '#FF7C9B';
  c.beginPath();
  c.moveTo(x - s * 0.07, y + s * 0.20);
  c.quadraticCurveTo(x, y + s * 0.46, x + s * 0.07, y + s * 0.20);
  c.fill();
}

function catWhiskers(c, x, y, s) {
  c.fillStyle = '#3A3A3A';
  [-1, 1].forEach((sx) => {
    c.beginPath();
    c.moveTo(x + sx * s * 0.20, y - s * 0.34);
    c.lineTo(x + sx * s * 0.40, y - s * 0.56);
    c.lineTo(x + sx * s * 0.46, y - s * 0.26);
    c.closePath(); c.fill();
  });
  c.fillStyle = '#FF9BB3';
  c.beginPath(); c.ellipse(x, y + s * 0.06, s * 0.07, s * 0.055, 0, 0, T); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = Math.max(1.4, s * 0.014);
  [-1, 1].forEach((sx) => {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(x + sx * s * 0.09, y + s * 0.10 + i * s * 0.05);
      c.lineTo(x + sx * s * 0.44, y + s * 0.02 + i * s * 0.10);
      c.stroke();
    }
  });
}

function crown(c, x, y, s) {
  const g = c.createLinearGradient(x - s * 0.4, y, x + s * 0.4, y);
  g.addColorStop(0, '#F6C851'); g.addColorStop(0.5, '#FFF0A8'); g.addColorStop(1, '#E0A32B');
  c.fillStyle = g;
  path(c, [
    [x - s * 0.40, y + s * 0.20], [x - s * 0.40, y - s * 0.14], [x - s * 0.20, y + s * 0.02],
    [x, y - s * 0.30], [x + s * 0.20, y + s * 0.02], [x + s * 0.40, y - s * 0.14],
    [x + s * 0.40, y + s * 0.20],
  ], true);
  c.fill();
  c.fillStyle = '#C0392B';
  [-0.22, 0, 0.22].forEach((o) => { c.beginPath(); c.arc(x + o * s, y + s * 0.10, s * 0.045, 0, T); c.fill(); });
}

function halo(c, x, y, s, t) {
  const wob = Math.sin(t * 0.003) * s * 0.02;
  c.strokeStyle = '#FFE47A';
  c.lineWidth = Math.max(3, s * 0.055);
  c.shadowColor = 'rgba(255,225,120,0.9)';
  c.shadowBlur = s * 0.2;
  c.beginPath();
  c.ellipse(x, y + wob, s * 0.38, s * 0.13, 0, 0, T);
  c.stroke();
  c.shadowBlur = 0;
}

function sunglasses(c, x, y, s) {
  c.fillStyle = 'rgba(18,18,22,0.92)';
  [-1, 1].forEach((sx) => {
    c.beginPath();
    c.ellipse(x + sx * s * 0.22, y, s * 0.19, s * 0.14, 0, 0, T);
    c.fill();
  });
  c.strokeStyle = 'rgba(18,18,22,0.92)';
  c.lineWidth = Math.max(2, s * 0.03);
  c.beginPath(); c.moveTo(x - s * 0.04, y - s * 0.02); c.lineTo(x + s * 0.04, y - s * 0.02); c.stroke();
  c.beginPath(); c.moveTo(x - s * 0.41, y - s * 0.04); c.lineTo(x - s * 0.52, y - s * 0.10); c.stroke();
  c.beginPath(); c.moveTo(x + s * 0.41, y - s * 0.04); c.lineTo(x + s * 0.52, y - s * 0.10); c.stroke();
  // a highlight so the lenses look like glass
  c.fillStyle = 'rgba(255,255,255,0.22)';
  [-1, 1].forEach((sx) => {
    c.beginPath();
    c.ellipse(x + sx * s * 0.27, y - s * 0.05, s * 0.06, s * 0.03, -0.5, 0, T);
    c.fill();
  });
}

function kiss(c, x, y, s, t) {
  // lipstick marks landing on you, one after another
  const marks = [
    [-0.26, -0.18, 0.9, -0.3], [0.22, 0.04, 1.1, 0.25], [-0.06, 0.30, 0.8, 0.1],
    [0.30, -0.30, 0.7, 0.5], [-0.32, 0.16, 0.75, -0.15],
  ];
  marks.forEach(([mx, my, sc, rot], i) => {
    const appear = Math.min(1, Math.max(0, (t * 0.001 - i * 0.45)));
    if (appear <= 0) return;
    c.save();
    c.globalAlpha = 0.82 * Math.min(1, appear * 2);
    c.translate(x + mx * s, y + my * s);
    c.rotate(rot);
    const k = s * 0.11 * sc * (0.7 + 0.3 * Math.min(1, appear * 3));
    c.fillStyle = '#E11D48';
    c.beginPath();
    c.moveTo(0, -k * 0.35);
    c.bezierCurveTo(-k, -k * 1.1, -k * 1.5, k * 0.35, 0, k);
    c.bezierCurveTo(k * 1.5, k * 0.35, k, -k * 1.1, 0, -k * 0.35);
    c.fill();
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(-k * 0.9, -k * 0.06, k * 1.8, k * 0.12);
    c.restore();
  });
}

function flowerCrown(c, x, y, s, t) {
  const petals = ['#F9A8D4', '#FDE68A', '#A7F3D0', '#BFDBFE', '#DDD6FE'];
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i / 8) * Math.PI;
    const px = x + Math.cos(a) * s * 0.42;
    const py = y + Math.sin(a) * s * 0.30;
    const r = s * (0.055 + 0.02 * Math.sin(i * 2.1 + t * 0.002));
    c.fillStyle = petals[i % petals.length];
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * T;
      c.beginPath();
      c.ellipse(px + Math.cos(pa) * r * 0.8, py + Math.sin(pa) * r * 0.8, r * 0.62, r * 0.42, pa, 0, T);
      c.fill();
    }
    c.fillStyle = '#FBBF24';
    c.beginPath(); c.arc(px, py, r * 0.4, 0, T); c.fill();
  }
}

function tears(c, x, y, s, t) {
  for (let i = 0; i < 10; i++) {
    const phase = ((t * 0.0009) + i * 0.17) % 1;
    const sx = i % 2 ? 1 : -1;
    const tx = x + sx * s * 0.22 + Math.sin(i) * s * 0.03;
    const ty = y - s * 0.05 + phase * s * 0.6;
    const k = s * 0.10 * (1 - phase * 0.3);   // thin drops read as nothing at phone size
    c.fillStyle = 'rgba(96,165,250,' + (0.85 * (1 - phase)) + ')';
    c.beginPath();
    c.moveTo(tx, ty - k * 1.5);
    c.quadraticCurveTo(tx + k, ty + k * 0.4, tx, ty + k);
    c.quadraticCurveTo(tx - k, ty + k * 0.4, tx, ty - k * 1.5);
    c.fill();
  }
}

function fire(c, x, y, s, t) {
  for (let i = 0; i < 14; i++) {
    const ph = ((t * 0.0012) + i * 0.13) % 1;
    const fx = x + Math.sin(i * 2.3 + t * 0.002) * s * 0.32;
    const fy = y + s * 0.42 - ph * s * 0.9;
    const r = s * 0.09 * (1 - ph);
    const g = c.createRadialGradient(fx, fy, 0, fx, fy, Math.max(1, r));
    g.addColorStop(0, 'rgba(255,240,150,' + (0.9 * (1 - ph)) + ')');
    g.addColorStop(0.5, 'rgba(255,140,40,' + (0.6 * (1 - ph)) + ')');
    g.addColorStop(1, 'rgba(200,40,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(fx, fy, Math.max(1, r), 0, T); c.fill();
  }
}

function bubbles(c, x, y, s, t) {
  for (let i = 0; i < 12; i++) {
    const ph = ((t * 0.0006) + i * 0.09) % 1;
    const bx = x + Math.sin(i * 3.1 + ph * 4) * s * 0.42;
    const by = y + s * 0.5 - ph * s;
    const r = s * (0.03 + 0.035 * ((i % 4) / 3));
    c.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - ph)) + ')';
    c.lineWidth = Math.max(1, s * 0.008);
    c.beginPath(); c.arc(bx, by, r, 0, T); c.stroke();
    c.fillStyle = 'rgba(255,255,255,' + (0.35 * (1 - ph)) + ')';
    c.beginPath(); c.arc(bx - r * 0.35, by - r * 0.35, r * 0.22, 0, T); c.fill();
  }
}

/* The catalogue. `wear` lenses sit on a face; `scene` lenses sit
   anywhere and animate on their own. */
export const LENSES = [
  { id: 'beard',    label: 'Beard',        emoji: '🧔', kind: 'wear',  draw: (c, x, y, s) => beard(c, x, y, s) },
  { id: 'beard_gr', label: 'Grey beard',   emoji: '🎅', kind: 'wear',  draw: (c, x, y, s) => beard(c, x, y, s, '#D8D8D8') },
  { id: 'hijab',    label: 'Hijab',        emoji: '🧕', kind: 'wear',  draw: (c, x, y, s) => hijab(c, x, y, s) },
  { id: 'hijab_bk', label: 'Black hijab',  emoji: '🖤', kind: 'wear',  draw: (c, x, y, s) => hijab(c, x, y, s, '#22202A') },
  { id: 'dog',      label: 'Dog',          emoji: '🐶', kind: 'wear',  draw: (c, x, y, s) => dogEars(c, x, y, s) },
  { id: 'cat',      label: 'Cat',          emoji: '🐱', kind: 'wear',  draw: (c, x, y, s) => catWhiskers(c, x, y, s) },
  { id: 'shades',   label: 'Shades',       emoji: '🕶️', kind: 'wear',  draw: (c, x, y, s) => sunglasses(c, x, y, s) },
  { id: 'crown',    label: 'Crown',        emoji: '👑', kind: 'wear',  draw: (c, x, y, s) => crown(c, x, y, s) },
  { id: 'flowers',  label: 'Flower crown', emoji: '🌸', kind: 'wear',  draw: (c, x, y, s, t) => flowerCrown(c, x, y, s, t) },
  { id: 'halo',     label: 'Halo',         emoji: '😇', kind: 'wear',  draw: (c, x, y, s, t) => halo(c, x, y, s, t) },
  { id: 'kiss',     label: 'Kisses',       emoji: '💋', kind: 'scene', draw: (c, x, y, s, t) => kiss(c, x, y, s, t) },
  { id: 'tears',    label: 'Tears',        emoji: '😢', kind: 'scene', draw: (c, x, y, s, t) => tears(c, x, y, s, t) },
  { id: 'fire',     label: 'On fire',      emoji: '🔥', kind: 'scene', draw: (c, x, y, s, t) => fire(c, x, y, s, t) },
  { id: 'bubbles',  label: 'Bubbles',      emoji: '🫧', kind: 'scene', draw: (c, x, y, s, t) => bubbles(c, x, y, s, t) },
];

export const LENS_BY_ID = LENSES.reduce((m, l) => { m[l.id] = l; return m; }, {});

/* Draw a placed lens. `place` is { id, x, y, s } in 0..1 of the frame,
   so the same placement survives any resolution — preview, baked photo
   and video are all the same picture. */
export function drawLens(c, w, h, place, t) {
  if (!place || !place.id) return;
  const lens = LENS_BY_ID[place.id];
  if (!lens) return;
  const s = Math.max(24, place.s * Math.min(w, h));
  c.save();
  try { lens.draw(c, place.x * w, place.y * h, s, t || 0); } catch (e) {}
  c.restore();
}
