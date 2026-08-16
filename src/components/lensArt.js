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

/* ─── WHERE A FACE IS ─────────────────────────────────────────────────
   Every wearable used to carry its own idea of where to sit — an anchor
   in the lens table, a fit multiplier, and offsets inside its own
   drawing — and the three of them had to agree or a beard ended up on
   somebody's forehead. They did not agree.

   So there is one model of a face now, and everything is drawn against
   it. `s` is the face's WIDTH in pixels, (x, y) is the CENTRE of the
   face, and every landmark below is in units of s from that centre.
   A lens's drawing says where it goes; nothing outside it does.

   The numbers are an ordinary adult face: about a quarter taller than
   it is wide, eyes a little above the middle, mouth a little below. */
const F = {
  halfW: 0.50,     // temple to temple is s
  top: -0.66,      // the top of the head, hair included
  hair: -0.50,
  brow: -0.28,
  eyes: -0.14,
  nose: 0.10,
  mouth: 0.30,
  chin: 0.62,
};

function beard(c, x, y, s, tone = '#2A1A10') {
  // hangs off the jaw from ear to ear and finishes below the chin
  c.fillStyle = tone;
  c.beginPath();
  c.moveTo(x - s * 0.46, y + s * F.eyes);
  c.quadraticCurveTo(x - s * 0.44, y + s * (F.chin + 0.10), x, y + s * (F.chin + 0.22));
  c.quadraticCurveTo(x + s * 0.44, y + s * (F.chin + 0.10), x + s * 0.46, y + s * F.eyes);
  c.quadraticCurveTo(x + s * 0.24, y + s * (F.mouth + 0.06), x, y + s * (F.mouth + 0.04));
  c.quadraticCurveTo(x - s * 0.24, y + s * (F.mouth + 0.06), x - s * 0.46, y + s * F.eyes);
  c.fill();
  // the moustache, sitting under the nose
  c.beginPath();
  c.moveTo(x - s * 0.26, y + s * (F.nose + 0.04));
  c.quadraticCurveTo(x, y + s * (F.nose + 0.16), x + s * 0.26, y + s * (F.nose + 0.04));
  c.quadraticCurveTo(x, y + s * (F.nose + 0.24), x - s * 0.26, y + s * (F.nose + 0.04));
  c.fill();
  // a little sheen so it reads as hair and not a shape
  c.strokeStyle = 'rgba(255,255,255,0.10)';
  c.lineWidth = Math.max(1, s * 0.012);
  for (let i = -3; i <= 3; i++) {
    c.beginPath();
    c.moveTo(x + i * s * 0.09, y + s * (F.mouth + 0.06));
    c.quadraticCurveTo(x + i * s * 0.10, y + s * (F.chin - 0.04), x + i * s * 0.06, y + s * (F.chin + 0.12));
    c.stroke();
  }
}

function hijab(c, x, y, s, cloth = '#6D4AA8') {
  /* Cloth over the head and down onto the shoulders, with an opening
     the size of a face.

     The opening is a HOLE IN THE PATH, not an erased area. It used to
     be punched out with destination-out, which works over a transparent
     overlay and is a disaster on the baked photo: there the lens is
     drawn onto the picture itself, so the "opening" erased the face and
     left a black hole in the file. A hole in the path takes nothing
     away from what is underneath. */
  c.fillStyle = cloth;
  c.beginPath();
  c.moveTo(x - s * 0.66, y + s * 0.95);
  c.quadraticCurveTo(x - s * 0.74, y + s * (F.top - 0.10), x, y + s * (F.top - 0.20));
  c.quadraticCurveTo(x + s * 0.74, y + s * (F.top - 0.10), x + s * 0.66, y + s * 0.95);
  c.quadraticCurveTo(x, y + s * 0.72, x - s * 0.66, y + s * 0.95);
  c.closePath();
  c.moveTo(x + s * 0.45, y + s * 0.04);            // the face opening
  c.ellipse(x, y + s * 0.04, s * 0.45, s * 0.60, 0, 0, T, true);
  c.closePath();
  c.fill('evenodd');
  // a fold, so it reads as cloth
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.beginPath();
  c.moveTo(x - s * 0.66, y + s * 0.95);
  c.quadraticCurveTo(x - s * 0.44, y + s * 0.50, x - s * 0.50, y + s * F.brow);
  c.quadraticCurveTo(x - s * 0.62, y + s * 0.40, x - s * 0.66, y + s * 0.95);
  c.fill();
}

