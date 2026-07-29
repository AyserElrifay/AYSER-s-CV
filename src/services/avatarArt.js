/* ─── MOMENTS AVATAR · our own character, drawn by us ─────────────────
   Every avatar in the app is PAINTED here, on a canvas, from a small
   set of trait choices ("DNA"). Nothing is fetched from anyone else's
   service, so it is ours: it works offline, it never 400s, it renders
   instantly, and — the part that matters — the exact same code can
   draw you into a game, onto the map, or into a sticker.

   Coordinates are authored on a 100×100 grid and scaled to whatever
   size is asked for, so one avatar is crisp at 28px on a map pin and
   at 512px in the editor. */

export const SKIN_TONES = ['#FFE0C4', '#F8CFA9', '#EFB98C', '#DFA070', '#C4835A', '#9E6440', '#7A4B2E', '#5A3620'];
export const HAIR_COLORS = ['#1B1512', '#3A281C', '#5C3A1E', '#8B5A2B', '#B77B3A', '#D9A441', '#E8D2A0', '#B0B0B0', '#F2F2F2', '#7C3AED', '#E11D48', '#0EA5E9', '#10B981'];
export const CLOTH_COLORS = ['#7C3AED', '#2563EB', '#0EA5E9', '#10B981', '#F5B301', '#F97316', '#E11D48', '#EC4899', '#111827', '#F4F4F5'];
export const BG_COLORS = ['#7C3AED', '#2563EB', '#10B981', '#F5B301', '#E11D48', '#EC4899', '#0EA5E9', '#F97316', '#334155'];

