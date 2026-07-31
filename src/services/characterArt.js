/* ─── MOMENTS CHARACTER · the whole person, drawn by us ───────────────
   The round avatar in `avatarArt.js` is a face in a frame. This is the
   person it belongs to: standing, dressed, lit, and turnable.

   Three things make it read as three-dimensional without a 3D engine:

     1. Every surface is filled with a gradient across its width, lit
        from the upper left, with a rim of light on the far edge. A flat
        fill reads as paper; a gradient plus a rim reads as a solid.
     2. Contact shadows. A shape that touches another one darkens it —
        under the chin, under the sleeve, where the shoe meets the floor.
        Those are what stop a drawing from floating.
     3. Real rotation. Every feature is authored as a point on the
        body's surface — how far across (u) and how far forward (v) —
        and projected through the turn angle. Turn the character and
        the nose swings out, the far ear disappears behind the cheek,
        the near shoulder comes toward you. It isn't a second drawing
        of a side view; it's the same body, seen from somewhere else.

   Everything here is ours: shapes, proportions, palette, the lot. No
   art is downloaded, licensed or traced from anybody's avatar system,
   which is exactly why it can ship.

   Authored on a 100 wide × 160 tall grid and scaled to whatever size
   is asked for. */

import { parseDna, DEFAULT_DNA, SKIN_TONES, HAIR_COLORS } from './avatarArt';

/* ── the wardrobe ──────────────────────────────────────────────────
   Names describe the garment, not a brand. Every one of these is a
   handful of curves below — that is the whole point. */

export const BUILDS = [
  { id: 'm', label: 'Guy', emoji: '👨' },
  { id: 'f', label: 'Girl', emoji: '👩' },
  { id: 'n', label: 'Neither', emoji: '🧑' },
];

export const TOPS = [
  { id: 'tee', label: 'T-shirt' },
  { id: 'longsleeve', label: 'Long sleeve' },
  { id: 'turtleneck', label: 'Turtleneck' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'shirt', label: 'Button-up' },
  { id: 'polo', label: 'Polo' },
  { id: 'tank', label: 'Tank' },
  { id: 'crop', label: 'Crop top' },
  { id: 'jersey', label: 'Jersey' },
  { id: 'sweater', label: 'Sweater' },
  { id: 'blouse', label: 'Blouse' },
  { id: 'dress', label: 'Dress' },
  { id: 'abaya', label: 'Abaya' },
];

export const BOTTOMS = [
  { id: 'jeans', label: 'Jeans' },
  { id: 'wide', label: 'Wide leg' },
  { id: 'cargo', label: 'Cargo' },
  { id: 'joggers', label: 'Joggers' },
  { id: 'sweats', label: 'Sweatpants' },
  { id: 'chinos', label: 'Chinos' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'denimShorts', label: 'Denim shorts' },
  { id: 'skirt', label: 'Skirt' },
  { id: 'leggings', label: 'Leggings' },
];

export const SHOES = [
  { id: 'sneakers', label: 'Sneakers' },
  { id: 'hitops', label: 'Hi-tops' },
  { id: 'boots', label: 'Boots' },
  { id: 'dress', label: 'Dress shoes' },
  { id: 'loafers', label: 'Loafers' },
  { id: 'sandals', label: 'Sandals' },
  { id: 'heels', label: 'Heels' },
];

export const OUTERS = [
  { id: '', label: 'None' },
  { id: 'blazer', label: 'Blazer' },
  { id: 'suit', label: 'Suit jacket' },
  { id: 'denim', label: 'Denim jacket' },
  { id: 'bomber', label: 'Bomber' },
  { id: 'puffer', label: 'Puffer' },
  { id: 'cardigan', label: 'Cardigan' },
  { id: 'coat', label: 'Long coat' },
];

export const HATS = [
  { id: '', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'capBack', label: 'Cap backwards' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'bucket', label: 'Bucket hat' },
  { id: 'cowboy', label: 'Cowboy hat' },
  { id: 'crown', label: 'Crown' },
  { id: 'headphones', label: 'Headphones' },
];

/* A clothing palette that actually looks like clothes — muted denims,
   greys and earths alongside the brights, because an outfit made only
   of primary colours looks like a toy. */
export const WEAR_COLORS = [
  '#111827', '#1F2937', '#374151', '#6B7280', '#9CA3AF', '#E5E7EB', '#FFFFFF',
  '#1E3A5F', '#2E5A88', '#5B8DBE', '#9DBBD6',
  '#7C3AED', '#A855F7', '#EC4899', '#F472B6',
  '#B91C1C', '#E11D48', '#F97316', '#F5B301',
  '#065F46', '#10B981', '#84CC16',
  '#7C5E3C', '#A98C67', '#D6C0A0', '#F5E9D8',
];

export const DEFAULT_LOOK = {
  build: 'm',
  top: 'tee', topColor: '#7C3AED',
  bottom: 'jeans', bottomColor: '#2E5A88',
  shoes: 'sneakers', shoeColor: '#F4F4F5',
  outer: '', outerColor: '#111827',
  hat: '', hatColor: '#111827',
};

/* The look travels in the same DNA string as the face, so one field on
   the profile carries the whole person. Anything missing falls back to
   the old `outfit`/`outfitColor` pair, so avatars made before this
   existed still come out dressed and recognisable. */
export function parseLook(dnaIn) {
  const face = typeof dnaIn === 'string' ? parseDna(dnaIn) : { ...DEFAULT_DNA, ...(dnaIn || {}) };
  const raw = {};
  if (typeof dnaIn === 'string') {
    String(dnaIn).split(',').forEach((pair) => {
      const i = pair.indexOf('=');
      if (i > 0) raw[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
    });
  } else if (dnaIn) {
    Object.keys(DEFAULT_LOOK).forEach((k) => { if (dnaIn[k]) raw[k] = dnaIn[k]; });
  }

  const look = { ...DEFAULT_LOOK };
  Object.keys(DEFAULT_LOOK).forEach((k) => { if (raw[k]) look[k] = raw[k]; });

  // no explicit top? inherit the old single-garment choice
  if (!raw.top) {
    const carry = { tee: 'tee', hoodie: 'hoodie', jacket: 'longsleeve', shirt: 'shirt', tank: 'tank', dress: 'dress', jersey: 'jersey', abaya: 'abaya' };
    look.top = carry[face.outfit] || 'tee';
    if (face.outfit === 'jacket') look.outer = raw.outer || 'bomber';
  }
  if (!raw.topColor) look.topColor = face.outfitColor || DEFAULT_LOOK.topColor;
  if (!raw.outerColor) look.outerColor = shade(face.outfitColor || '#111827', -0.55);
  // a dress or abaya is the whole garment — no trousers underneath
  if (look.top === 'dress' || look.top === 'abaya') look.bottom = '';
  // the hijab is hair, not a hat; never stack a cap on top of it
  if (face.hair === 'hijab') look.hat = '';
  if (!raw.build) look.build = /^(dress|abaya|blouse|crop)$/.test(look.top)
    || /^(bob|bangs|long|wavyLong|ponytail|pigtails|hijab)$/.test(face.hair) ? 'f' : 'm';

  return { ...face, ...look };
}

/* Write a look back into the DNA string alongside the face. */
export function serializeLook(all) {
  const face = { ...DEFAULT_DNA, ...all };
  const look = { ...DEFAULT_LOOK, ...all };
  const parts = [];
  Object.keys(DEFAULT_DNA).forEach((k) => parts.push(k + '=' + encodeURIComponent(face[k])));
  Object.keys(DEFAULT_LOOK).forEach((k) => parts.push(k + '=' + encodeURIComponent(look[k])));
  return parts.join(',');
}

/* ── light and paint ───────────────────────────────────────────────
   One light, from the upper left and slightly in front. Everything
   below obeys it, which is the only reason the shapes hold together. */

function shade(hex, amt) {
  const h = String(hex || '#888888').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (isNaN(n)) return '#888888';
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const mix = (v) => (amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  const r = cl(mix((n >> 16) & 255));
  const g = cl(mix((n >> 8) & 255));
  const b = cl(mix(n & 255));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* How bright a colour is, 0–1 — used to decide whether a detail needs
   to go lighter or darker than what it sits on. */
function lum(hex) {
  const h = String(hex || '#888888').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  if (isNaN(n)) return 0.5;
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const rgba = (hex, a) => {
  const h = String(hex || '#000').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
};

/* A body-coloured gradient across a shape's width: lit edge, base
   colour, shaded edge, then a thin rim of bounce light on the far
   side. This single function is what makes cloth look like cloth. */
function volume(c, x0, x1, col, lift) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  const up = lift === undefined ? 0.30 : lift;
  g.addColorStop(0.00, shade(col, up * 0.6));
  g.addColorStop(0.22, shade(col, up));
  g.addColorStop(0.55, col);
  g.addColorStop(0.88, shade(col, -0.34));
  g.addColorStop(1.00, shade(col, -0.10));   // rim light off the far edge
  return g;
}

/* Vertical falloff — used where a form turns away downward (the top of
   a shoulder, the crown of a head). */
function domeShade(c, y0, y1, col) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(col, 0.26));
  g.addColorStop(0.5, col);
  g.addColorStop(1, shade(col, -0.30));
  return g;
}

const ell = (c, x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2); };