function dogEars(c, x, y, s) {
  /* Ears on the sides of the head, nose on the nose. These were one
     shape pinned to one point, which is how the ears ended up out past
     the edges of the picture and the nose landed on a forehead. */
  const ear = (sx) => {
    c.fillStyle = '#6B4A32';
    c.beginPath();
    c.moveTo(x + sx * s * 0.34, y + s * (F.top + 0.04));
    c.quadraticCurveTo(x + sx * s * 0.62, y + s * (F.brow), x + sx * s * 0.44, y + s * (F.eyes + 0.22));
    c.quadraticCurveTo(x + sx * s * 0.26, y + s * (F.brow - 0.10), x + sx * s * 0.34, y + s * (F.top + 0.04));
    c.fill();
    c.fillStyle = '#C89B79';
    c.beginPath();
    c.moveTo(x + sx * s * 0.36, y + s * (F.top + 0.12));
    c.quadraticCurveTo(x + sx * s * 0.52, y + s * (F.brow - 0.02), x + sx * s * 0.41, y + s * (F.eyes + 0.10));
    c.quadraticCurveTo(x + sx * s * 0.31, y + s * (F.brow - 0.06), x + sx * s * 0.36, y + s * (F.top + 0.12));
    c.fill();
  };
  ear(-1); ear(1);
  c.fillStyle = '#2A2A2A';
  c.beginPath(); c.ellipse(x, y + s * F.nose, s * 0.12, s * 0.09, 0, 0, T); c.fill();
  c.fillStyle = '#FF7C9B';
  c.beginPath();
  c.moveTo(x - s * 0.08, y + s * (F.mouth - 0.02));
  c.quadraticCurveTo(x, y + s * (F.chin - 0.02), x + s * 0.08, y + s * (F.mouth - 0.02));
  c.fill();
}

function catWhiskers(c, x, y, s) {
  c.fillStyle = '#3A3A3A';
  [-1, 1].forEach((sx) => {
    c.beginPath();
    c.moveTo(x + sx * s * 0.18, y + s * (F.top + 0.06));
    c.lineTo(x + sx * s * 0.36, y + s * (F.top - 0.26));
    c.lineTo(x + sx * s * 0.46, y + s * (F.top + 0.10));
    c.closePath(); c.fill();
  });
  c.fillStyle = '#FF9BB3';
  c.beginPath(); c.ellipse(x, y + s * F.nose, s * 0.075, s * 0.06, 0, 0, T); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = Math.max(1.4, s * 0.014);
  [-1, 1].forEach((sx) => {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(x + sx * s * 0.10, y + s * (F.nose + 0.04 + i * 0.05));
      c.lineTo(x + sx * s * 0.48, y + s * (F.nose - 0.06 + i * 0.10));
      c.stroke();
    }
  });
}

function crown(c, x, y, s) {
  // the band rests on the top of the head; the points go up from there
  const base = y + s * (F.top + 0.06);
  const g = c.createLinearGradient(x - s * 0.4, base, x + s * 0.4, base);
  g.addColorStop(0, '#F6C851'); g.addColorStop(0.5, '#FFF0A8'); g.addColorStop(1, '#E0A32B');
  c.fillStyle = g;
  path(c, [
    [x - s * 0.40, base], [x - s * 0.40, base - s * 0.34], [x - s * 0.20, base - s * 0.18],
    [x, base - s * 0.50], [x + s * 0.20, base - s * 0.18], [x + s * 0.40, base - s * 0.34],
    [x + s * 0.40, base],
  ], true);
  c.fill();
  c.fillStyle = '#C0392B';
  [-0.22, 0, 0.22].forEach((o) => { c.beginPath(); c.arc(x + o * s, base - s * 0.10, s * 0.045, 0, T); c.fill(); });
}