export const HAIRS = [
  { id: 'buzz', label: 'Buzz' }, { id: 'short', label: 'Short' },
  { id: 'waves', label: 'Waves' }, { id: 'fade', label: 'Fade' },
  { id: 'curly', label: 'Curly' }, { id: 'afro', label: 'Afro' },
  { id: 'mohawk', label: 'Mohawk' }, { id: 'quiff', label: 'Quiff' },
  { id: 'bob', label: 'Bob' }, { id: 'bangs', label: 'Bangs' },
  { id: 'long', label: 'Long' }, { id: 'wavyLong', label: 'Wavy' },
  { id: 'ponytail', label: 'Ponytail' }, { id: 'bun', label: 'Bun' },
  { id: 'pigtails', label: 'Pigtails' }, { id: 'braids', label: 'Braids' },
  { id: 'hijab', label: 'Hijab' }, { id: 'bald', label: 'Bald' },
];
export const EYES = [
  { id: 'open', label: 'Open' }, { id: 'happy', label: 'Happy' },
  { id: 'wink', label: 'Wink' }, { id: 'sleepy', label: 'Sleepy' },
  { id: 'wide', label: 'Wide' }, { id: 'side', label: 'Side eye' },
  { id: 'stars', label: 'Stars' },
];
export const BROWS = [
  { id: 'natural', label: 'Natural' }, { id: 'raised', label: 'Raised' },
  { id: 'angry', label: 'Serious' }, { id: 'thin', label: 'Thin' }, { id: 'bushy', label: 'Bushy' },
];
export const MOUTHS = [
  { id: 'smile', label: 'Smile' }, { id: 'grin', label: 'Grin' },
  { id: 'smirk', label: 'Smirk' }, { id: 'open', label: 'Talking' },
  { id: 'sad', label: 'Sad' }, { id: 'tongue', label: 'Tongue' },
  { id: 'neutral', label: 'Neutral' }, { id: 'ohh', label: 'Ohh' },
];
export const NOSES = [{ id: 'round', label: 'Round' }, { id: 'small', label: 'Small' }, { id: 'pointed', label: 'Pointed' }, { id: 'wide', label: 'Wide' }];
export const BEARDS = [
  { id: '', label: 'None' }, { id: 'stubble', label: 'Stubble' },
  { id: 'moustache', label: 'Moustache' }, { id: 'goatee', label: 'Goatee' },
  { id: 'full', label: 'Full beard' }, { id: 'long', label: 'Long beard' },
];
export const OUTFITS = [
  { id: 'tee', label: 'T-shirt' }, { id: 'hoodie', label: 'Hoodie' },
  { id: 'jacket', label: 'Jacket' }, { id: 'shirt', label: 'Shirt' },
  { id: 'tank', label: 'Tank' }, { id: 'dress', label: 'Dress' },
  { id: 'jersey', label: 'Jersey' }, { id: 'abaya', label: 'Abaya' },
];
export const GLASSES = [
  { id: '', label: 'None' }, { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' }, { id: 'sun', label: 'Sunglasses' },
];
export const EXTRAS = [
  { id: '', label: 'None' }, { id: 'cap', label: 'Cap' }, { id: 'beanie', label: 'Beanie' },
  { id: 'headphones', label: 'Headphones' }, { id: 'earrings', label: 'Earrings' },
];

export const HERITAGES = [
  { id: '', label: 'Classic', emblem: '✦', bg: ['#7C3AED', '#F5B301'] },
  { id: 'pharaonic', label: 'Pharaonic', emblem: '𓂀', bg: ['#F5B301', '#1D4ED8'] },
  { id: 'greek', label: 'Greek', emblem: '🏛️', bg: ['#E8ECF4', '#2563EB'] },
  { id: 'japanese', label: 'Japanese', emblem: '🏯', bg: ['#E11D48', '#FDF2F2'] },
  { id: 'andalusi', label: 'Andalusi', emblem: '🕌', bg: ['#0F766E', '#F5B301'] },
  { id: 'nubian', label: 'Nubian', emblem: '🪘', bg: ['#D97706', '#7C2D12'] },
  { id: 'bedouin', label: 'Bedouin', emblem: '🏜️', bg: ['#E7C67A', '#3F2A14'] },
  { id: 'viking', label: 'Viking', emblem: '⚔️', bg: ['#64748B', '#0B1B33'] },
  { id: 'maya', label: 'Maya', emblem: '🗿', bg: ['#16A34A', '#854D0E'] },
];
export const heritageOf = (id) => HERITAGES.find((h) => h.id === (id || '')) || HERITAGES[0];

export const DEFAULT_DNA = {
  skin: SKIN_TONES[1],
  hair: 'short', hairColor: HAIR_COLORS[1],
  eyes: 'open', eyeColor: '#3B2A1A', brows: 'natural',
  mouth: 'smile', nose: 'round', beard: '',
  outfit: 'tee', outfitColor: CLOTH_COLORS[0],
  glasses: '', extra: '', heritage: '', bg: BG_COLORS[0],
};

/* Older profiles were saved against the previous trait names — map
   them across so nobody's avatar changes or breaks on upgrade. */
const LEGACY_HAIR = {
  bald: 'bald', buzzcut: 'buzz', cap: 'short', beanie: 'short', curly: 'curly',
  curlyBun: 'bun', curlyHighTop: 'afro', bobCut: 'bob', bobBangs: 'bangs',
  long: 'long', straightBun: 'bun', pigtails: 'pigtails', fade: 'fade',
  shortCombover: 'short', sideShave: 'mohawk', mohawk: 'mohawk',
};
const LEGACY_EYES = { glasses: 'open', happy: 'happy', open: 'open', sleep: 'sleepy', sunglasses: 'open', wink: 'wink' };
const LEGACY_MOUTH = { bigSmile: 'grin', smile: 'smile', smirk: 'smirk', surprise: 'ohh', frown: 'sad', lips: 'neutral' };
const LEGACY_NOSE = { mediumRound: 'round', smallRound: 'small', wrinkles: 'wide' };
const LEGACY_BEARD = { shadow: 'stubble', soulPatch: 'goatee', goatee: 'goatee', pyramid: 'moustache', walrus: 'moustache', beardMustache: 'full' };
const LEGACY_OUTFIT = { rounded: 'tee', squared: 'shirt', small: 'tank', checkered: 'jacket' };

export function parseDna(str) {
  const dna = { ...DEFAULT_DNA };
  if (!str) return dna;
  const raw = {};
  String(str).split(',').forEach((pair) => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    raw[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
  });
  // current field names
  Object.keys(DEFAULT_DNA).forEach((k) => { if (raw[k]) dna[k] = raw[k]; });
  // legacy field names
  if (raw.skinColor) dna.skin = raw.skinColor;
  if (raw.hair && LEGACY_HAIR[raw.hair]) dna.hair = LEGACY_HAIR[raw.hair];
  if (raw.clothing) dna.outfit = LEGACY_OUTFIT[raw.clothing] || dna.outfit;
  if (raw.clothingColor) dna.outfitColor = raw.clothingColor;
  if (raw.eyes && LEGACY_EYES[raw.eyes]) dna.eyes = LEGACY_EYES[raw.eyes];
  if (raw.eyes === 'glasses') dna.glasses = 'round';
  if (raw.eyes === 'sunglasses') dna.glasses = 'sun';
  if (raw.mouth && LEGACY_MOUTH[raw.mouth]) dna.mouth = LEGACY_MOUTH[raw.mouth];
  if (raw.nose && LEGACY_NOSE[raw.nose]) dna.nose = LEGACY_NOSE[raw.nose];
  if (raw.facialHair && LEGACY_BEARD[raw.facialHair]) dna.beard = LEGACY_BEARD[raw.facialHair];
  return dna;
}

export function serializeDna(dna) {
  const d = { ...DEFAULT_DNA, ...dna };
  return Object.keys(DEFAULT_DNA).map((k) => k + '=' + encodeURIComponent(d[k])).join(',');
}

/* ── painting helpers ─────────────────────────────────────────── */
const shade = (hex, amt) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = cl(((n >> 16) & 255) * (1 + amt));
  const g = cl(((n >> 8) & 255) * (1 + amt));
  const b = cl((n & 255) * (1 + amt));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};
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
const ell = (c, x, y, rx, ry, rot) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); };

/* head shape: a soft egg with a defined jaw */
function headPath(c, cx, cy, w, h) {
  c.beginPath();
  c.moveTo(cx, cy - h);
  c.bezierCurveTo(cx + w, cy - h, cx + w, cy + h * 0.32, cx + w * 0.82, cy + h * 0.62);
  c.bezierCurveTo(cx + w * 0.55, cy + h, cx - w * 0.55, cy + h, cx - w * 0.82, cy + h * 0.62);
  c.bezierCurveTo(cx - w, cy + h * 0.32, cx - w, cy - h, cx, cy - h);
  c.closePath();
}