function rr(c, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

/* Soft contact shadow: a blurred-looking smear where two forms meet.
   Canvas 2D has no cheap blur, so it's stacked translucent ellipses —
   three passes is enough to lose the edge. */
function contact(c, x, y, rx, ry, strength) {
  for (let i = 3; i >= 1; i--) {
    c.fillStyle = 'rgba(0,0,0,' + (strength / 6) + ')';
    ell(c, x, y, rx * (0.6 + i * 0.18), ry * (0.6 + i * 0.18));
    c.fill();
  }
}

/* ── the build ─────────────────────────────────────────────────────
   Three silhouettes, differing in shoulder width, waist and hip. They
   are proportions, not stereotypes: "Neither" sits between the two and
   wears everything the other two wear. */
function figureOf(build) {
  if (build === 'f') return { shoulder: 17.0, chest: 15.8, waist: 12.8, hip: 16.6, thigh: 6.8, calf: 5.0, arm: 3.6, neck: 3.6, headW: 19.4, headH: 21.6 };
  if (build === 'n') return { shoulder: 18.4, chest: 17.0, waist: 14.2, hip: 15.8, thigh: 7.1, calf: 5.2, arm: 4.0, neck: 4.0, headW: 19.8, headH: 21.8 };
  return { shoulder: 20.2, chest: 18.4, waist: 15.4, hip: 15.4, thigh: 7.4, calf: 5.4, arm: 4.4, neck: 4.4, headW: 20.0, headH: 22.0 };
}

/* ── the turn ──────────────────────────────────────────────────────
   `turn` runs −1 (full left profile) → 0 (facing you) → 1 (full right
   profile). A point on the body is authored as (u, v): u is how far
   across, −1 to 1; v is how far forward, 1 being the front surface.
   Projecting it through the turn is one line, and it is the line that
   makes the whole thing turn instead of flipping between two pictures. */
function turnOf(turn) {
  const t = Math.max(-1, Math.min(1, turn || 0));
  const a = t * Math.PI / 2;
  return { t, ct: Math.cos(a), st: Math.sin(a) };
}
const DEPTH = 0.62;                       // a body is about 3/5 as deep as it is wide

const proj = (T, u, v, halfW) => u * halfW * T.ct + v * halfW * DEPTH * T.st;
// how much of a front-facing detail survives the turn (labels, prints, zips)
const facing = (T) => Math.max(0, T.ct);

/* ── THE CHARACTER ─────────────────────────────────────────────────
   Draws into a 100 × 160 box at (ox, oy), scaled to (w, h). */
export function drawCharacter(c, ox, oy, w, h, dnaIn, opts) {
  const o = opts || {};
  const d = parseLook(dnaIn);
  const T = turnOf(o.turn);
  const F = figureOf(d.build);

  const skin = d.skin || SKIN_TONES[1];
  const hairCol = d.hairColor || HAIR_COLORS[1];
  const topCol = d.topColor;
  const botCol = d.bottomColor;
  const shoeCol = d.shoeColor;
  const outerCol = d.outerColor;

  c.save();
  c.translate(ox, oy);
  c.scale(w / 100, h / 160);

  /* Proportions are the whole personality of a character. These are
     deliberately stylised — a big head on a compact body, the way a
     cartoon reads at 40px on a map pin, where a realistic 7-heads-tall
     figure would just be a smudge. */
  const CX = 50;
  const shoulderY = 58;
  const chestY = 68;
  const waistY = 84;
  const hipY = 95;
  const kneeY = 120;
  const ankleY = 142;
  const floorY = 152;

  /* ground shadow — an ellipse that shrinks and shifts as the figure
     turns, because a turned body casts a narrower shadow */
  if (o.shadow !== false) {
    const sw = (F.hip * 1.55) * (T.ct + DEPTH * Math.abs(T.st));
    const g = c.createRadialGradient(CX, floorY + 2, 1, CX, floorY + 2, sw);
    g.addColorStop(0, 'rgba(0,0,0,0.30)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.13)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    ell(c, CX, floorY + 2, sw, sw * 0.26);
    c.fill();
  }

  /* Which arm is nearer the viewer. Turning right (st > 0) brings the
     character's left arm forward; the other one goes behind the body
     and is drawn first so the torso covers it. */
  const nearSide = T.st >= 0 ? 1 : -1;
  const farSide = -nearSide;

  const wearsTrousers = !!d.bottom && d.top !== 'dress' && d.top !== 'abaya';
  const longGarment = d.top === 'dress' || d.top === 'abaya' || d.outer === 'coat';

  /* ── legs ──────────────────────────────────────────────────────── */
  const drawLeg = (side, near) => {
    const u = side * 0.46;
    const vFwd = near ? 0.30 : -0.30;          // the near leg steps forward
    const x = CX + proj(T, u, vFwd, F.hip);
    const dim = near ? 0 : -0.16;              // the far leg sits in shade

    const legW = F.thigh * (T.ct * 0.55 + 0.45);   // narrows as it turns edge-on
    const calfW = F.calf * (T.ct * 0.55 + 0.45);

    /* The leg itself is always drawn, whatever is going over it. A
       garment that stops at the knee then simply doesn't reach — which
       is why shorts and skirts show leg instead of nothing at all. */
    const hemY = !wearsTrousers ? 0
      : /^(shorts|denimShorts)$/.test(d.bottom) ? 116
        : d.bottom === 'skirt' ? 0 : ankleY;      // a skirt is one piece, drawn below

    // thigh + calf as one tapered form, so the knee reads
    c.fillStyle = volume(c, x - legW * 1.25, x + legW * 1.25, shade(skin, dim));
    c.beginPath();
    c.moveTo(x - legW, hipY - 2);
    c.quadraticCurveTo(x - legW * 0.92, kneeY, x - calfW, ankleY);
    c.lineTo(x + calfW, ankleY);
    c.quadraticCurveTo(x + legW * 0.92, kneeY, x + legW, hipY - 2);
    c.closePath();
    c.fill();
    // the knee catches the light — without this a leg is a tube
    c.fillStyle = rgba('#FFFFFF', 0.10);
    ell(c, x - legW * 0.15, kneeY - 2, legW * 0.55, 4);
    c.fill();

    if (hemY > hipY + 4) {
      const flare = d.bottom === 'wide' ? 1.55 : d.bottom === 'cargo' ? 1.32 : d.bottom === 'joggers' || d.bottom === 'sweats' ? 1.18 : 1.0;
      const cuff = d.bottom === 'joggers' || d.bottom === 'sweats' ? 0.78 : flare;
      const hipW = legW * 1.16;
      const hemW = calfW * flare * 1.12;
      c.fillStyle = volume(c, x - hipW * 1.3, x + hipW * 1.3, shade(botCol, dim));
      c.beginPath();
      c.moveTo(x - hipW, hipY - 6);
      c.quadraticCurveTo(x - hipW * 1.02, kneeY, x - hemW, hemY);
      c.lineTo(x + hemW, hemY);
      c.quadraticCurveTo(x + hipW * 1.02, kneeY, x + hipW, hipY - 6);
      c.closePath();
      c.fill();

      if (d.bottom === 'cargo') {                       // side pockets
        c.fillStyle = rgba('#000000', 0.16);
        rr(c, x - hipW * 0.95, kneeY - 16, hipW * 0.62, 13, 2.5); c.fill();
        rr(c, x + hipW * 0.33, kneeY - 16, hipW * 0.62, 13, 2.5); c.fill();
      }
      if (d.bottom === 'jeans' || d.bottom === 'wide' || d.bottom === 'denimShorts') {
        c.strokeStyle = rgba('#FFFFFF', 0.20);          // denim seam
        c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(x, hipY - 4); c.lineTo(x, hemY - 2); c.stroke();
      }
      if (cuff !== flare) {                              // elasticated cuff
        c.fillStyle = shade(botCol, -0.22 + dim);
        rr(c, x - calfW * cuff * 1.15, hemY - 7, calfW * cuff * 2.3, 7, 2.5); c.fill();
      }
      // where the leg meets the body
      contact(c, x, hipY - 3, hipW * 0.9, 3, 0.5);
    }

    /* ── shoe ── */
    const toeV = 1.0;                                    // toes point forward
    const toeX = x + proj(T, 0, toeV, F.calf * 1.5);
    const heelX = x + proj(T, 0, -0.55, F.calf * 1.5);
    const sc = shade(shoeCol, dim);
    const shoeH = d.shoes === 'heels' ? 6 : d.shoes === 'boots' ? 14 : d.shoes === 'hitops' ? 11 : 8;
    const top = floorY - shoeH;
    const toeOut = calfW * (1.15 + 0.55 * Math.abs(T.st));   // a shoe seen side-on is long

    c.fillStyle = volume(c, Math.min(heelX, toeX) - 3, Math.max(heelX, toeX) + 3, sc);
    c.beginPath();
    c.moveTo(heelX - calfW * 1.0, top);
    c.lineTo(toeX + calfW * 0.55, top + shoeH * 0.42);
    c.quadraticCurveTo(toeX + toeOut, floorY - 1, toeX + toeOut * 0.35, floorY);
    c.lineTo(heelX - calfW * 1.0, floorY);
    c.closePath();
    c.fill();

    if (d.shoes === 'sandals') {                          // straps, not a shell
      c.fillStyle = 'rgba(255,255,255,0.001)';
    } else if (d.shoes !== 'heels') {                     // sole
      c.fillStyle = shade(sc, d.shoes === 'dress' || d.shoes === 'loafers' ? -0.5 : 0.55);
      c.beginPath();
      c.moveTo(heelX - calfW * 1.05, floorY - 2.6);
      c.lineTo(toeX + toeOut * 0.9, floorY - 2.6);
      c.quadraticCurveTo(toeX + toeOut, floorY, toeX + toeOut * 0.35, floorY);
      c.lineTo(heelX - calfW * 1.05, floorY);
      c.closePath();
      c.fill();
    }
    if (d.shoes === 'heels') {                            // the heel itself
      c.fillStyle = shade(sc, -0.4);
      c.fillRect(heelX - calfW * 0.75, floorY - 5.5, 1.6, 5.5);
    }
    if (d.shoes === 'hitops' || d.shoes === 'boots') {     // laces
      c.strokeStyle = rgba('#FFFFFF', 0.55 * facing(T) + 0.1);
      c.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(x - calfW * 0.7, top + 2 + i * 2.6);
        c.lineTo(x + calfW * 0.7, top + 3.4 + i * 2.6);
        c.stroke();
      }
    }
    contact(c, (toeX + heelX) / 2, floorY, calfW * 1.6, 1.6, 0.7);
  };

  drawLeg(farSide, false);
  drawLeg(nearSide, true);

  /* A skirt isn't two trouser legs — it's one cone hanging off the
     hips, and it has to be drawn after both legs so it covers them. */
  if (wearsTrousers && d.bottom === 'skirt') {
    const hipHalfS = F.hip * T.ct + F.hip * DEPTH * Math.abs(T.st);
    c.fillStyle = volume(c, CX - hipHalfS * 1.5, CX + hipHalfS * 1.5, botCol);
    c.beginPath();
    c.moveTo(CX - hipHalfS * 0.92, hipY - 10);
    c.quadraticCurveTo(CX - hipHalfS * 1.34, hipY + 4, CX - hipHalfS * 1.42, 116);
    c.quadraticCurveTo(CX, 121, CX + hipHalfS * 1.42, 116);
    c.quadraticCurveTo(CX + hipHalfS * 1.34, hipY + 4, CX + hipHalfS * 0.92, hipY - 10);
    c.closePath();
    c.fill();
    // pleats, so it reads as cloth rather than a cone
    c.strokeStyle = rgba('#000000', 0.13);
    c.lineWidth = 0.9;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(CX + i * hipHalfS * 0.34, hipY - 6);
      c.lineTo(CX + i * hipHalfS * 0.52, 115);
      c.stroke();
    }
    contact(c, CX, 117, hipHalfS * 1.2, 2.4, 0.45);
  }

  /* ── the far arm, behind the body ──────────────────────────────── */
  const sleeveLen = /^(tank|crop)$/.test(d.top) ? 0
    : /^(tee|polo|jersey|blouse)$/.test(d.top) ? 0.34 : 1;
  const outerSleeve = d.outer ? 1 : 0;

  const drawArm = (side, near) => {
    const u = side * 1.06;   // hangs clear of the torso, not buried in it
    const vFwd = near ? 0.34 : -0.34;
    const topX = CX + proj(T, u, vFwd, F.shoulder);
    const handX = CX + proj(T, u * 1.02, vFwd * 1.1, F.hip);
    const dim = near ? 0 : -0.18;
    const armW = F.arm * (T.ct * 0.5 + 0.5);

    const path = () => {
      c.beginPath();
      c.moveTo(topX - armW, shoulderY + 2);
      c.quadraticCurveTo(topX + side * armW * 0.9, waistY + 4, handX - armW * 0.85, hipY + 6);
      c.lineTo(handX + armW * 0.85, hipY + 6);
      c.quadraticCurveTo(topX + side * armW * 0.9 + armW * 2, waistY + 4, topX + armW, shoulderY + 2);
      c.closePath();
    };

    // bare arm
    c.fillStyle = volume(c, topX - armW * 1.6, topX + armW * 1.6, shade(skin, dim));
    path();
    c.fill();

    // hand
    c.fillStyle = volume(c, handX - armW * 1.5, handX + armW * 1.5, shade(skin, dim - 0.04));
    ell(c, handX, hipY + 8.5, armW * 1.02, armW * 1.35);
    c.fill();

    // sleeve
    const sl = outerSleeve ? 1 : sleeveLen;
    const sleeveCol = outerSleeve ? outerCol : topCol;
    if (sl > 0) {
      const endY = shoulderY + (hipY + 4 - shoulderY) * sl;
      const wide = armW * (outerSleeve ? 1.5 : d.top === 'hoodie' || d.top === 'sweater' ? 1.42 : 1.28);
      c.save();
      c.beginPath();
      c.rect(topX - wide * 2.4, shoulderY - 4, wide * 4.8, endY - shoulderY + 4);
      c.clip();
      c.fillStyle = volume(c, topX - wide * 1.6, topX + wide * 1.6, shade(sleeveCol, dim));
      c.beginPath();
      c.moveTo(topX - wide, shoulderY - 2);
      c.quadraticCurveTo(topX + side * armW * 0.9 - wide + armW, waistY + 4, handX - wide * 0.86, hipY + 8);
      c.lineTo(handX + wide * 0.86, hipY + 8);
      c.quadraticCurveTo(topX + side * armW * 0.9 + wide + armW, waistY + 4, topX + wide, shoulderY - 2);
      c.closePath();
      c.fill();
      c.restore();
      // the deltoid: a sleeve cut off square at the top reads as a tab
      // stuck on the side, so round it over the shoulder joint
      c.fillStyle = domeShade(c, shoulderY - 7, shoulderY + 9, shade(sleeveCol, dim));
      ell(c, topX, shoulderY + 2.5, wide * 1.04, 7);
      c.fill();
      // cuff shadow where the sleeve ends on skin
      if (sl < 1) contact(c, topX + (handX - topX) * sl, endY, wide * 1.1, 1.6, 0.55);
    } else {
      // bare shoulder still needs the round of the deltoid
      c.fillStyle = domeShade(c, shoulderY - 6, shoulderY + 10, shade(skin, dim));
      ell(c, topX, shoulderY + 3, armW * 1.15, 6.5);
      c.fill();
    }

    /* The seam where the arm meets the body. Without it an arm in the
       same colour as the top vanishes into it and the figure loses its
       silhouette — which is exactly what happened before this line. */
    if (near) {
      c.save();
      c.strokeStyle = 'rgba(0,0,0,0.22)';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(topX - side * armW * 1.5, shoulderY + 1);
      c.quadraticCurveTo(topX - side * armW * 2.0, chestY + 6, topX - side * armW * 1.2, waistY);
      c.stroke();
      c.restore();
    }
  };

  drawArm(farSide, false);

  /* ── torso ─────────────────────────────────────────────────────── */
  const shoulderHalf = F.shoulder * T.ct + F.shoulder * DEPTH * Math.abs(T.st) * 0.9;
  const chestHalf = F.chest * T.ct + F.chest * DEPTH * Math.abs(T.st) * 0.95;
  const waistHalf = F.waist * T.ct + F.waist * DEPTH * Math.abs(T.st);
  const hipHalf = F.hip * T.ct + F.hip * DEPTH * Math.abs(T.st) * 0.95;
  // a turned body's centre of mass shifts: the spine moves back
  const lean = -T.st * F.chest * 0.12;

  const torsoPath = (bottomY, flare) => {
    const k = flare || 1;
    c.beginPath();
    c.moveTo(CX + lean - shoulderHalf, shoulderY);
    c.quadraticCurveTo(CX + lean - chestHalf * 1.03, chestY, CX + lean - waistHalf, waistY);
    c.quadraticCurveTo(CX + lean - hipHalf * 1.02, hipY - 6, CX + lean - hipHalf * k, bottomY);
    c.lineTo(CX + lean + hipHalf * k, bottomY);
    c.quadraticCurveTo(CX + lean + hipHalf * 1.02, hipY - 6, CX + lean + waistHalf, waistY);
    c.quadraticCurveTo(CX + lean + chestHalf * 1.03, chestY, CX + lean + shoulderHalf, shoulderY);
    // the shoulder line itself, curved over the trapezius
    c.quadraticCurveTo(CX + lean, shoulderY - 6.5, CX + lean - shoulderHalf, shoulderY);
    c.closePath();
  };

  const bodyBottom = d.top === 'abaya' ? 146 : d.top === 'dress' ? 106 : d.top === 'crop' ? 74 : hipY + 3;
  const bodyFlare = d.top === 'abaya' ? 1.5 : d.top === 'dress' ? 1.35 : 1;

  // bare chest first, so a tank or crop top shows real skin
  c.fillStyle = volume(c, CX + lean - chestHalf * 1.2, CX + lean + chestHalf * 1.2, skin);
  torsoPath(hipY + 3, 1);
  c.fill();

  // the garment
  c.fillStyle = volume(c, CX + lean - chestHalf * 1.2, CX + lean + chestHalf * 1.2, topCol);
  torsoPath(bodyBottom, bodyFlare);
  c.fill();

  // a soft dome across the chest so it isn't a flat panel
  c.save();
  torsoPath(bodyBottom, bodyFlare);
  c.clip();
  c.fillStyle = domeShade(c, shoulderY - 4, chestY + 14, rgba('#FFFFFF', 0));
  const sheen = c.createLinearGradient(0, shoulderY - 4, 0, waistY);
  sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sheen;
  c.fillRect(0, shoulderY - 8, 100, waistY);
  // fabric folds gathering at the waist
  c.strokeStyle = 'rgba(0,0,0,0.10)';
  c.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) {
    c.beginPath();
    c.moveTo(CX + lean + i * waistHalf * 0.5, waistY - 8);
    c.quadraticCurveTo(CX + lean + i * waistHalf * 0.62, waistY + 2, CX + lean + i * waistHalf * 0.5, waistY + 10);
    c.stroke();
  }
  c.restore();

  drawTopDetail(c, d, T, { CX: CX + lean, shoulderY, chestY, waistY, hipY, shoulderHalf, chestHalf, waistHalf, topCol, skin, bodyBottom });

  /* ── the outer layer (jacket, blazer, coat) ─────────────────────── */
  if (d.outer) drawOuter(c, d, T, { CX: CX + lean, shoulderY, chestY, waistY, hipY, shoulderHalf, chestHalf, waistHalf, hipHalf, outerCol });

  /* ── the near arm, in front of the body ────────────────────────── */
  drawArm(nearSide, true);

  /* ── neck and head ─────────────────────────────────────────────── */
  const headCY = 25;
  const headRX = F.headW;
  const headRY = F.headH;
  const neckX = CX + proj(T, 0, 0.12, F.neck * 2);

  // neck — always in the shadow the jaw casts on it
  c.fillStyle = volume(c, neckX - F.neck * 1.4, neckX + F.neck * 1.4, shade(skin, -0.16));
  rr(c, neckX - F.neck, headCY + headRY * 0.62, F.neck * 2, 16, F.neck * 0.6);
  c.fill();
  contact(c, neckX, headCY + headRY * 0.72, F.neck * 1.5, 2.4, 0.8);
  // collar shadow on the chest
  contact(c, CX + lean, shoulderY + 2, chestHalf * 0.55, 3, 0.55);

  drawHead(c, d, T, { cx: CX + proj(T, 0, 0.06, F.headW), cy: headCY, rx: headRX, ry: headRY, skin, hairCol });

  c.restore();
}