/* ── EGYPT, DRAWN THE SAME WAY AS EVERYTHING ELSE ──────────────────
   A nemes headcloth, a false beard, Nefertiti's crown, the kohl line
   and a broad collar. Every one of them is thousands of years old and
   every one of them is drawn here in code — so there is no photograph
   of a museum piece, no traced illustration and nobody's asset pack
   anywhere in this. That is the only way this ships.

   They are drawn as regalia, not as a costume of a people: gold, lapis
   and carnelian, in the proportions the originals use, and nothing
   that turns a face into a caricature of anybody alive. */

const GOLD = '#E3B23C';
const GOLD_HI = '#FFE9A8';
const LAPIS = '#1B4F9C';
const CARNELIAN = '#B7472A';

function nemes(c, x, y, s) {
  const top = y + s * (F.top - 0.26);
  const brow = y + s * (F.brow - 0.20);
  const halfW = s * 0.66;

  /* One silhouette — the cap over the skull and the two lappets that
     fall past the jaw — then the stripes are painted inside it. Drawing
     the stripes first and the shape after is how you get a striped
     rectangle with a head somewhere behind it. */
  c.save();
  c.beginPath();
  c.moveTo(x - halfW, brow + s * 0.10);
  c.quadraticCurveTo(x - halfW, top, x, top);                       // left of the cap
  c.quadraticCurveTo(x + halfW, top, x + halfW, brow + s * 0.10);   // right of the cap
  // right lappet, down beside the face and cut off square at the chest
  c.lineTo(x + s * 0.72, y + s * (F.chin + 0.26));
  c.lineTo(x + s * 0.46, y + s * (F.chin + 0.26));
  c.lineTo(x + s * 0.44, brow + s * 0.16);
  // across the brow band
  c.lineTo(x - s * 0.44, brow + s * 0.16);
  // left lappet
  c.lineTo(x - s * 0.46, y + s * (F.chin + 0.26));
  c.lineTo(x - s * 0.72, y + s * (F.chin + 0.26));
  c.closePath();
  c.clip();

  const w = halfW * 2.4;
  const step = s * 0.055;
  for (let i = 0; i * step < w; i++) {
    c.fillStyle = i % 2 ? LAPIS : GOLD;
    c.fillRect(x - w / 2 + i * step, top - s * 0.1, step + 0.5, s * 2.2);
  }
  c.restore();

  // the band across the brow, plain gold, the way the originals have it
  c.fillStyle = GOLD;
  c.fillRect(x - halfW * 0.98, brow - s * 0.02, halfW * 1.96, s * 0.14);
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.fillRect(x - halfW * 0.98, brow + s * 0.10, halfW * 1.96, s * 0.02);

  // ── the uraeus: the cobra rearing at the middle of the brow ──
  const ux = x;
  const uy = brow + s * 0.02;
  c.fillStyle = GOLD;
  c.beginPath();                                   // the body, coiled up
  c.moveTo(ux - s * 0.03, uy);
  c.quadraticCurveTo(ux - s * 0.10, uy - s * 0.10, ux - s * 0.01, uy - s * 0.14);
  c.quadraticCurveTo(ux + s * 0.07, uy - s * 0.17, ux + s * 0.05, uy - s * 0.09);
  c.quadraticCurveTo(ux + s * 0.04, uy - s * 0.04, ux + s * 0.03, uy);
  c.closePath();
  c.fill();
  c.fillStyle = CARNELIAN;                         // the hood
  c.beginPath();
  c.ellipse(ux + s * 0.005, uy - s * 0.135, s * 0.045, s * 0.035, 0, 0, T);
  c.fill();
  c.fillStyle = '#1A1A1A';
  [-1, 1].forEach((sx) => {
    c.beginPath();
    c.arc(ux + sx * s * 0.018, uy - s * 0.142, s * 0.008, 0, T);
    c.fill();
  });
}

