/* ─── لمّة · A PHARAOH, DRAWN RATHER THAN DOWNLOADED ─────────────────
   Ayser asked for characters made before the game starts — and every
   game he showed me builds those out of an artist's sprite sheet. We
   have no such sheet, and taking one is exactly the thing he has told
   me never to do. So this draws the whole character from arithmetic:
   arcs, wedges and gradients on a canvas, in the same way
   src/components/lensArt.js draws the headdresses onto a live photo.

   Nothing here is loaded from anywhere. There is no asset to license,
   nothing to break when a URL rots, and no ambiguity about whose work
   it is.

   ── WHY IT BAKES TO A JPEG ────────────────────────────────────────
   The room already carries faces: a small JPEG data URL on a seat,
   checked by the server, drawn by Face.js in the lobby, the standings
   and on the podium. A character that produced its own kind of value
   would need all four of those to learn a second format, and a seat
   would show a photograph for one player and something else for
   another. So the character is drawn and then baked into exactly the
   same small JPEG a camera would have produced. Every screen that can
   already show a face shows a pharaoh, and the server needed no change
   at all.

   ── AND IT IS A CHARACTER, NOT A COSTUME ON A REAL PERSON ─────────
   Deliberately stylised — flat colour, no attempt at a likeness.
   Somebody who does not want their photograph in a room full of people
   still gets to be somebody, which is the whole point of having this
   as well as the camera.                                             */

export const SIZE = 224;
export const QUALITY = 0.7;
export const MAX_CHARS = 26000;          // what the server will accept

/* ── THE PARTS ─────────────────────────────────────────────────────
   Skin tones are Egyptian and range properly. A single "skin colour"
   with a light default is how you tell most of a country it is the
   exception. */
export const SKINS = [
  { id: 's1', c: '#F2C79B', shade: '#D9A87A' },
  { id: 's2', c: '#DDA46F', shade: '#C08A57' },
  { id: 's3', c: '#B97B48', shade: '#9C6134' },
  { id: 's4', c: '#8A5427', shade: '#6E3F19' },
  { id: 's5', c: '#5C3418', shade: '#43230E' },
];

/* Headdresses and the two colours each is painted in. The nemes
   stripes and the Nefertiti crown are shapes, not pictures — a striped
   headcloth is four thousand years old and belongs to nobody.

   No emoji here. These carried one each for the picker to show, and
   two of them rendered as empty boxes: the hieroglyph for a nemes is
   in no font a phone ships with. The picker draws each option instead,
   which was always the better answer — nobody has to know the word
   "khat" to recognise it. */
export const HEADS = [
  { id: 'nemes',     a: '#2E6BE6', b: '#F5C542' },
  { id: 'nemes_grn', a: '#0E9C6E', b: '#F5C542' },
  { id: 'khat',      a: '#1E2A5A', b: '#1E2A5A' },
  { id: 'nefertiti', a: '#2C6ED5', b: '#E8B33C' },
  { id: 'bare',      a: null,      b: null },
];

export const COLLARS = [{ id: 'wesekh' }, { id: 'simple' }, { id: 'none' }];

export const EYES = [{ id: 'kohl' }, { id: 'plain' }];

export const BEARDS = [{ id: 'none' }, { id: 'royal' }];

export const DEFAULT_LOOK = {
  skin: 's2', head: 'nemes', collar: 'wesekh', eyes: 'kohl', beard: 'none',
};

const pick = (list, id) => list.find((x) => x.id === id) || list[0];

/* ── THE DRAWING ───────────────────────────────────────────────────
   One function, one canvas context, a square of side S. Everything is
   expressed as a fraction of S so the same code draws the 224px face
   that goes on a seat and the big one in the picker. */