/* ── what makes one top different from another ────────────────────── */
function drawTopDetail(c, d, T, g) {
  const f = facing(T);
  const { CX, shoulderY, chestY, waistY, shoulderHalf, chestHalf, topCol, skin } = g;
  c.save();

  const neckline = (depth, wide) => {
    c.fillStyle = volume(c, CX - wide, CX + wide, shade(skin, -0.10));
    c.beginPath();
    c.ellipse(CX, shoulderY - 1, wide * f + 0.6, depth * f + 0.4, 0, 0, Math.PI);
    c.fill();
  };

  if (d.top === 'tee' || d.top === 'longsleeve' || d.top === 'jersey' || d.top === 'sweater') {
    neckline(4.2, chestHalf * 0.30);
  } else if (d.top === 'turtleneck') {
    c.fillStyle = volume(c, CX - chestHalf * 0.4, CX + chestHalf * 0.4, shade(topCol, -0.12));
    rr(c, CX - chestHalf * 0.30 * f - 1, shoulderY - 9, (chestHalf * 0.60 * f + 2), 11, 3); c.fill();
  } else if (d.top === 'hoodie') {
    // the hood, bunched behind the neck
    c.fillStyle = volume(c, CX - chestHalf * 0.7, CX + chestHalf * 0.7, shade(topCol, -0.26));
    c.beginPath();
    c.ellipse(CX, shoulderY - 1, chestHalf * 0.62 * (0.5 + f * 0.5), 6.5, 0, Math.PI, 0);
    c.fill();
    neckline(3.4, chestHalf * 0.24);
    if (f > 0.25) {                       // drawstrings + pocket
      c.strokeStyle = rgba('#FFFFFF', 0.55 * f);
      c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(CX - 3.4 * f, shoulderY + 3); c.lineTo(CX - 4.2 * f, chestY + 8); c.stroke();
      c.beginPath(); c.moveTo(CX + 3.4 * f, shoulderY + 3); c.lineTo(CX + 4.2 * f, chestY + 8); c.stroke();
      c.fillStyle = rgba('#000000', 0.15 * f);
      rr(c, CX - chestHalf * 0.52 * f, waistY - 6, chestHalf * 1.04 * f, 12, 3); c.fill();
    }
  } else if (d.top === 'shirt' || d.top === 'blouse') {
    neckline(2.6, chestHalf * 0.22);
    if (f > 0.2) {
      // collar
      c.fillStyle = shade(topCol, 0.16);
      c.beginPath();
      c.moveTo(CX - chestHalf * 0.30 * f, shoulderY - 2);
      c.lineTo(CX, shoulderY + 8);
      c.lineTo(CX - chestHalf * 0.05 * f, shoulderY - 3.5);
      c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(CX + chestHalf * 0.30 * f, shoulderY - 2);
      c.lineTo(CX, shoulderY + 8);
      c.lineTo(CX + chestHalf * 0.05 * f, shoulderY - 3.5);
      c.closePath(); c.fill();
      // placket + buttons
      c.fillStyle = shade(topCol, -0.18);
      c.fillRect(CX - 1.4 * f, shoulderY + 4, 2.8 * f, waistY - shoulderY + 6);
      c.fillStyle = shade(topCol, 0.45);
      for (let y = chestY; y < waistY + 6; y += 8) { ell(c, CX, y, 0.85 * f, 0.85); c.fill(); }
    }
  } else if (d.top === 'polo') {
    neckline(3, chestHalf * 0.22);
    if (f > 0.2) {
      c.fillStyle = shade(topCol, 0.2);
      rr(c, CX - chestHalf * 0.30 * f, shoulderY - 3, chestHalf * 0.60 * f, 4.5, 1.6); c.fill();
      c.fillStyle = shade(topCol, -0.2);
      c.fillRect(CX - 1.1 * f, shoulderY + 1, 2.2 * f, 9);
    }
  } else if (d.top === 'tank' || d.top === 'crop') {
    // straps over bare shoulders
    c.fillStyle = volume(c, CX - chestHalf, CX + chestHalf, shade(skin, -0.06));
    c.beginPath();
    c.ellipse(CX, shoulderY - 1, chestHalf * 0.52 * f + 0.6, 7 * f + 0.5, 0, 0, Math.PI);
    c.fill();
    c.fillStyle = volume(c, CX - chestHalf, CX + chestHalf, topCol);
    [-1, 1].forEach((s) => {
      c.beginPath();
      c.moveTo(CX + s * chestHalf * 0.52 * f, shoulderY - 2);
      c.quadraticCurveTo(CX + s * chestHalf * 0.42 * f, chestY - 4, CX + s * chestHalf * 0.30 * f, chestY + 2);
      c.lineTo(CX + s * chestHalf * 0.56 * f, chestY + 2);
      c.quadraticCurveTo(CX + s * chestHalf * 0.66 * f, chestY - 4, CX + s * chestHalf * 0.76 * f, shoulderY - 1);
      c.closePath(); c.fill();
    });
  } else if (d.top === 'dress' || d.top === 'abaya') {
    neckline(3.4, chestHalf * 0.26);
    if (d.top === 'abaya' && f > 0.2) {     // a panel of trim down the front
      c.fillStyle = shade(topCol, -0.3);
      c.fillRect(CX - 1.8 * f, shoulderY + 4, 3.6 * f, g.bodyBottom - shoulderY - 8);
    }
    if (d.top === 'dress') {                 // waistline
      c.strokeStyle = rgba('#000000', 0.18);
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(CX - g.waistHalf, waistY - 2);
      c.quadraticCurveTo(CX, waistY + 1, CX + g.waistHalf, waistY - 2);
      c.stroke();
    }
  }

  if (d.top === 'jersey' && f > 0.3) {       // a number, ours, meaning nothing
    c.fillStyle = rgba('#FFFFFF', 0.85 * f);
    c.font = '900 16px system-ui, sans-serif';
    c.textAlign = 'center';
    c.save(); c.scale(f, 1);
    c.fillText('7', CX / f, chestY + 10);
    c.restore();
  }
  c.restore();
}