function pharaohBeard(c, x, y, s) {
  // the false beard: narrow, straight, plaited, hooked slightly forward
  const topY = y + s * (F.chin + 0.02);
  const w = s * 0.135;
  c.fillStyle = GOLD;
  c.beginPath();
  c.moveTo(x - w, topY);
  c.lineTo(x - w * 1.18, topY + s * 0.30);
  c.quadraticCurveTo(x, topY + s * 0.46, x + w * 1.18, topY + s * 0.30);
  c.lineTo(x + w, topY);
  c.closePath();
  c.fill();
  // the plait, banded across
  c.strokeStyle = 'rgba(90,60,10,0.55)';
  c.lineWidth = Math.max(1, s * 0.012);
  for (let i = 1; i < 5; i++) {
    const yy = topY + s * 0.072 * i;
    c.beginPath();
    c.moveTo(x - w * (1 + i * 0.03), yy);
    c.lineTo(x + w * (1 + i * 0.03), yy);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,0.28)';          // one highlight down the left
  c.fillRect(x - w * 0.75, topY + s * 0.02, w * 0.26, s * 0.28);
}

function nefertitiCrown(c, x, y, s) {
  // the flat-topped crown, leaning back a little the way the bust does
  const base = y + s * (F.top + 0.16);
  const h = s * 0.54;
  c.fillStyle = LAPIS;
  c.beginPath();
  c.moveTo(x - s * 0.40, base);
  c.lineTo(x - s * 0.30, base - h);
  c.lineTo(x + s * 0.36, base - h);
  c.lineTo(x + s * 0.42, base);
  c.closePath();
  c.fill();
  // the gold band around the bottom, and the ribbon across the middle
  const g = c.createLinearGradient(x - s * 0.42, base, x + s * 0.42, base);
  g.addColorStop(0, GOLD); g.addColorStop(0.5, GOLD_HI); g.addColorStop(1, GOLD);
  c.fillStyle = g;
  c.fillRect(x - s * 0.42, base - s * 0.10, s * 0.84, s * 0.10);
  c.fillStyle = CARNELIAN;
  c.fillRect(x - s * 0.36, base - h * 0.62, s * 0.74, s * 0.05);
  c.fillStyle = GOLD;
  c.fillRect(x - s * 0.36, base - h * 0.62 - s * 0.03, s * 0.74, s * 0.03);
}

function horusKohl(c, x, y, s) {
  /* Kohl, not spectacles. The first version drew everything with the
     pen — a line over the lid, a line out to the temple, a line under
     the eye — and three thin lines around an eye is a pair of glasses,
     which is exactly what it looked like.

     So it is painted instead: a solid wedge along the lid that thickens
     as it leaves the eye, and a separate mark below. Kohl is a block of
     colour on a face, and it has to be drawn as one. */
  const e = y + s * F.eyes;
  c.fillStyle = '#141414';
  [-1, 1].forEach((sx) => {
    c.beginPath();                                   // lid line into the tail
    c.moveTo(x + sx * s * 0.08, e + s * 0.012);
    c.quadraticCurveTo(x + sx * s * 0.24, e - s * 0.075, x + sx * s * 0.52, e - s * 0.10);
    c.quadraticCurveTo(x + sx * s * 0.34, e - s * 0.012, x + sx * s * 0.30, e + s * 0.035);
    c.quadraticCurveTo(x + sx * s * 0.20, e + s * 0.055, x + sx * s * 0.08, e + s * 0.012);
    c.closePath();
    c.fill();

    c.beginPath();                                   // the mark under the eye
    c.moveTo(x + sx * s * 0.17, e + s * 0.075);
    c.quadraticCurveTo(x + sx * s * 0.235, e + s * 0.14, x + sx * s * 0.13, e + s * 0.20);
    c.quadraticCurveTo(x + sx * s * 0.20, e + s * 0.13, x + sx * s * 0.13, e + s * 0.085);
    c.closePath();
    c.fill();
  });
}