/* ── the body + outfit ─────────────────────────────────────────── */
function drawBody(c, d, s) {
  const col = d.outfitColor;
  const dark = shade(col, -0.22);
  const light = shade(col, 0.16);
  const neckY = 66 * s, shoulderY = 76 * s;

  // neck
  c.fillStyle = shade(d.skin, -0.12);
  rr(c, 43 * s, neckY - 4 * s, 14 * s, 12 * s, 5 * s); c.fill();

  const shoulders = (wid, top) => {
    c.beginPath();
    c.moveTo((50 - wid) * s, 100 * s);
    c.bezierCurveTo((50 - wid) * s, top * s, (50 - wid * 0.42) * s, (top - 4) * s, 50 * s, (top - 4) * s);
    c.bezierCurveTo((50 + wid * 0.42) * s, (top - 4) * s, (50 + wid) * s, top * s, (50 + wid) * s, 100 * s);
    c.closePath();
  };

  if (d.outfit === 'dress' || d.outfit === 'abaya') {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(32 * s, 100 * s);
    c.bezierCurveTo(34 * s, 82 * s, 40 * s, shoulderY * s / s, 50 * s, 73 * s);
    c.bezierCurveTo(60 * s, 76 * s, 66 * s, 84 * s, 68 * s, 100 * s);
    c.closePath(); c.fill();
    c.fillStyle = d.outfit === 'abaya' ? shade(col, -0.3) : light;
    rr(c, 44 * s, 74 * s, 12 * s, 26 * s, 4 * s); c.fill();
    return;
  }

  c.fillStyle = col;
  shoulders(20, shoulderY); c.fill();

  if (d.outfit === 'hoodie') {
    c.fillStyle = dark;                         // hood behind the neck
    ell(c, 50 * s, 74 * s, 17 * s, 8 * s); c.fill();
    c.fillStyle = col; shoulders(20, shoulderY); c.fill();
    c.strokeStyle = light; c.lineWidth = 1.6 * s;   // drawstrings
    c.beginPath(); c.moveTo(46 * s, 80 * s); c.lineTo(45 * s, 92 * s); c.stroke();
    c.beginPath(); c.moveTo(54 * s, 80 * s); c.lineTo(55 * s, 92 * s); c.stroke();
    c.fillStyle = dark; rr(c, 40 * s, 88 * s, 20 * s, 8 * s, 3 * s); c.fill(); // pocket
  } else if (d.outfit === 'jacket') {
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(50 * s, 74 * s); c.lineTo(42 * s, 84 * s); c.lineTo(46 * s, 100 * s); c.lineTo(50 * s, 100 * s); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(50 * s, 74 * s); c.lineTo(58 * s, 84 * s); c.lineTo(54 * s, 100 * s); c.lineTo(50 * s, 100 * s); c.closePath(); c.fill();
    c.fillStyle = shade(d.skin, 0.05);   // shirt underneath
    c.beginPath(); c.moveTo(50 * s, 74 * s); c.lineTo(46 * s, 86 * s); c.lineTo(54 * s, 86 * s); c.closePath(); c.fill();
  } else if (d.outfit === 'shirt') {
    c.fillStyle = light;
    c.beginPath(); c.moveTo(50 * s, 73 * s); c.lineTo(43 * s, 82 * s); c.lineTo(50 * s, 88 * s); c.lineTo(57 * s, 82 * s); c.closePath(); c.fill();
    c.fillStyle = dark;
    for (let i = 0; i < 3; i++) { ell(c, 50 * s, (88 + i * 5) * s, 1.2 * s, 1.2 * s); c.fill(); }
  } else if (d.outfit === 'tank') {
    c.fillStyle = shade(d.skin, -0.05);
    c.beginPath(); c.moveTo(41 * s, 78 * s); c.lineTo(45 * s, 100 * s); c.lineTo(39 * s, 100 * s); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(59 * s, 78 * s); c.lineTo(55 * s, 100 * s); c.lineTo(61 * s, 100 * s); c.closePath(); c.fill();
  } else if (d.outfit === 'jersey') {
    c.fillStyle = light;
    rr(c, 44 * s, 82 * s, 12 * s, 13 * s, 2 * s); c.fill();
    c.fillStyle = col;
    c.font = '900 ' + 9 * s + 'px system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('10', 50 * s, 89 * s);
  }
  // collar
  c.fillStyle = shade(d.skin, -0.1);
  ell(c, 50 * s, 74 * s, 7 * s, 3.5 * s); c.fill();
}