/* ── jackets, blazers, coats ──────────────────────────────────────── */
function drawOuter(c, d, T, g) {
  const f = facing(T);
  const { CX, shoulderY, chestY, waistY, hipY, shoulderHalf, chestHalf, waistHalf, hipHalf, outerCol } = g;
  const bottomY = d.outer === 'coat' ? 124 : d.outer === 'blazer' || d.outer === 'suit' ? hipY + 10 : hipY + 2;
  const puffy = d.outer === 'puffer';
  const pad = puffy ? 3.2 : d.outer === 'coat' ? 1.6 : 1.2;

  // the two front panels, hanging open down the middle
  const panel = (side) => {
    const inner = CX + side * chestHalf * (d.outer === 'blazer' || d.outer === 'suit' ? 0.10 : 0.05) * f;
    c.fillStyle = volume(c, CX - chestHalf - pad, CX + chestHalf + pad, outerCol);
    c.beginPath();
    // start inboard and curve out over the shoulder, or the jacket
    // ends in a square tab sticking off each side
    c.moveTo(CX + side * (shoulderHalf + pad) * 0.55, shoulderY - 5);
    c.quadraticCurveTo(CX + side * (shoulderHalf + pad), shoulderY - 3.5, CX + side * (shoulderHalf + pad), shoulderY + 2);
    c.quadraticCurveTo(CX + side * (chestHalf + pad) * 1.04, chestY, CX + side * (waistHalf + pad) * 1.06, waistY);
    c.quadraticCurveTo(CX + side * (hipHalf + pad) * 1.05, hipY, CX + side * (hipHalf + pad) * (d.outer === 'coat' ? 1.02 : 0.98), bottomY);
    c.lineTo(inner, bottomY);
    c.lineTo(inner, shoulderY - 3);
    c.closePath();
    c.fill();
  };
  panel(-1);
  panel(1);

  // the collar rolling over the shoulders
  c.fillStyle = domeShade(c, shoulderY - 8, shoulderY + 6, outerCol);
  c.beginPath();
  c.moveTo(CX - (shoulderHalf + pad), shoulderY + 2);
  c.quadraticCurveTo(CX, shoulderY - 9, CX + (shoulderHalf + pad), shoulderY + 2);
  c.quadraticCurveTo(CX, shoulderY - 3, CX - (shoulderHalf + pad), shoulderY + 2);
  c.closePath();
  c.fill();

  if (puffy && f > 0.15) {                  // horizontal baffles
    c.strokeStyle = rgba('#000000', 0.16);
    c.lineWidth = 1.1;
    for (let y = shoulderY + 8; y < bottomY - 3; y += 9) {
      c.beginPath();
      c.moveTo(CX - (chestHalf + pad) * 0.98, y);
      c.quadraticCurveTo(CX, y + 2.2, CX + (chestHalf + pad) * 0.98, y);
      c.stroke();
    }
  }
  if ((d.outer === 'blazer' || d.outer === 'suit') && f > 0.2) {   // lapels
    c.fillStyle = shade(outerCol, 0.14);
    [-1, 1].forEach((s) => {
      c.beginPath();
      c.moveTo(CX + s * chestHalf * 0.42 * f, shoulderY - 1);
      c.lineTo(CX + s * chestHalf * 0.10 * f, waistY - 4);
      c.lineTo(CX + s * chestHalf * 0.05 * f, shoulderY + 3);
      c.closePath();
      c.fill();
    });
    c.fillStyle = shade(outerCol, -0.4);
    ell(c, CX + chestHalf * 0.16 * f, waistY + 2, 1.1 * f, 1.1); c.fill();
  }
  if (d.outer === 'denim' && f > 0.2) {
    c.strokeStyle = rgba('#F5B301', 0.5 * f);
    c.lineWidth = 0.6;
    [-1, 1].forEach((s) => {
      c.beginPath();
      c.moveTo(CX + s * chestHalf * 0.22 * f, shoulderY + 4);
      c.lineTo(CX + s * chestHalf * 0.22 * f, bottomY - 3);
      c.stroke();
    });
  }
  if (d.outer === 'bomber') {                // ribbed hem
    c.fillStyle = shade(outerCol, -0.3);
    rr(c, CX - (hipHalf + pad), bottomY - 5, (hipHalf + pad) * 2, 5.5, 2); c.fill();
  }
}