function wesekh(c, x, y, s) {
  // the broad collar, sitting on the chest under the chin
  const cy = y + s * (F.chin - 0.16);
  const rings = [
    [0.94, GOLD], [0.85, '#1FA6A0'], [0.76, GOLD], [0.67, CARNELIAN], [0.58, GOLD],
  ];
  rings.forEach(([r, col]) => {
    c.fillStyle = col;
    c.beginPath();
    c.arc(x, cy, s * r, 0.10 * Math.PI, 0.90 * Math.PI);
    c.arc(x, cy, s * (r - 0.085), 0.90 * Math.PI, 0.10 * Math.PI, true);
    c.closePath();
    c.fill();
  });
  // the beads hanging off the bottom edge
  c.fillStyle = GOLD;
  for (let i = 0; i <= 14; i++) {
    const a = 0.12 * Math.PI + (0.76 * Math.PI * i) / 14;
    c.beginPath();
    c.arc(x + Math.cos(a) * s * 0.985, cy + Math.sin(a) * s * 0.985, s * 0.026, 0, T);
    c.fill();
  }
}

function halo(c, x, y, s, t) {
  const wob = Math.sin(t * 0.003) * s * 0.02;
  c.strokeStyle = '#FFE47A';
  c.lineWidth = Math.max(3, s * 0.055);
  c.shadowColor = 'rgba(255,225,120,0.9)';
  c.shadowBlur = s * 0.2;
  c.beginPath();
  c.ellipse(x, y + s * (F.top - 0.26) + wob, s * 0.38, s * 0.13, 0, 0, T);
  c.stroke();
  c.shadowBlur = 0;
}