export function drawPharaoh(c, S, look) {
  const L = { ...DEFAULT_LOOK, ...(look || {}) };
  const skin = pick(SKINS, L.skin);
  const head = pick(HEADS, L.head);

  const cx = S * 0.5;
  const faceY = S * 0.52;
  const faceR = S * 0.215;

  // ── the ground: a warm disc so the character never floats on white
  const g = c.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#2B1B4D');
  g.addColorStop(1, '#160D2C');
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);

  // a soft halo behind the head, so the silhouette reads at 26px too
  const halo = c.createRadialGradient(cx, faceY, faceR * 0.4, cx, faceY, S * 0.52);
  halo.addColorStop(0, 'rgba(245,179,1,0.22)');
  halo.addColorStop(1, 'rgba(245,179,1,0)');
  c.fillStyle = halo;
  c.fillRect(0, 0, S, S);

  // ── shoulders, in the skin tone, cut off by the frame
  c.fillStyle = skin.shade;
  c.beginPath();
  c.ellipse(cx, S * 1.06, S * 0.40, S * 0.30, 0, 0, Math.PI * 2);
  c.fill();

  // ── neck
  c.fillStyle = skin.shade;
  c.fillRect(cx - S * 0.075, faceY + faceR * 0.5, S * 0.15, S * 0.20);

  // ── the headcloth goes BEHIND the face, so the face sits in it
  if (head.a) drawHead(c, S, cx, faceY, faceR, head, 'back');

  // ── face
  c.fillStyle = skin.c;
  c.beginPath();
  c.ellipse(cx, faceY, faceR * 0.86, faceR, 0, 0, Math.PI * 2);
  c.fill();

  // ── brow shadow, which is what stops it looking like an egg
  c.fillStyle = 'rgba(0,0,0,0.07)';
  c.beginPath();
  c.ellipse(cx, faceY - faceR * 0.45, faceR * 0.80, faceR * 0.30, 0, 0, Math.PI * 2);
  c.fill();

  drawEyes(c, S, cx, faceY, faceR, L.eyes === 'kohl');
  drawMouth(c, S, cx, faceY, faceR);

  // ── and the front of the headcloth, over the face's edges
  if (head.a) drawHead(c, S, cx, faceY, faceR, head, 'front');

  drawCollar(c, S, cx, faceY, faceR, L.collar);

  /* The beard goes on LAST. Drawn before the collar it was a dark
     smudge behind four bands of colour, and "royal beard" and "none"
     were the same picture — the same failure the kohl had. A royal
     beard hangs in front of the collar anyway, which is both correct
     and the only way you can see it. */
  if (L.beard === 'royal') drawBeard(c, S, cx, faceY, faceR, head);
}

/* ── THE HEADDRESS ─────────────────────────────────────────────────
   Two passes. The back pass is the mass behind the head; the front
   pass is the band across the brow and the lappets down the chest,
   which have to sit ON the face or the whole thing looks like a hat
   balanced behind somebody. That was the bug in the photo lenses too:
   the band drawn at eye height covered the eyes. It goes at the
   HAIRLINE. */