/* ── the head, turnable ───────────────────────────────────────────── */
function drawHead(c, d, T, g) {
  const { cx, cy, rx, ry, skin, hairCol } = g;
  const f = facing(T);
  const st = T.st;
  const absSt = Math.abs(st);

  /* A head is an ellipsoid: `rx` across, `rx * HEADZ` front to back.
     Its outline at any turn is the exact projection below, and every
     feature is placed by the same maths — which is the only way the
     nose ends up on the face at 60° instead of floating past the ear.
     Getting this wrong is what made the first pass look broken. */
  const HEADZ = 1.02;
  const skullX = cx;
  const headRX = Math.sqrt((rx * T.ct) * (rx * T.ct) + (rx * HEADZ * st) * (rx * HEADZ * st));
  const P = (u, v) => cx + (u * rx * T.ct + v * rx * HEADZ * st);
  const shown = (u) => u * st > -0.62;               // has this wrapped out of sight?

  /* ── the far ear, behind the head ── */
  const ear = (side) => {
    const ex = P(side * 0.98, -0.16);
    c.fillStyle = volume(c, ex - 3, ex + 3, shade(skin, -0.10));
    ell(c, ex, cy + ry * 0.10, 2.6 * (0.45 + f * 0.55), 3.8);
    c.fill();
    c.fillStyle = rgba('#000000', 0.16);
    ell(c, ex, cy + ry * 0.10, 1.2 * (0.45 + f * 0.55), 2.0);
    c.fill();
  };
  if (shown(-1)) ear(-1);
  if (shown(1)) ear(1);

  drawHairBack(c, d, T, { skullX, cy, rx: headRX, ry, hairCol });

  /* ── the skull ── */
  const headGrad = c.createLinearGradient(skullX - headRX, cy - ry, skullX + headRX, cy + ry * 0.6);
  headGrad.addColorStop(0, shade(skin, 0.20));
  headGrad.addColorStop(0.45, shade(skin, 0.06));
  headGrad.addColorStop(0.85, shade(skin, -0.20));
  headGrad.addColorStop(1, shade(skin, -0.02));
  c.fillStyle = headGrad;
  c.beginPath();
  // an egg with a jaw: wide at the temples, tapering to the chin
  c.moveTo(skullX, cy - ry);
  c.bezierCurveTo(skullX + headRX, cy - ry, skullX + headRX, cy + ry * 0.30, skullX + headRX * 0.80, cy + ry * 0.62);
  c.bezierCurveTo(skullX + headRX * 0.52, cy + ry * 1.02, skullX - headRX * 0.52, cy + ry * 1.02, skullX - headRX * 0.80, cy + ry * 0.62);
  c.bezierCurveTo(skullX - headRX, cy + ry * 0.30, skullX - headRX, cy - ry, skullX, cy - ry);
  c.closePath();
  c.fill();

  /* the nose in profile actually leaves the silhouette — this is the
     single detail that sells a turned head */
  if (absSt > 0.12) {
    const nx = P(0, 1.00);
    const dir = Math.sign(st);
    c.fillStyle = shade(skin, 0.04);
    c.beginPath();
    c.moveTo(nx - dir * 2, cy + ry * 0.02);
    c.quadraticCurveTo(nx + dir * (2.6 * absSt), cy + ry * 0.20, nx - dir * 1.4, cy + ry * 0.30);
    c.closePath();
    c.fill();
  }

  // cheek + brow shading, following the light
  c.save();
  c.beginPath();
  c.ellipse(skullX, cy + ry * 0.02, headRX * 0.99, ry * 0.99, 0, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = rgba('#000000', 0.10);
  ell(c, skullX + headRX * 0.62, cy + ry * 0.18, headRX * 0.42, ry * 0.6);
  c.fill();
  c.fillStyle = rgba('#E2725B', 0.16);
  if (shown(-0.55)) { ell(c, P(-0.55, 0.58), cy + ry * 0.30, 3.4, 2.1); c.fill(); }
  if (shown(0.55)) { ell(c, P(0.55, 0.58), cy + ry * 0.30, 3.4, 2.1); c.fill(); }
  c.restore();

  drawFace(c, d, T, { cx, cy, rx, ry, skin, P, shown, f });
  drawBeard(c, d, T, { cx, cy, rx, ry, hairCol, P, shown, f, skullX, headRX });
  // the mouth goes on last: a beard frames it, it doesn't cover it
  drawMouth(c, d, T, { cy, ry, P, f });
  drawHairFront(c, d, T, { skullX, cy, rx: headRX, ry, hairCol, P, shown, f });
  if (d.glasses) drawGlasses(c, d, T, { cy, ry, P, shown, f });
  if (d.hat) drawHat(c, d, T, { skullX, cy, rx: headRX, ry, f, st });
}

function drawFace(c, d, T, g) {
  const { cy, ry, skin, P, shown, f } = g;
  const eyeY = cy + ry * 0.06;
  const browY = cy - ry * 0.20;
  const mouthY = cy + ry * 0.52;
  const sq = 0.35 + f * 0.65;              // features compress as the head turns

  const eye = (side) => {
    const u = side * 0.46;
    if (!shown(u)) return;
    const x = P(u, 0.62);
    const wOpen = 3.0 * sq;

    if (d.eyes === 'happy') {
      c.strokeStyle = '#2A1F18'; c.lineWidth = 1.5; c.lineCap = 'round';
      c.beginPath(); c.arc(x, eyeY + 1, 2.8 * sq, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      return;
    }
    if (d.eyes === 'sleepy' || (d.eyes === 'wink' && side > 0)) {
      c.strokeStyle = '#2A1F18'; c.lineWidth = 1.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - 2.6 * sq, eyeY); c.lineTo(x + 2.6 * sq, eyeY); c.stroke();
      return;
    }
    // white
    c.fillStyle = '#FFFFFF';
    ell(c, x, eyeY, wOpen, d.eyes === 'wide' ? 3.4 : 2.7); c.fill();
    // the iris drifts with the turn, because eyes stay pointed at you
    const iris = x + (d.eyes === 'side' ? 1.1 : 0) - T.st * 0.7;
    c.fillStyle = d.eyeColor || '#3B2A1A';
    ell(c, iris, eyeY + 0.2, 1.75 * sq + 0.3, 1.95); c.fill();
    c.fillStyle = '#120C08';
    ell(c, iris, eyeY + 0.2, 0.85 * sq + 0.2, 0.95); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)';       // catchlight — the eye stops being a dot
    ell(c, iris - 0.6, eyeY - 0.8, 0.55, 0.6); c.fill();
    if (d.eyes === 'stars') {
      c.fillStyle = '#F5B301';
      c.font = '900 5px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText('★', iris, eyeY + 2);
    }
    // upper lid shadow
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.9;
    c.beginPath(); c.arc(x, eyeY, wOpen, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
  };
  eye(-1); eye(1);

  const brow = (side) => {
    const u = side * 0.46;
    if (!shown(u)) return;
    const x = P(u, 0.60);
    const lift = d.brows === 'raised' ? -1.6 : 0;
    const tilt = d.brows === 'angry' ? side * 1.1 : d.brows === 'raised' ? -side * 0.5 : 0;
    c.strokeStyle = shade(g.hairCol || '#2A1F18', -0.25);
    c.strokeStyle = '#2E2018';
    c.lineWidth = d.brows === 'thin' ? 1.0 : d.brows === 'bushy' ? 2.4 : 1.6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - 2.8 * sq, browY + lift + tilt);
    c.quadraticCurveTo(x, browY + lift - 1.2 + tilt * 0.3, x + 2.8 * sq, browY + lift - tilt * 0.4);
    c.stroke();
  };
  brow(-1); brow(1);

  // nose, on the face
  const nx = P(0, 0.95);
  c.strokeStyle = rgba(shade(skin, -0.45), 0.75);
  c.lineWidth = 1.2; c.lineCap = 'round';
  c.beginPath();
  if (d.nose === 'wide') {
    c.moveTo(nx - 2.2 * sq, cy + ry * 0.28);
    c.quadraticCurveTo(nx, cy + ry * 0.36, nx + 2.2 * sq, cy + ry * 0.28);
  } else if (d.nose === 'pointed') {
    c.moveTo(nx, cy + ry * 0.10);
    c.lineTo(nx + 1.2 * sq, cy + ry * 0.30);
    c.lineTo(nx - 0.8 * sq, cy + ry * 0.30);
  } else {
    c.moveTo(nx - 1.4 * sq, cy + ry * 0.28);
    c.quadraticCurveTo(nx, cy + ry * 0.34, nx + 1.4 * sq, cy + ry * 0.28);
  }
  c.stroke();

}