/* ── hair (behind the head) ───────────────────────────────────── */
function drawHairBack(c, d, s) {
  const col = d.hairColor;
  if (d.hair === 'hijab') {
    c.fillStyle = shade(col, -0.1);
    c.beginPath();
    c.moveTo(24 * s, 44 * s);
    c.bezierCurveTo(24 * s, 12 * s, 76 * s, 12 * s, 76 * s, 44 * s);
    c.bezierCurveTo(78 * s, 70 * s, 70 * s, 86 * s, 50 * s, 86 * s);
    c.bezierCurveTo(30 * s, 86 * s, 22 * s, 70 * s, 24 * s, 44 * s);
    c.closePath(); c.fill();
    return;
  }
  c.fillStyle = shade(col, -0.12);
  if (d.hair === 'long' || d.hair === 'wavyLong' || d.hair === 'braids') {
    c.beginPath();
    c.moveTo(24 * s, 40 * s);
    c.bezierCurveTo(20 * s, 74 * s, 26 * s, 88 * s, 30 * s, 92 * s);
    c.lineTo(70 * s, 92 * s);
    c.bezierCurveTo(74 * s, 88 * s, 80 * s, 74 * s, 76 * s, 40 * s);
    c.closePath(); c.fill();
    if (d.hair === 'braids') {
      c.fillStyle = shade(col, -0.25);
      for (const bx of [27, 73]) for (let i = 0; i < 4; i++) { ell(c, bx * s, (62 + i * 9) * s, 4 * s, 5 * s); c.fill(); }
    }
  } else if (d.hair === 'bob' || d.hair === 'bangs') {
    c.beginPath();
    c.moveTo(24 * s, 40 * s);
    c.bezierCurveTo(22 * s, 62 * s, 26 * s, 70 * s, 30 * s, 72 * s);
    c.lineTo(70 * s, 72 * s);
    c.bezierCurveTo(74 * s, 70 * s, 78 * s, 62 * s, 76 * s, 40 * s);
    c.closePath(); c.fill();
  } else if (d.hair === 'ponytail') {
    ell(c, 76 * s, 46 * s, 7 * s, 13 * s, -0.3); c.fill();
  } else if (d.hair === 'bun') {
    ell(c, 50 * s, 16 * s, 11 * s, 10 * s); c.fill();
  } else if (d.hair === 'pigtails') {
    ell(c, 22 * s, 46 * s, 8 * s, 11 * s); c.fill();
    ell(c, 78 * s, 46 * s, 8 * s, 11 * s); c.fill();
  } else if (d.hair === 'afro') {
    ell(c, 50 * s, 30 * s, 32 * s, 29 * s); c.fill();
  }
}

/* ── hair (in front of the head) ──────────────────────────────── */
function drawHairFront(c, d, s) {
  if (d.hair === 'bald') return;
  const col = d.hairColor;
  const lit = shade(col, 0.18);

  if (d.hair === 'hijab') {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(25 * s, 44 * s);
    c.bezierCurveTo(25 * s, 15 * s, 75 * s, 15 * s, 75 * s, 44 * s);
    c.bezierCurveTo(70 * s, 34 * s, 62 * s, 28 * s, 50 * s, 28 * s);
    c.bezierCurveTo(38 * s, 28 * s, 30 * s, 34 * s, 25 * s, 44 * s);
    c.closePath(); c.fill();
    c.fillStyle = lit;
    ell(c, 38 * s, 24 * s, 9 * s, 4 * s, -0.5); c.fill();
    return;
  }

  c.fillStyle = col;
  const capTop = () => {
    c.beginPath();
    c.moveTo(26 * s, 44 * s);
    c.bezierCurveTo(26 * s, 16 * s, 74 * s, 16 * s, 74 * s, 44 * s);
    c.bezierCurveTo(70 * s, 34 * s, 62 * s, 30 * s, 50 * s, 30 * s);
    c.bezierCurveTo(38 * s, 30 * s, 30 * s, 34 * s, 26 * s, 44 * s);
    c.closePath(); c.fill();
  };

  switch (d.hair) {
    case 'buzz':
      c.beginPath(); c.moveTo(27 * s, 42 * s);
      c.bezierCurveTo(27 * s, 19 * s, 73 * s, 19 * s, 73 * s, 42 * s);
      c.bezierCurveTo(68 * s, 33 * s, 32 * s, 33 * s, 27 * s, 42 * s);
      c.closePath(); c.fill();
      break;
    case 'fade':
      c.beginPath(); c.moveTo(27 * s, 40 * s);
      c.bezierCurveTo(27 * s, 16 * s, 73 * s, 16 * s, 73 * s, 40 * s);
      c.bezierCurveTo(68 * s, 28 * s, 32 * s, 28 * s, 27 * s, 40 * s);
      c.closePath(); c.fill();
      c.fillStyle = shade(col, 0.4);
      c.fillRect(27 * s, 38 * s, 46 * s, 4 * s);
      break;
    case 'short': capTop(); break;
    case 'waves':
      capTop();
      c.strokeStyle = shade(col, -0.3); c.lineWidth = 1.2 * s;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(30 * s, (26 + i * 4) * s);
        c.bezierCurveTo(42 * s, (22 + i * 4) * s, 58 * s, (22 + i * 4) * s, 70 * s, (26 + i * 4) * s);
        c.stroke();
      }
      break;
    case 'quiff':
      capTop();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(38 * s, 26 * s);
      c.bezierCurveTo(44 * s, 6 * s, 64 * s, 10 * s, 62 * s, 24 * s);
      c.bezierCurveTo(56 * s, 18 * s, 46 * s, 20 * s, 38 * s, 26 * s);
      c.closePath(); c.fill();
      break;
    case 'mohawk':
      c.fillStyle = shade(col, -0.4);
      c.beginPath(); c.moveTo(28 * s, 44 * s);
      c.bezierCurveTo(28 * s, 26 * s, 72 * s, 26 * s, 72 * s, 44 * s);
      c.bezierCurveTo(66 * s, 36 * s, 34 * s, 36 * s, 28 * s, 44 * s);
      c.closePath(); c.fill();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(42 * s, 34 * s);
      c.bezierCurveTo(44 * s, 6 * s, 56 * s, 6 * s, 58 * s, 34 * s);
      c.closePath(); c.fill();
      break;
    case 'curly':
      for (const [px, py, pr] of [[30, 32, 9], [40, 24, 10], [52, 22, 10], [64, 26, 9], [71, 36, 8], [34, 42, 7], [68, 44, 7]]) {
        ell(c, px * s, py * s, pr * s, pr * 0.92 * s); c.fill();
      }
      break;
    case 'afro':
      for (const [px, py, pr] of [[30, 28, 11], [42, 20, 12], [56, 20, 12], [68, 28, 11], [26, 40, 9], [74, 40, 9]]) {
        ell(c, px * s, py * s, pr * s, pr * s); c.fill();
      }
      break;
    case 'bangs':
      capTop();
      c.fillStyle = col;
      rr(c, 26 * s, 30 * s, 48 * s, 14 * s, 6 * s); c.fill();
      break;
    case 'bob': case 'long': case 'wavyLong': case 'braids':
      capTop();
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(26 * s, 44 * s);
      c.bezierCurveTo(28 * s, 30 * s, 40 * s, 26 * s, 50 * s, 26 * s);
      c.bezierCurveTo(56 * s, 26 * s, 60 * s, 30 * s, 58 * s, 36 * s);
      c.bezierCurveTo(48 * s, 32 * s, 34 * s, 34 * s, 30 * s, 46 * s);
      c.closePath(); c.fill();
      break;
    case 'ponytail': case 'bun': case 'pigtails':
      capTop();
      break;
    default: capTop();
  }
  // a soft highlight so the hair reads as 3D, not a flat shape
  if (d.hair !== 'bald') {
    c.fillStyle = lit; c.globalAlpha = 0.55;
    ell(c, 38 * s, 24 * s, 8 * s, 3.4 * s, -0.55); c.fill();
    c.globalAlpha = 1;
  }
}