function sunglasses(c, x, y, s) {
  const e = y + s * F.eyes;
  c.fillStyle = 'rgba(18,18,22,0.92)';
  [-1, 1].forEach((sx) => {
    c.beginPath();
    c.ellipse(x + sx * s * 0.22, e, s * 0.19, s * 0.14, 0, 0, T);
    c.fill();
  });
  c.strokeStyle = 'rgba(18,18,22,0.92)';
  c.lineWidth = Math.max(2, s * 0.03);
  c.beginPath(); c.moveTo(x - s * 0.04, e - s * 0.02); c.lineTo(x + s * 0.04, e - s * 0.02); c.stroke();
  c.beginPath(); c.moveTo(x - s * 0.41, e - s * 0.04); c.lineTo(x - s * 0.50, e - s * 0.10); c.stroke();
  c.beginPath(); c.moveTo(x + s * 0.41, e - s * 0.04); c.lineTo(x + s * 0.50, e - s * 0.10); c.stroke();
  // a highlight so the lenses look like glass
  c.fillStyle = 'rgba(255,255,255,0.22)';
  [-1, 1].forEach((sx) => {
    c.beginPath();
    c.ellipse(x + sx * s * 0.27, e - s * 0.05, s * 0.06, s * 0.03, -0.5, 0, T);
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
    const px = x + Math.cos(a) * s * 0.46;
    const py = y + s * (F.top + 0.02) + Math.sin(a) * s * 0.16;
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
/* ── WHERE EACH ONE SITS ON A FACE ────────────────────────────────────
   Every wearable used to share one `kind`, so the code that places them
   from a detected face treated a beard exactly like a crown and hung it
   above the head. They are not the same thing.

   `on` says which part of the face the art is drawn around — it is a
   property of the drawing, so it belongs here beside it:

     head   the art is built around the top of the skull (crown, halo)
     brow   around the hairline (dog ears, hijab)
     eyes   around the eye line (shades, whiskers)
     mouth  around the upper lip (beards)

   `fit` is how wide the art is compared with the face itself: a hijab
   frames the whole head, a pair of glasses is a little wider than the
   eyes. Between them there is exactly one right size and one right
   place for any face, which is the point — nothing left to nudge. */
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
  /* ── Egypt ── the five below are also the ones لمّة offers when you
     take your face for the Egyptian pack. Tagged, so that screen can
     ask for them by name instead of knowing their ids. */
  { id: 'nemes',    label: 'Nemes',        emoji: '🇪🇬', kind: 'wear',  tag: 'egypt', draw: (c, x, y, s) => nemes(c, x, y, s) },
  { id: 'ph_beard', label: 'Royal beard',  emoji: '🪶', kind: 'wear',  tag: 'egypt', draw: (c, x, y, s) => pharaohBeard(c, x, y, s) },
  { id: 'nefertiti', label: 'Nefertiti',   emoji: '👸', kind: 'wear',  tag: 'egypt', draw: (c, x, y, s) => nefertitiCrown(c, x, y, s) },
  { id: 'kohl',     label: 'Kohl',         emoji: '👁️', kind: 'wear',  tag: 'egypt', draw: (c, x, y, s) => horusKohl(c, x, y, s) },
  { id: 'wesekh',   label: 'Gold collar',  emoji: '📿', kind: 'wear',  tag: 'egypt', draw: (c, x, y, s) => wesekh(c, x, y, s) },
  { id: 'kiss',     label: 'Kisses',       emoji: '💋', kind: 'scene', draw: (c, x, y, s, t) => kiss(c, x, y, s, t) },
  { id: 'tears',    label: 'Tears',        emoji: '😢', kind: 'scene', draw: (c, x, y, s, t) => tears(c, x, y, s, t) },
  { id: 'fire',     label: 'On fire',      emoji: '🔥', kind: 'scene', draw: (c, x, y, s, t) => fire(c, x, y, s, t) },
  { id: 'bubbles',  label: 'Bubbles',      emoji: '🫧', kind: 'scene', draw: (c, x, y, s, t) => bubbles(c, x, y, s, t) },
];

export const LENS_BY_ID = LENSES.reduce((m, l) => { m[l.id] = l; return m; }, {});

/* How far above or below the middle of a face each anchor sits,
   measured in face-diameters. A face is roughly as tall as it is wide,
   so these are the same numbers you would pace off on your own head. */
/* ── FROM A DETECTION TO A PLACEMENT ──────────────────────────────
   Everything here is in ONE coordinate system: the camera frame. The
   detector reports in it, the lens is stored in it, and the file that
   gets posted is drawn in it. The preview lines up because the overlay
   canvas is the same shape as the frame and is fitted over the video
   exactly the way the video itself is fitted — not because a second set
   of numbers happens to agree.

   That was the real fault behind lenses landing off a face. The video
   is shown with object-fit: cover, so a landscape camera frame in a
   portrait box has most of its width cropped away; the preview was
   drawing frame fractions as if they were box fractions, which squeezed
   every horizontal position toward the middle by the crop factor. The
   baked photo, drawn at the frame's own size, then put the lens
   somewhere else again — so what you saw was never what you posted.

   The detector's window is not the face either: it is a box around one,
   and it is wider than the face inside it. FACE_OF_BOX converts, and it
   is the only calibration left in the system. */
const FACE_OF_BOX = 1.20;

export function placeOnFace(lensId, face) {
  if (!LENS_BY_ID[lensId] || !face) return null;
  return {
    x: Math.max(0.02, Math.min(0.98, face.x)),
    y: Math.max(0.02, Math.min(0.98, face.y)),
    // face.size is the window's side as a fraction of the frame HEIGHT,
    // and s is the face's width in the same unit
    s: Math.max(0.06, Math.min(1.4, face.size * FACE_OF_BOX)),
  };
}

/* Draw a placed lens. `place` is { id, x, y, s } in 0..1 of the frame,
   so the same placement survives any resolution — preview, baked photo
   and video are all the same picture. */
export function drawLens(c, w, h, place, t) {
  if (!place || !place.id) return;
  const lens = LENS_BY_ID[place.id];
  if (!lens) return;
  /* Off the HEIGHT, not the short side. The detector measures a face
     against the frame's height, so measuring the art the same way keeps
     one unit from end to end whatever shape the frame is. */
  const s = Math.max(24, place.s * h);
  c.save();
  try { lens.draw(c, place.x * w, place.y * h, s, t || 0); } catch (e) {}
  c.restore();
}