function drawMouth(c, d, T, g) {
  const { cy, ry, P, f } = g;
  const mouthY = cy + ry * 0.52;
  const sq = 0.35 + f * 0.65;
  const mx = P(0, 0.78);
  c.lineCap = 'round';
  if (d.mouth === 'grin' || d.mouth === 'open' || d.mouth === 'ohh' || d.mouth === 'tongue') {
    c.fillStyle = '#6B2233';
    c.beginPath();
    if (d.mouth === 'ohh') c.ellipse(mx, mouthY, 2.2 * sq, 2.6, 0, 0, Math.PI * 2);
    else c.ellipse(mx, mouthY, 4.2 * sq, d.mouth === 'open' ? 2.6 : 2.9, 0, 0, Math.PI);
    c.fill();
    if (d.mouth === 'grin') {                     // teeth
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.ellipse(mx, mouthY + 0.3, 3.9 * sq, 1.2, 0, 0, Math.PI); c.fill();
    }
    if (d.mouth === 'tongue') {
      c.fillStyle = '#E8637E';
      c.beginPath(); c.ellipse(mx, mouthY + 2.4, 2.0 * sq, 1.5, 0, 0, Math.PI); c.fill();
    }
  } else {
    c.strokeStyle = '#8A3A46';
    c.lineWidth = 1.5;
    c.beginPath();
    if (d.mouth === 'sad') { c.moveTo(mx - 3 * sq, mouthY + 1.4); c.quadraticCurveTo(mx, mouthY - 1.4, mx + 3 * sq, mouthY + 1.4); }
    else if (d.mouth === 'smirk') { c.moveTo(mx - 2.6 * sq, mouthY); c.quadraticCurveTo(mx + 1 * sq, mouthY + 2.2, mx + 3.2 * sq, mouthY - 1.2); }
    else if (d.mouth === 'neutral') { c.moveTo(mx - 2.8 * sq, mouthY); c.lineTo(mx + 2.8 * sq, mouthY); }
    else { c.moveTo(mx - 3.2 * sq, mouthY - 0.8); c.quadraticCurveTo(mx, mouthY + 2.6, mx + 3.2 * sq, mouthY - 0.8); }
    c.stroke();
  }
}