/* ── face features ────────────────────────────────────────────── */
function drawEyes(c, d, s) {
  const L = 40, R = 60, Y = 48;
  const white = '#FFFFFF';
  const eye = (x) => {
    if (d.eyes === 'happy') {
      c.strokeStyle = '#2A1F18'; c.lineWidth = 2.4 * s; c.lineCap = 'round';
      c.beginPath(); c.arc(x * s, (Y + 1) * s, 5 * s, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      return;
    }
    if (d.eyes === 'sleepy') {
      c.strokeStyle = '#2A1F18'; c.lineWidth = 2.2 * s; c.lineCap = 'round';
      c.beginPath(); c.moveTo((x - 5) * s, Y * s); c.lineTo((x + 5) * s, Y * s); c.stroke();
      return;
    }
    if (d.eyes === 'wink' && x === R) {
      c.strokeStyle = '#2A1F18'; c.lineWidth = 2.4 * s; c.lineCap = 'round';
      c.beginPath(); c.arc(x * s, (Y + 1) * s, 5 * s, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      return;
    }
    if (d.eyes === 'stars') {
      c.fillStyle = '#FFD23F';
      c.save(); c.translate(x * s, Y * s);
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = (i % 2 ? 2.4 : 6) * s, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        i ? c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      c.closePath(); c.fill(); c.restore();
      return;
    }
    const ry = d.eyes === 'wide' ? 6 : 5;
    c.fillStyle = white; ell(c, x * s, Y * s, 5.4 * s, ry * s); c.fill();
    const off = d.eyes === 'side' ? 2 : 0;
    c.fillStyle = d.eyeColor || '#3B2A1A';
    ell(c, (x + off) * s, Y * s, 3 * s, (ry - 0.6) * s); c.fill();
    c.fillStyle = '#12100E';
    ell(c, (x + off) * s, Y * s, 1.7 * s, (ry - 2.2) * s); c.fill();
    c.fillStyle = '#FFFFFF';                       // catchlight
    ell(c, (x + off + 1.4) * s, (Y - 1.8) * s, 1.1 * s, 1.1 * s); c.fill();
    c.strokeStyle = 'rgba(30,22,16,0.5)'; c.lineWidth = 0.9 * s;
    c.beginPath(); c.arc(x * s, Y * s, 5.4 * s, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  };
  eye(L); eye(R);
}

function drawBrows(c, d, s) {
  const col = shade(d.hairColor, -0.2);
  c.strokeStyle = col;
  c.lineCap = 'round';
  const w = d.brows === 'thin' ? 1.8 : d.brows === 'bushy' ? 4.2 : 2.8;
  c.lineWidth = w * s;
  const brow = (x, dir) => {
    const y = d.brows === 'raised' ? 37 : 39.5;
    c.beginPath();
    if (d.brows === 'angry') {
      c.moveTo((x - 5.5 * dir) * s, (y - 1.5) * s);
      c.lineTo((x + 5.5 * dir) * s, (y + 2) * s);
    } else {
      c.moveTo((x - 5.5) * s, (y + 1) * s);
      c.quadraticCurveTo(x * s, (y - 2.4) * s, (x + 5.5) * s, (y + 1) * s);
    }
    c.stroke();
  };
  brow(40, 1); brow(60, -1);
}

function drawNose(c, d, s) {
  c.strokeStyle = 'rgba(120,80,50,0.6)';
  c.lineWidth = 1.8 * s; c.lineCap = 'round';
  if (d.nose === 'small') {
    c.beginPath(); c.arc(50 * s, 56 * s, 2 * s, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  } else if (d.nose === 'pointed') {
    c.beginPath(); c.moveTo(50 * s, 50 * s); c.lineTo(52 * s, 57 * s); c.lineTo(48.5 * s, 57 * s); c.stroke();
  } else if (d.nose === 'wide') {
    c.beginPath(); c.arc(50 * s, 55 * s, 4 * s, Math.PI * 0.1, Math.PI * 0.9); c.stroke();
  } else {
    c.beginPath(); c.moveTo(50 * s, 51 * s); c.lineTo(51 * s, 56.5 * s);
    c.arc(49.6 * s, 56.5 * s, 1.6 * s, 0, Math.PI); c.stroke();
  }
}

function drawMouth(c, d, s) {
  const Y = 62;
  const lip = '#C05B5B';
  c.lineCap = 'round';
  switch (d.mouth) {
    case 'grin':
      c.fillStyle = '#7A2B33';
      c.beginPath(); c.moveTo(41 * s, Y * s);
      c.quadraticCurveTo(50 * s, (Y + 9) * s, 59 * s, Y * s);
      c.closePath(); c.fill();
      c.fillStyle = '#FFFFFF';
      c.beginPath(); c.moveTo(42 * s, Y * s); c.lineTo(58 * s, Y * s);
      c.lineTo(57 * s, (Y + 2.6) * s); c.lineTo(43 * s, (Y + 2.6) * s); c.closePath(); c.fill();
      break;
    case 'open': case 'ohh':
      c.fillStyle = '#7A2B33';
      ell(c, 50 * s, (Y + 2) * s, d.mouth === 'ohh' ? 4 * s : 6 * s, d.mouth === 'ohh' ? 5 * s : 4 * s); c.fill();
      break;
    case 'tongue':
      c.fillStyle = '#7A2B33';
      c.beginPath(); c.moveTo(42 * s, Y * s);
      c.quadraticCurveTo(50 * s, (Y + 8) * s, 58 * s, Y * s); c.closePath(); c.fill();
      c.fillStyle = '#F26D8A';
      ell(c, 50 * s, (Y + 5) * s, 4 * s, 3.4 * s); c.fill();
      break;
    case 'smirk':
      c.strokeStyle = lip; c.lineWidth = 2.4 * s;
      c.beginPath(); c.moveTo(43 * s, (Y + 1) * s);
      c.quadraticCurveTo(52 * s, (Y + 5) * s, 58 * s, (Y - 2) * s); c.stroke();
      break;
    case 'sad':
      c.strokeStyle = lip; c.lineWidth = 2.4 * s;
      c.beginPath(); c.moveTo(43 * s, (Y + 3) * s);
      c.quadraticCurveTo(50 * s, (Y - 2.5) * s, 57 * s, (Y + 3) * s); c.stroke();
      break;
    case 'neutral':
      c.strokeStyle = lip; c.lineWidth = 2.4 * s;
      c.beginPath(); c.moveTo(44 * s, (Y + 1) * s); c.lineTo(56 * s, (Y + 1) * s); c.stroke();
      break;
    default: // smile
      c.strokeStyle = lip; c.lineWidth = 2.6 * s;
      c.beginPath(); c.moveTo(43 * s, Y * s);
      c.quadraticCurveTo(50 * s, (Y + 6) * s, 57 * s, Y * s); c.stroke();
  }
}

function drawBeard(c, d, s) {
  if (!d.beard) return;
  const col = shade(d.hairColor, -0.05);
  c.fillStyle = col;
  if (d.beard === 'stubble') {
    c.globalAlpha = 0.32;
    c.beginPath();
    c.moveTo(30 * s, 52 * s);
    c.bezierCurveTo(32 * s, 74 * s, 68 * s, 74 * s, 70 * s, 52 * s);
    c.bezierCurveTo(66 * s, 68 * s, 34 * s, 68 * s, 30 * s, 52 * s);
    c.closePath(); c.fill();
    c.globalAlpha = 1;
    return;
  }
  if (d.beard === 'moustache') {
    c.beginPath();
    c.moveTo(42 * s, 58.5 * s);
    c.quadraticCurveTo(50 * s, 55 * s, 58 * s, 58.5 * s);
    c.quadraticCurveTo(50 * s, 61.5 * s, 42 * s, 58.5 * s);
    c.closePath(); c.fill();
    return;
  }
  if (d.beard === 'goatee') {
    rr(c, 45 * s, 66 * s, 10 * s, 8 * s, 3 * s); c.fill();
    c.beginPath();
    c.moveTo(43 * s, 58.5 * s); c.quadraticCurveTo(50 * s, 55.5 * s, 57 * s, 58.5 * s);
    c.quadraticCurveTo(50 * s, 61 * s, 43 * s, 58.5 * s); c.closePath(); c.fill();
    return;
  }
  // full / long
  const drop = d.beard === 'long' ? 88 : 76;
  c.beginPath();
  c.moveTo(29 * s, 50 * s);
  c.bezierCurveTo(28 * s, drop * s, 72 * s, drop * s, 71 * s, 50 * s);
  c.bezierCurveTo(66 * s, 64 * s, 34 * s, 64 * s, 29 * s, 50 * s);
  c.closePath(); c.fill();
  c.fillStyle = '#7A2B33';   // keep the mouth readable through the beard
  if (d.mouth !== 'neutral') { ell(c, 50 * s, 62 * s, 5 * s, 2.4 * s); c.fill(); }
}

function drawGlasses(c, d, s) {
  if (!d.glasses) return;
  const sun = d.glasses === 'sun';
  c.strokeStyle = sun ? '#1A1A1A' : '#3B3B44';
  c.lineWidth = 2 * s;
  const lens = (x) => {
    if (d.glasses === 'square') rr(c, (x - 7.5) * s, 42 * s, 15 * s, 12 * s, 3 * s);
    else { c.beginPath(); c.ellipse(x * s, 48 * s, 7.5 * s, 6.5 * s, 0, 0, Math.PI * 2); }
    if (sun) { c.fillStyle = 'rgba(18,18,22,0.88)'; c.fill(); }
    c.stroke();
  };
  lens(40); lens(60);
  c.beginPath(); c.moveTo(47.5 * s, 48 * s); c.lineTo(52.5 * s, 48 * s); c.stroke();
  c.beginPath(); c.moveTo(32.5 * s, 47 * s); c.lineTo(28 * s, 45 * s); c.stroke();
  c.beginPath(); c.moveTo(67.5 * s, 47 * s); c.lineTo(72 * s, 45 * s); c.stroke();
  if (sun) {
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1.4 * s;
    c.beginPath(); c.moveTo(36 * s, 51 * s); c.lineTo(42 * s, 45 * s); c.stroke();
    c.beginPath(); c.moveTo(56 * s, 51 * s); c.lineTo(62 * s, 45 * s); c.stroke();
  }
}

function drawExtra(c, d, s) {
  if (!d.extra) return;
  if (d.hair === 'hijab' && (d.extra === 'cap' || d.extra === 'beanie')) return;
  if (d.extra === 'cap') {
    c.fillStyle = d.outfitColor;
    c.beginPath();
    c.moveTo(27 * s, 30 * s);
    c.bezierCurveTo(27 * s, 10 * s, 73 * s, 10 * s, 73 * s, 30 * s);
    c.closePath(); c.fill();
    c.fillStyle = shade(d.outfitColor, -0.25);
    rr(c, 25 * s, 28 * s, 52 * s, 5.5 * s, 3 * s); c.fill();
    ell(c, 50 * s, 11 * s, 3 * s, 3 * s); c.fill();
  } else if (d.extra === 'beanie') {
    c.fillStyle = d.outfitColor;
    c.beginPath();
    c.moveTo(27 * s, 32 * s);
    c.bezierCurveTo(27 * s, 10 * s, 73 * s, 10 * s, 73 * s, 32 * s);
    c.closePath(); c.fill();
    c.fillStyle = shade(d.outfitColor, 0.2);
    rr(c, 26 * s, 28 * s, 48 * s, 7 * s, 3.5 * s); c.fill();
    c.fillStyle = shade(d.outfitColor, -0.2);
    ell(c, 50 * s, 12 * s, 5 * s, 5 * s); c.fill();
  } else if (d.extra === 'headphones') {
    c.strokeStyle = '#2A2A33'; c.lineWidth = 4 * s;
    c.beginPath(); c.arc(50 * s, 42 * s, 27 * s, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    c.fillStyle = '#2A2A33';
    rr(c, 18 * s, 42 * s, 10 * s, 15 * s, 5 * s); c.fill();
    rr(c, 72 * s, 42 * s, 10 * s, 15 * s, 5 * s); c.fill();
    c.fillStyle = d.outfitColor;
    rr(c, 20 * s, 45 * s, 6 * s, 9 * s, 3 * s); c.fill();
    rr(c, 74 * s, 45 * s, 6 * s, 9 * s, 3 * s); c.fill();
  } else if (d.extra === 'earrings') {
    c.fillStyle = '#F5B301';
    ell(c, 25.5 * s, 55 * s, 2.6 * s, 2.6 * s); c.fill();
    ell(c, 74.5 * s, 55 * s, 2.6 * s, 2.6 * s); c.fill();
  }
}

/* ── THE AVATAR ───────────────────────────────────────────────────
   Draws into `c` filling a `size`×`size` box at (ox, oy).
   opts: { bg:true|false, expression, mouth, eyes } — expression lets a
   sticker override the face without touching the saved DNA.        */
export function drawAvatar(c, ox, oy, size, dnaIn, opts) {
  const o = opts || {};
  const base = typeof dnaIn === 'string' ? parseDna(dnaIn) : { ...DEFAULT_DNA, ...dnaIn };
  const d = { ...base };
  if (o.eyes) d.eyes = o.eyes;
  if (o.mouth) d.mouth = o.mouth;

  const s = size / 100;
  c.save();
  c.translate(ox, oy);

  if (o.bg !== false) {
    const h = heritageOf(d.heritage);
    const g = c.createLinearGradient(0, 0, size, size);
    if (d.heritage) { g.addColorStop(0, h.bg[0]); g.addColorStop(1, h.bg[1]); }
    else { g.addColorStop(0, d.bg || BG_COLORS[0]); g.addColorStop(1, shade(d.bg || BG_COLORS[0], -0.45)); }
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
  }

  // clip everything to the frame so long hair/shoulders never spill out
  c.beginPath(); c.rect(0, 0, size, size); c.clip();

  drawHairBack(c, d, s);
  drawBody(c, d, s);

  // ears
  c.fillStyle = shade(d.skin, -0.08);
  ell(c, 26.5 * s, 52 * s, 4.5 * s, 6 * s); c.fill();
  ell(c, 73.5 * s, 52 * s, 4.5 * s, 6 * s); c.fill();

  // head
  const hg = c.createLinearGradient(0, 20 * s, 0, 74 * s);
  hg.addColorStop(0, shade(d.skin, 0.07));
  hg.addColorStop(1, shade(d.skin, -0.09));
  c.fillStyle = hg;
  headPath(c, 50 * s, 46 * s, 24 * s, 26 * s);
  c.fill();

  // a soft cheek blush + chin shadow give it depth instead of a flat fill
  c.globalAlpha = 0.16; c.fillStyle = '#E2725B';
  ell(c, 34 * s, 57 * s, 5.5 * s, 3.4 * s); c.fill();
  ell(c, 66 * s, 57 * s, 5.5 * s, 3.4 * s); c.fill();
  c.globalAlpha = 1;

  drawBrows(c, d, s);
  drawEyes(c, d, s);
  drawNose(c, d, s);
  drawMouth(c, d, s);
  drawBeard(c, d, s);
  drawHairFront(c, d, s);
  drawGlasses(c, d, s);
  drawExtra(c, d, s);

  c.restore();
}

/* Render an avatar to a PNG data URL — what <Image> sources, chat
   stickers and shared images all use. Web only (canvas). */
export function avatarToDataUrl(dna, size, opts) {
  if (typeof document === 'undefined') return null;
  const px = size || 256;
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const c = cv.getContext('2d');
  drawAvatar(c, 0, 0, px, dna, opts);
  try { return cv.toDataURL('image/png'); } catch (e) { return null; }
}

/* Round version for profile photos / map pins. Framed a little closer
   than the square one so the face fills the circle instead of floating
   in it — at 28px on a map pin you need to actually read the face. */
export function avatarToRoundDataUrl(dna, size, opts) {
  if (typeof document === 'undefined') return null;
  const px = size || 256;
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const c = cv.getContext('2d');
  c.save();
  c.beginPath(); c.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); c.clip();
  const k = 1.3;                       // crop in
  drawAvatar(c, -0.15 * px, -0.16 * px, px * k, dna, opts);
  c.restore();
  try { return cv.toDataURL('image/png'); } catch (e) { return null; }
}

/* ── AVATAR STICKERS · your face as an emoji ──────────────────────
   The same character, pulling a different face and holding a caption.
   Because the avatar is drawn by us, a sticker is just the same code
   with a different expression — nothing to download, and it's yours,
   not a pack borrowed from someone else. */
export const STICKERS = [
  { id: 'hi', label: 'Hi!', text: 'HI!', eyes: 'happy', mouth: 'grin', bg: '#7C3AED' },
  { id: 'lol', label: 'LOL', text: 'LOL', eyes: 'happy', mouth: 'tongue', bg: '#F5B301' },
  { id: 'love', label: 'Love it', text: '♥', eyes: 'stars', mouth: 'smile', bg: '#E11D48' },
  { id: 'wow', label: 'Wow', text: 'WOW', eyes: 'wide', mouth: 'ohh', bg: '#0EA5E9' },
  { id: 'sad', label: 'Aww', text: 'AWW', eyes: 'sleepy', mouth: 'sad', bg: '#64748B' },
  { id: 'wink', label: 'Wink', text: ';)', eyes: 'wink', mouth: 'smirk', bg: '#EC4899' },
  { id: 'ok', label: 'OK', text: 'OK!', eyes: 'happy', mouth: 'smile', bg: '#10B981' },
  { id: 'sleep', label: 'Sleepy', text: 'ZzZ', eyes: 'sleepy', mouth: 'neutral', bg: '#334155' },
  { id: 'think', label: 'Hmm', text: 'HMM', eyes: 'side', mouth: 'smirk', bg: '#F97316' },
  { id: 'yes', label: 'Yes!', text: 'YES', eyes: 'happy', mouth: 'grin', bg: '#22C55E' },
];

/* Render one sticker to a PNG data URL — what gets sent in a chat. */
export function stickerToDataUrl(dna, sticker, size) {
  if (typeof document === 'undefined') return null;
  const px = size || 320;
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const c = cv.getContext('2d');

  // a soft round badge behind the character
  const g = c.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, sticker.bg);
  g.addColorStop(1, shade(sticker.bg, -0.4));
  c.fillStyle = g;
  c.beginPath(); c.arc(px / 2, px / 2, px / 2 - px * 0.02, 0, Math.PI * 2); c.fill();
  c.lineWidth = px * 0.035;
  c.strokeStyle = '#FFFFFF';
  c.stroke();

  // the character, wearing the sticker's expression
  c.save();
  c.beginPath(); c.arc(px / 2, px / 2, px / 2 - px * 0.05, 0, Math.PI * 2); c.clip();
  // framed close, so the expression is the thing you actually read
  drawAvatar(c, -px * 0.02, -px * 0.06, px * 1.04, dna, {
    bg: false, eyes: sticker.eyes, mouth: sticker.mouth,
  });
  c.restore();

  // the caption
  if (sticker.text) {
    const fs = Math.round(px * 0.15);
    c.font = '900 ' + fs + 'px system-ui, -apple-system, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = Math.max(3, px * 0.018);
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.strokeText(sticker.text, px / 2, px * 0.88);
    c.fillStyle = '#FFFFFF';
    c.fillText(sticker.text, px / 2, px * 0.88);
  }

  try { return cv.toDataURL('image/png'); } catch (e) { return null; }
}