function drawHead(c, S, cx, faceY, faceR, head, pass) {
  const top = faceY - faceR * 1.06;

  if (head.id === 'nefertiti') {
    if (pass === 'back') {
      // the flat-topped crown, wider at the top and tilted back — a
      // trapezium, and the tilt is the whole silhouette
      c.fillStyle = head.a;
      c.beginPath();
      c.moveTo(cx - faceR * 0.98, faceY - faceR * 0.42);
      c.lineTo(cx - faceR * 0.66, top - faceR * 1.05);
      c.lineTo(cx + faceR * 1.02, top - faceR * 1.05);
      c.lineTo(cx + faceR * 1.06, faceY - faceR * 0.42);
      c.closePath();
      c.fill();
    } else {
      // the gold band round the brow, at the hairline like the nemes
      c.fillStyle = head.b;
      c.beginPath();
      c.moveTo(cx - faceR * 1.00, faceY - faceR * 0.86);
      c.lineTo(cx + faceR * 1.05, faceY - faceR * 0.86);
      c.lineTo(cx + faceR * 1.04, faceY - faceR * 0.58);
      c.lineTo(cx - faceR * 0.99, faceY - faceR * 0.58);
      c.closePath();
      c.fill();
      c.fillStyle = '#B23A2E';
      c.beginPath();
      c.arc(cx, faceY - faceR * 0.72, faceR * 0.07, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }

  if (pass === 'back') {
    // the mass of cloth: wider than the head, square-ish at the jaw
    c.fillStyle = head.a;
    c.beginPath();
    c.moveTo(cx - faceR * 1.30, faceY + faceR * 1.15);
    c.lineTo(cx - faceR * 1.22, top - faceR * 0.10);
    c.quadraticCurveTo(cx, top - faceR * 0.62, cx + faceR * 1.22, top - faceR * 0.10);
    c.lineTo(cx + faceR * 1.30, faceY + faceR * 1.15);
    c.closePath();
    c.fill();

    // the stripes, which are the whole reason a nemes reads as a nemes
    if (head.id !== 'khat') {
      c.save();
      c.beginPath();
      c.moveTo(cx - faceR * 1.30, faceY + faceR * 1.15);
      c.lineTo(cx - faceR * 1.22, top - faceR * 0.10);
      c.quadraticCurveTo(cx, top - faceR * 0.62, cx + faceR * 1.22, top - faceR * 0.10);
      c.lineTo(cx + faceR * 1.30, faceY + faceR * 1.15);
      c.closePath();
      c.clip();
      c.fillStyle = head.b;
      const w = faceR * 0.15;
      for (let x = cx - faceR * 1.35; x < cx + faceR * 1.35; x += w * 2) {
        c.fillRect(x, top - faceR * 0.7, w, faceR * 2.6);
      }
      c.restore();
    }
    return;
  }

  // FRONT: the band at the hairline, and the two lappets on the chest
  c.fillStyle = head.b;
  c.beginPath();
  c.moveTo(cx - faceR * 1.00, faceY - faceR * 0.72);
  c.quadraticCurveTo(cx, faceY - faceR * 1.16, cx + faceR * 1.00, faceY - faceR * 0.72);
  c.lineTo(cx + faceR * 1.00, faceY - faceR * 0.46);
  c.quadraticCurveTo(cx, faceY - faceR * 0.90, cx - faceR * 1.00, faceY - faceR * 0.46);
  c.closePath();
  c.fill();

  /* The lappets — the two panels of cloth down the chest. They carry
     the SAME stripes as the back of the headcloth. Painted flat they
     turned the whole thing into a striped fringe above a plain blue
     hood, which is a hat, not a nemes. */
  [-1, 1].forEach((side) => {
    const lap = () => {
      c.beginPath();
      c.moveTo(cx + side * faceR * 0.86, faceY - faceR * 0.52);
      c.lineTo(cx + side * faceR * 1.30, faceY - faceR * 0.30);
      c.lineTo(cx + side * faceR * 1.18, faceY + faceR * 1.45);
      c.lineTo(cx + side * faceR * 0.70, faceY + faceR * 1.45);
      c.closePath();
    };
    c.fillStyle = head.a;
    lap();
    c.fill();

    if (head.id !== 'khat') {
      c.save();
      lap();
      c.clip();
      c.fillStyle = head.b;
      const w = faceR * 0.15;
      for (let x = cx - faceR * 1.4; x < cx + faceR * 1.4; x += w * 2) {
        c.fillRect(x, faceY - faceR * 0.6, w, faceR * 2.2);
      }
      c.restore();
    }
  });

  // the uraeus — a small cobra head at the brow, which is a teardrop
  // and a dot, and is unmistakable at any size
  c.fillStyle = '#E8B33C';
  c.beginPath();
  c.ellipse(cx, faceY - faceR * 0.80, faceR * 0.12, faceR * 0.17, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#B23A2E';
  c.beginPath();
  c.arc(cx, faceY - faceR * 0.84, faceR * 0.055, 0, Math.PI * 2);
  c.fill();
}

/* Kohl is FILLED WEDGES, never outlines. Drawn as strokes it reads as
   a pair of spectacles — which is exactly how the photo lens went
   wrong the first time it was tried. */
function drawEyes(c, S, cx, faceY, faceR, kohl) {
  const ey = faceY - faceR * 0.10;
  const dx = faceR * 0.38;

  [-1, 1].forEach((side) => {
    const x = cx + side * dx;

    /* The kohl has to be BIGGER than the eye it rims, or the white of
       the eye covers it and the two options look identical — which is
       exactly how the first version came out: "kohl" and "plain" were
       the same picture. */
    if (kohl) {
      c.fillStyle = '#1A1526';
      c.beginPath();
      c.ellipse(x, ey, faceR * 0.27, faceR * 0.185, 0, 0, Math.PI * 2);
      c.fill();
      // the tail out towards the temple, and the brow line above it
      c.beginPath();
      c.moveTo(x + side * faceR * 0.24, ey - faceR * 0.10);
      c.lineTo(x + side * faceR * 0.62, ey - faceR * 0.26);
      c.lineTo(x + side * faceR * 0.24, ey + faceR * 0.06);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(x - faceR * 0.26, ey - faceR * 0.32);
      c.quadraticCurveTo(x, ey - faceR * 0.46, x + faceR * 0.26, ey - faceR * 0.32);
      c.lineTo(x + faceR * 0.26, ey - faceR * 0.24);
      c.quadraticCurveTo(x, ey - faceR * 0.36, x - faceR * 0.26, ey - faceR * 0.24);
      c.closePath();
      c.fill();
    }

    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.ellipse(x, ey, faceR * 0.145, faceR * 0.098, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#20182F';
    c.beginPath();
    c.arc(x, ey, faceR * 0.072, 0, Math.PI * 2);
    c.fill();
  });
}

function drawMouth(c, S, cx, faceY, faceR) {
  c.strokeStyle = 'rgba(90,40,30,0.75)';
  c.lineWidth = Math.max(1.4, faceR * 0.055);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx - faceR * 0.20, faceY + faceR * 0.42);
  c.quadraticCurveTo(cx, faceY + faceR * 0.56, cx + faceR * 0.20, faceY + faceR * 0.42);
  c.stroke();
}

function drawBeard(c, S, cx, faceY, faceR, head) {
  c.fillStyle = head.id === 'khat' ? '#2A3568' : '#3A2C1E';
  c.beginPath();
  c.moveTo(cx - faceR * 0.17, faceY + faceR * 0.80);
  c.lineTo(cx + faceR * 0.17, faceY + faceR * 0.80);
  c.lineTo(cx + faceR * 0.26, faceY + faceR * 1.54);
  c.lineTo(cx - faceR * 0.26, faceY + faceR * 1.54);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.16)';
  c.lineWidth = Math.max(1, faceR * 0.03);
  for (let i = 1; i < 4; i++) {
    const y = faceY + faceR * (0.82 + i * 0.18);
    c.beginPath();
    c.moveTo(cx - faceR * 0.22, y);
    c.lineTo(cx + faceR * 0.22, y);
    c.stroke();
  }
}

/* The wesekh is a broad collar of concentric bands. Three arcs in
   three colours, and it is instantly the right thing. */
/* Centred on the BASE OF THE NECK, not on the chest. Centred lower,
   every band fell past the bottom edge of the square and all three
   collar options came out as the same thin sliver of gold. */
function drawCollar(c, S, cx, faceY, faceR, kind) {
  if (kind === 'none') return;
  const y = faceY + faceR * 0.98;

  if (kind === 'simple') {
    c.strokeStyle = '#E8B33C';
    c.lineWidth = Math.max(2, faceR * 0.12);
    c.beginPath();
    c.arc(cx, y, faceR * 0.66, Math.PI * 0.05, Math.PI * 0.95);
    c.stroke();
    return;
  }

  const bands = ['#E8B33C', '#2C6ED5', '#0E9C6E', '#C6462F'];
  bands.forEach((col, i) => {
    c.strokeStyle = col;
    c.lineWidth = Math.max(2.5, faceR * 0.125);
    c.beginPath();
    c.arc(cx, y, faceR * (0.46 + i * 0.150), Math.PI * 0.03, Math.PI * 0.97);
    c.stroke();
  });
}

/* ── AND THE BAKE ──────────────────────────────────────────────────
   The same shape faceShot.bakeFace produces, for the same reason: a
   small JPEG data URL the server already knows how to check. Squeezed
   rather than refused if an encoder produces something fatter. */
export function bakePharaoh(look, size = SIZE) {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const c = cv.getContext('2d');
  if (!c) return null;
  drawPharaoh(c, size, look);

  let url = cv.toDataURL('image/jpeg', QUALITY);
  if (url.length > MAX_CHARS) url = cv.toDataURL('image/jpeg', 0.5);
  if (url.length > MAX_CHARS) return null;
  return url;
}

/* ── A PHARAOH FOR SOMEBODY WHO NEVER DREW ONE ──────────────────────
   Ayser: "I want every one to appear with his pharaoh."

   Before this, a player who had not taken a photo appeared as the
   first letter of their name in a circle. That is the ordinary answer
   and it is a bad one here, because the whole evening is pharaohs: a
   board of eleven pharaohs and four letters does not read as a board
   at all, it reads as four people who did something wrong.

   So everybody gets one. Not a random one — a HASHED one, taken from
   the user's own id, so the same person is the same pharaoh on every
   phone in the room, in the lobby, in the standings and on the podium,
   tonight and next month. Nothing is stored and nothing is asked for.

   Somebody who builds their own face still overrides it. This is the
   floor, not the ceiling. */

/* FNV-1a. Small, stable, and identical in every browser — which is the
   only property that matters, because two phones disagreeing about
   somebody's face is the bug this is meant to avoid. */
const hash32 = (s) => {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
};

export function lookFor(seed) {
  const h = hash32(seed);
  const at = (list, shift) => list[(h >>> shift) % list.length].id;
  return {
    skin: at(SKINS, 0),
    head: at(HEADS, 4),
    collar: at(COLLARS, 9),
    eyes: at(EYES, 13),
    beard: at(BEARDS, 17),
  };
}

/* Baked once per person, at one size, and scaled by whoever draws it.
   Seventy seats on a screen is seventy canvases if this is not cached,
   and a canvas per seat per render if it is cached carelessly. */
const drawnFaces = new Map();
const FACE_PX = 128;

export function pharaohFor(seed) {
  const key = String(seed || '');
  if (!key) return null;
  if (drawnFaces.has(key)) return drawnFaces.get(key);
  let url = null;
  try { url = bakePharaoh(lookFor(key), FACE_PX); } catch (e) { url = null; }
  drawnFaces.set(key, url);
  return url;
}

/* ── THE DOUBLE CROWN ───────────────────────────────────────────────
   Ayser: "top ١ يبقي عليه تاج فرعوني."

   The pschent: the white crown of Upper Egypt worn inside the red
   crown of Lower Egypt, which is what a pharaoh who ruled both wore
   and is the one crown a room recognises instantly. Drawn here in the
   same way as everything else in this file — paths and fills, nothing
   downloaded, nothing anybody owns. A shape from five thousand years
   ago cannot be licensed to anyone.

   PNG rather than JPEG, and this is the whole reason: a crown needs a
   transparent background or it arrives as a white square sitting on
   the winner's head. */
export function drawCrown(c, S) {
  c.clearRect(0, 0, S, S);
  const u = (n) => n * S;
  const thin = Math.max(1, u(0.014));

  /* Order matters more than any single path here: the white crown is
     drawn first and the red bowl over it, because that is the way the
     two are actually worn — the white rising THROUGH the red. Drawn
     the other way round it is a white hat with a red one beside it. */

  // ── the white crown of Upper Egypt (hedjet), tall through the middle
  c.fillStyle = '#F6F2E6';
  c.strokeStyle = '#C7BCA0';
  c.lineWidth = thin;
  c.beginPath();
  c.moveTo(u(0.36), u(0.88));
  c.bezierCurveTo(u(0.31), u(0.60), u(0.34), u(0.22), u(0.47), u(0.12));
  c.bezierCurveTo(u(0.60), u(0.22), u(0.63), u(0.60), u(0.58), u(0.88));
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(u(0.47), u(0.105), u(0.050), 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // ── the spike of the red crown, rising behind everything
  c.fillStyle = '#C0392B';
  c.strokeStyle = '#8E241A';
  c.beginPath();
  c.moveTo(u(0.600), u(0.76));
  c.lineTo(u(0.675), u(0.12));
  c.lineTo(u(0.762), u(0.19));
  c.lineTo(u(0.745), u(0.78));
  c.closePath();
  c.fill();
  c.stroke();

  // ── and its bowl, in front, holding the white crown inside it
  c.beginPath();
  c.moveTo(u(0.17), u(0.885));
  c.lineTo(u(0.19), u(0.66));
  c.bezierCurveTo(u(0.27), u(0.555), u(0.61), u(0.535), u(0.79), u(0.61));
  c.lineTo(u(0.835), u(0.885));
  c.closePath();
  c.fill();
  c.stroke();

  // the coil at the front — the part that makes it a crown of Lower
  // Egypt rather than a red hat
  c.strokeStyle = '#F5C542';
  c.lineWidth = Math.max(1.4, u(0.026));
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(u(0.285), u(0.845));
  c.bezierCurveTo(u(0.235), u(0.760), u(0.300), u(0.690), u(0.370), u(0.720));
  c.bezierCurveTo(u(0.420), u(0.745), u(0.400), u(0.812), u(0.348), u(0.800));
  c.stroke();

  // the gold band along the rim
  c.fillStyle = '#F5C542';
  c.fillRect(u(0.16), u(0.868), u(0.685), u(0.046));
}

let crownUrlCache = null;
export function crownUrl(size = 128) {
  if (crownUrlCache) return crownUrlCache;
  if (typeof document === 'undefined') return null;
  try {
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const c = cv.getContext('2d');
    if (!c) return null;
    drawCrown(c, size);
    crownUrlCache = cv.toDataURL('image/png');
    return crownUrlCache;
  } catch (e) { return null; }
}