function drawBeard(c, d, T, g) {
  if (!d.beard) return;
  const { cy, ry, hairCol, P, f, skullX, headRX } = g;
  /* Beard hair reads lighter than head hair — it's shorter and catches
     more light. On a near-black hair colour that difference is the only
     thing keeping the beard from merging into one dark mass with the
     skin around it. */
  const col = shade(hairCol, lum(hairCol) < 0.22 ? 0.26 : -0.10);
  const jawY = cy + ry * 0.60;
  const mouthY = cy + ry * 0.52;
  const w = headRX * 0.70;

  c.save();
  if (d.beard === 'stubble') c.globalAlpha = 0.35;
  c.fillStyle = col;

  if (d.beard === 'moustache') {
    c.beginPath();
    c.ellipse(P(0, 0.78), mouthY - 3.2, 3.4 * (0.4 + f * 0.6), 1.5, 0, 0, Math.PI * 2);
    c.fill();
  } else if (d.beard === 'goatee') {
    c.beginPath();
    c.ellipse(P(0, 0.78), jawY + 1.5, 3.0 * (0.4 + f * 0.6), 3.4, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(P(0, 0.78), mouthY - 3.2, 3.2 * (0.4 + f * 0.6), 1.3, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    /* A beard follows the jaw and stops below the cheekbone — start it
       any higher and it swallows the eyes, which is exactly what it
       did the first time round. */
    const topY = cy + ry * 0.42;
    const drop = d.beard === 'long' ? ry * 0.72 : d.beard === 'full' ? ry * 0.26 : ry * 0.14;
    c.beginPath();
    c.moveTo(skullX - w, topY);
    c.bezierCurveTo(skullX - w, cy + ry * 0.70, skullX - w * 0.5, jawY + drop, skullX, jawY + drop);
    c.bezierCurveTo(skullX + w * 0.5, jawY + drop, skullX + w, cy + ry * 0.70, skullX + w, topY);
    c.quadraticCurveTo(skullX, cy + ry * 0.66, skullX - w, topY);
    c.closePath();
    c.fill();
    if (d.beard !== 'stubble') {
      c.fillStyle = shade(col, 0.18);        // a lit top edge on the beard mass
      c.beginPath();
      c.moveTo(skullX - w, topY);
      c.quadraticCurveTo(skullX - w * 0.62, cy + ry * 0.60, skullX - w * 0.24, cy + ry * 0.60);
      c.lineTo(skullX - w * 0.24, cy + ry * 0.48);
      c.closePath();
      c.fill();
    }
    // moustache above it, or a full beard reads as a chinstrap
    if (d.beard === 'full' || d.beard === 'long') {
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(P(0, 0.78), mouthY - 3.4, 3.6 * (0.4 + f * 0.6), 1.6, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

function drawHairBack(c, d, T, g) {
  const { skullX, cy, rx, ry, hairCol } = g;
  if (d.hair === 'bald' || d.hair === 'buzz') return;
  const long = /^(long|wavyLong|bob|bangs|ponytail|braids|pigtails)$/.test(d.hair);
  const col = shade(hairCol, -0.22);
  c.fillStyle = col;

  if (d.hair === 'hijab') {
    c.fillStyle = volume(c, skullX - rx * 1.5, skullX + rx * 1.5, d.hairColor);
    c.beginPath();
    c.moveTo(skullX - rx * 1.16, cy + ry * 0.1);
    c.quadraticCurveTo(skullX - rx * 1.24, cy + ry * 1.5, skullX, cy + ry * 1.72);
    c.quadraticCurveTo(skullX + rx * 1.24, cy + ry * 1.5, skullX + rx * 1.16, cy + ry * 0.1);
    c.closePath();
    c.fill();
    return;
  }
  if (long) {
    c.fillStyle = volume(c, skullX - rx * 1.4, skullX + rx * 1.4, col);
    const drop = d.hair === 'bob' || d.hair === 'bangs' ? ry * 0.95 : ry * 2.0;
    c.beginPath();
    c.moveTo(skullX - rx * 1.10, cy - ry * 0.3);
    c.quadraticCurveTo(skullX - rx * 1.24, cy + drop, skullX - rx * 0.62, cy + drop);
    c.lineTo(skullX + rx * 0.62, cy + drop);
    c.quadraticCurveTo(skullX + rx * 1.24, cy + drop, skullX + rx * 1.10, cy - ry * 0.3);
    c.closePath();
    c.fill();
  }
  if (d.hair === 'braids') {
    c.fillStyle = volume(c, skullX - rx * 1.4, skullX + rx * 1.4, col);
    for (let i = -2; i <= 2; i++) {
      const bx = skullX + i * rx * 0.42 * (T.ct * 0.7 + 0.3);
      c.beginPath();
      c.moveTo(bx - rx * 0.11, cy - ry * 0.4);
      c.quadraticCurveTo(bx + i * rx * 0.2, cy + ry * 0.7, bx + i * rx * 0.16, cy + ry * 1.5);
      c.lineTo(bx + rx * 0.11 + i * rx * 0.16, cy + ry * 1.5);
      c.quadraticCurveTo(bx + rx * 0.11 + i * rx * 0.2, cy + ry * 0.7, bx + rx * 0.11, cy - ry * 0.4);
      c.closePath();
      c.fill();
    }
  }
  if (d.hair === 'afro' || d.hair === 'curly') {
    c.fillStyle = volume(c, skullX - rx * 1.5, skullX + rx * 1.5, col);
    ell(c, skullX, cy - ry * 0.34, rx * (d.hair === 'afro' ? 1.34 : 1.16), ry * (d.hair === 'afro' ? 1.16 : 0.98));
    c.fill();
  }
  if (d.hair === 'ponytail') {
    const dir = T.st >= 0 ? -1 : 1;            // the tail swings behind the head
    c.fillStyle = volume(c, skullX - rx * 1.6, skullX + rx * 1.6, col);
    c.beginPath();
    c.moveTo(skullX + dir * rx * 0.9, cy - ry * 0.2);
    c.quadraticCurveTo(skullX + dir * rx * 1.9, cy + ry * 0.6, skullX + dir * rx * 1.5, cy + ry * 1.8);
    c.quadraticCurveTo(skullX + dir * rx * 1.0, cy + ry * 0.7, skullX + dir * rx * 0.5, cy - ry * 0.2);
    c.closePath();
    c.fill();
  }
  if (d.hair === 'bun') {
    c.fillStyle = volume(c, skullX - rx, skullX + rx, col);
    ell(c, skullX - T.st * rx * 0.5, cy - ry * 1.05, rx * 0.46, rx * 0.42);
    c.fill();
  }
  if (d.hair === 'pigtails') {
    [-1, 1].forEach((s) => {
      c.fillStyle = volume(c, skullX - rx * 1.6, skullX + rx * 1.6, col);
      ell(c, skullX + s * rx * 1.16 * (T.ct * 0.7 + 0.3), cy + ry * 0.45, rx * 0.40, ry * 0.62);
      c.fill();
    });
  }
}

function drawHairFront(c, d, T, g) {
  const { skullX, cy, rx, ry, hairCol, f } = g;
  if (d.hair === 'bald') return;
  if (d.hair === 'hijab') {
    // the front edge of the scarf, framing the face
    c.fillStyle = volume(c, skullX - rx * 1.3, skullX + rx * 1.3, shade(d.hairColor, 0.10));
    c.beginPath();
    c.moveTo(skullX - rx * 1.14, cy + ry * 0.25);
    c.bezierCurveTo(skullX - rx * 1.2, cy - ry * 1.15, skullX + rx * 1.2, cy - ry * 1.15, skullX + rx * 1.14, cy + ry * 0.25);
    c.bezierCurveTo(skullX + rx * 0.9, cy - ry * 0.30, skullX - rx * 0.9, cy - ry * 0.30, skullX - rx * 1.14, cy + ry * 0.25);
    c.closePath();
    c.fill();
    return;
  }

  const col = hairCol;
  c.fillStyle = volume(c, skullX - rx * 1.3, skullX + rx * 1.3, col);

  /* The cap of hair on top of the skull. Every style is this shape
     plus an edge — which is what real haircuts are. */
  const cap = (lift, hang) => {
    c.beginPath();
    c.moveTo(skullX - rx * 1.02, cy + ry * 0.10 + hang);
    c.bezierCurveTo(skullX - rx * 1.10, cy - ry * (1.0 + lift), skullX + rx * 1.10, cy - ry * (1.0 + lift), skullX + rx * 1.02, cy + ry * 0.10 + hang);
    c.bezierCurveTo(skullX + rx * 0.9, cy - ry * 0.34, skullX - rx * 0.9, cy - ry * 0.34, skullX - rx * 1.02, cy + ry * 0.10 + hang);
    c.closePath();
    c.fill();
  };

  if (d.hair === 'buzz') { cap(0.02, -ry * 0.14); }
  else if (d.hair === 'fade') {
    cap(0.10, -ry * 0.30);
    c.globalAlpha = 0.5; cap(0.02, -ry * 0.02); c.globalAlpha = 1;
  } else if (d.hair === 'mohawk') {
    c.beginPath();
    c.moveTo(skullX - rx * 0.26 * (T.ct * 0.7 + 0.3), cy - ry * 0.55);
    c.quadraticCurveTo(skullX, cy - ry * 1.62, skullX + rx * 0.26 * (T.ct * 0.7 + 0.3), cy - ry * 0.55);
    c.closePath();
    c.fill();
    c.globalAlpha = 0.35; cap(0.0, -ry * 0.10); c.globalAlpha = 1;
  } else if (d.hair === 'quiff') {
    cap(0.18, -ry * 0.16);
    c.beginPath();                                   // the sweep at the front
    c.moveTo(skullX - rx * 0.5, cy - ry * 0.72);
    c.quadraticCurveTo(skullX + rx * 0.1, cy - ry * 1.55, skullX + rx * 0.72, cy - ry * 0.86);
    c.quadraticCurveTo(skullX + rx * 0.2, cy - ry * 1.05, skullX - rx * 0.5, cy - ry * 0.72);
    c.closePath();
    c.fill();
  } else if (d.hair === 'afro') {
    ell(c, skullX, cy - ry * 0.40, rx * 1.30, ry * 1.06); c.fill();
  } else if (d.hair === 'curly') {
    for (let i = -3; i <= 3; i++) {
      ell(c, skullX + i * rx * 0.30, cy - ry * (0.62 + Math.cos(i) * 0.16), rx * 0.34, ry * 0.34);
      c.fill();
    }
    cap(0.05, -ry * 0.20);
  } else if (d.hair === 'braids') {
    cap(0.05, -ry * 0.18);
    // the parting lines only — the braids themselves hang behind the
    // head, drawn in drawHairBack, where they belong
    c.strokeStyle = shade(col, -0.35); c.lineWidth = 1.0;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(skullX + i * rx * 0.30, cy - ry * 0.95);
      c.quadraticCurveTo(skullX + i * rx * 0.40, cy - ry * 0.72, skullX + i * rx * 0.44, cy - ry * 0.44);
      c.stroke();
    }
  } else if (d.hair === 'bangs') {
    cap(0.10, -ry * 0.12);
    c.beginPath();                                    // a straight fringe
    c.moveTo(skullX - rx * 1.02, cy - ry * 0.55);
    c.lineTo(skullX + rx * 1.02, cy - ry * 0.55);
    c.lineTo(skullX + rx * 0.98, cy - ry * 0.12);
    c.quadraticCurveTo(skullX, cy - ry * 0.30, skullX - rx * 0.98, cy - ry * 0.12);
    c.closePath();
    c.fill();
  } else if (d.hair === 'wavyLong' || d.hair === 'long' || d.hair === 'bob') {
    cap(0.12, -ry * 0.10);
    // a side parting: one sweep across the forehead
    c.beginPath();
    c.moveTo(skullX - rx * 1.0, cy - ry * 0.36);
    c.quadraticCurveTo(skullX - rx * 0.1, cy - ry * 1.1, skullX + rx * 0.98, cy - ry * 0.40);
    c.quadraticCurveTo(skullX + rx * 0.2, cy - ry * 0.62, skullX - rx * 1.0, cy - ry * 0.36);
    c.closePath();
    c.fill();
  } else {
    cap(0.12, -ry * 0.18);
  }

  // the shine that makes hair look like hair and not felt
  if (f > 0.15 && d.hair !== 'bald' && d.hair !== 'buzz') {
    c.strokeStyle = rgba('#FFFFFF', 0.22 * f);
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(skullX, cy - ry * 0.25, rx * 0.78, Math.PI * 1.18, Math.PI * 1.55);
    c.stroke();
  }
  // hair casts a shadow on the forehead
  c.fillStyle = rgba('#000000', 0.12);
  c.beginPath();
  c.ellipse(skullX, cy - ry * 0.30, rx * 0.86, ry * 0.16, 0, 0, Math.PI);
  c.fill();
}

function drawGlasses(c, d, T, g) {
  const { cy, ry, P, shown, f } = g;
  const eyeY = cy + ry * 0.06;
  const sq = 0.35 + f * 0.65;
  const dark = d.glasses === 'sun';
  c.strokeStyle = '#26201C';
  c.lineWidth = 1.1;

  const lens = (side) => {
    const u = side * 0.46;
    if (!shown(u)) return;
    const x = P(u, 0.72);
    if (dark) {
      const lg = c.createLinearGradient(x - 4, eyeY - 3, x + 4, eyeY + 3);
      lg.addColorStop(0, 'rgba(30,30,40,0.92)');
      lg.addColorStop(0.5, 'rgba(12,12,20,0.94)');
      lg.addColorStop(1, 'rgba(60,60,80,0.9)');
      c.fillStyle = lg;
    } else {
      c.fillStyle = 'rgba(200,225,255,0.20)';
    }
    if (d.glasses === 'round') { ell(c, x, eyeY, 4.0 * sq, 3.8); c.fill(); c.stroke(); }
    else { rr(c, x - 4.2 * sq, eyeY - 3.4, 8.4 * sq, 6.8, 1.6); c.fill(); c.stroke(); }
    if (!dark) {                                    // a glint on the glass
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x - 2.4 * sq, eyeY + 1.4); c.lineTo(x - 0.4 * sq, eyeY - 1.8); c.stroke();
      c.strokeStyle = '#26201C'; c.lineWidth = 1.1;
    }
  };
  lens(-1); lens(1);
  if (shown(-0.46) && shown(0.46)) {                // bridge
    c.beginPath();
    c.moveTo(P(-0.22, 0.86), eyeY - 1);
    c.lineTo(P(0.22, 0.86), eyeY - 1);
    c.stroke();
  }
  // the arm, visible once the head turns
  if (Math.abs(T.st) > 0.2) {
    const s = Math.sign(T.st);
    c.beginPath();
    c.moveTo(P(s * 0.5, 0.66), eyeY - 1.6);
    c.lineTo(P(s * 0.98, -0.2), eyeY - 0.6);
    c.stroke();
  }
}

function drawHat(c, d, T, g) {
  const { skullX, cy, rx, ry, f, st } = g;
  const col = d.hatColor || '#111827';
  const brimDir = d.hat === 'capBack' ? -1 : 1;

  if (d.hat === 'headphones') {
    c.strokeStyle = shade(col, 0.1);
    c.lineWidth = 2.6;
    c.beginPath();
    c.arc(skullX, cy - ry * 0.22, rx * 1.14, Math.PI * 1.06, Math.PI * 1.94);
    c.stroke();
    [-1, 1].forEach((s) => {
      const x = skullX + s * rx * 1.12 * (T.ct * 0.75 + 0.25) - st * rx * 0.1;
      c.fillStyle = volume(c, x - 3.4, x + 3.4, col);
      rr(c, x - 3.2, cy - ry * 0.24, 6.4, 8.4, 2.8); c.fill();
    });
    return;
  }

  const crown = (hh, wid) => {
    c.fillStyle = volume(c, skullX - rx * wid, skullX + rx * wid, col);
    c.beginPath();
    c.moveTo(skullX - rx * wid, cy - ry * 0.34);
    c.bezierCurveTo(skullX - rx * wid, cy - ry * (0.34 + hh), skullX + rx * wid, cy - ry * (0.34 + hh), skullX + rx * wid, cy - ry * 0.34);
    c.closePath();
    c.fill();
  };

  if (d.hat === 'beanie') {
    crown(1.05, 1.06);
    c.fillStyle = volume(c, skullX - rx * 1.1, skullX + rx * 1.1, shade(col, -0.18));
    rr(c, skullX - rx * 1.08, cy - ry * 0.52, rx * 2.16, ry * 0.34, ry * 0.14); c.fill();
  } else if (d.hat === 'bucket') {
    crown(0.72, 1.0);
    c.fillStyle = volume(c, skullX - rx * 1.5, skullX + rx * 1.5, shade(col, -0.12));
    ell(c, skullX, cy - ry * 0.34, rx * 1.42, ry * 0.24); c.fill();
  } else if (d.hat === 'cowboy') {
    crown(0.92, 0.86);
    c.fillStyle = volume(c, skullX - rx * 1.8, skullX + rx * 1.8, shade(col, -0.12));
    ell(c, skullX, cy - ry * 0.30, rx * 1.72, ry * 0.30); c.fill();
    c.fillStyle = shade(col, -0.42);
    rr(c, skullX - rx * 0.88, cy - ry * 0.54, rx * 1.76, ry * 0.22, 1); c.fill();
  } else if (d.hat === 'crown') {
    c.fillStyle = volume(c, skullX - rx, skullX + rx, '#F5B301');
    c.beginPath();
    c.moveTo(skullX - rx * 0.92, cy - ry * 0.46);
    c.lineTo(skullX - rx * 0.92, cy - ry * 1.14);
    c.lineTo(skullX - rx * 0.46, cy - ry * 0.80);
    c.lineTo(skullX, cy - ry * 1.30);
    c.lineTo(skullX + rx * 0.46, cy - ry * 0.80);
    c.lineTo(skullX + rx * 0.92, cy - ry * 1.14);
    c.lineTo(skullX + rx * 0.92, cy - ry * 0.46);
    c.closePath();
    c.fill();
  } else {                                          // cap, either way round
    crown(0.80, 1.02);
    /* The peak points forward. Face-on you're looking down its length,
       so it foreshortens to a shallow ellipse under the crown; turn the
       head and it swings out to the side and gets longer. That swing is
       the projection of a single forward-pointing vector. */
    const bx = skullX + brimDir * st * rx * 0.80;
    const bw = rx * (0.92 + 0.42 * Math.abs(st));
    c.fillStyle = volume(c, bx - bw, bx + bw, shade(col, -0.16));
    c.beginPath();
    c.ellipse(bx, cy - ry * 0.30, bw, ry * (0.16 + 0.10 * f), 0, 0, Math.PI * 2);
    c.fill();
    if (d.hat === 'capBack' && f > 0.4) {            // the strap at the back
      c.fillStyle = shade(col, 0.3);
      rr(c, skullX - rx * 0.24, cy - ry * 0.46, rx * 0.48, ry * 0.14, 1); c.fill();
    }
  }
  // the hat sits ON the head, so it darkens what's under it
  c.fillStyle = rgba('#000000', 0.16);
  c.beginPath();
  c.ellipse(skullX, cy - ry * 0.30, rx * 0.92, ry * 0.13, 0, 0, Math.PI);
  c.fill();
}

/* ── ready-made renders ───────────────────────────────────────────── */

/* The whole person as a PNG — map markers, profile headers, stickers. */
export function characterToDataUrl(dna, width, opts) {
  if (typeof document === 'undefined') return null;
  const w = width || 150;
  const h = Math.round(w * 1.6);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  if (!c) return null;
  try { drawCharacter(c, 0, 0, w, h, dna, opts); } catch (e) { return null; }
  try { return cv.toDataURL('image/png'); } catch (e) { return null; }
}

/* Head and shoulders only, for a round frame. */
export function bustToDataUrl(dna, size, opts) {
  if (typeof document === 'undefined') return null;
  const px = size || 256;
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const c = cv.getContext('2d');
  if (!c) return null;
  try {
    c.save();
    c.beginPath(); c.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); c.clip();
    if (opts && opts.bg) {
      const bg = c.createLinearGradient(0, 0, px, px);
      bg.addColorStop(0, opts.bg);
      bg.addColorStop(1, shade(opts.bg, -0.45));
      c.fillStyle = bg;
      c.fillRect(0, 0, px, px);
    }
    // scale the full figure up and slide it so the head fills the circle
    drawCharacter(c, -px * 0.62, -px * 0.10, px * 2.24, px * 3.58, dna, { ...(opts || {}), shadow: false });
    c.restore();
  } catch (e) { return null; }
  try { return cv.toDataURL('image/png'); } catch (e) { return null; }
}
