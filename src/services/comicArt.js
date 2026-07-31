/* ── THE COMIC PACK · every sticker drawn here, by us ────────────────
   Not one of these is a scan, a download, or somebody else's character.
   They're shapes and words painted onto a canvas at the moment you tap
   them — which is why the pack can be this big and still belongs to
   Moments outright. Nothing here can ever cost us a copyright letter.

   Half of them speak Arabic, because half the people here do. */

const TAU = Math.PI * 2;

/* ── the bones: shapes every sticker is built from ── */

function halftone(c, px, color, alpha) {
  c.save();
  c.globalAlpha = alpha == null ? 0.16 : alpha;
  c.fillStyle = color;
  const step = px * 0.075;
  for (let y = step; y < px; y += step) {
    for (let x = step; x < px; x += step) {
      c.beginPath();
      c.arc(x, y, px * 0.011, 0, TAU);
      c.fill();
    }
  }
  c.restore();
}

/* The classic comic explosion — spiky on the outside, generous inside. */
function burst(c, px, fill, edge, spikes) {
  const n = spikes || 13;
  const cx = px / 2, cy = px / 2;
  const rOut = px * 0.475, rIn = px * 0.345;
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (i / (n * 2)) * TAU - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  const g = c.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, fill);
  g.addColorStop(1, edge);
  c.fillStyle = g;
  c.fill();
  c.lineWidth = px * 0.03;
  c.strokeStyle = '#101024';
  c.stroke();
}

/* A speech bubble with a tail, the way it's drawn in a strip. */
function bubble(c, px, fill) {
  const w = px * 0.86, h = px * 0.62, x = (px - w) / 2, y = px * 0.13, r = px * 0.16;
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.lineTo(x + w * 0.42, y + h);
  c.lineTo(x + w * 0.30, y + h + px * 0.15);
  c.lineTo(x + w * 0.30, y + h);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = px * 0.028;
  c.strokeStyle = '#101024';
  c.stroke();
}

/* A plain round badge, for the drawn icons. */
function badge(c, px, fill, edge) {
  const g = c.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, fill);
  g.addColorStop(1, edge);
  c.beginPath();
  c.arc(px / 2, px / 2, px * 0.46, 0, TAU);
  c.fillStyle = g;
  c.fill();
  c.lineWidth = px * 0.03;
  c.strokeStyle = '#101024';
  c.stroke();
}

/* Fat comic lettering: white fill, hard black outline, a little tilt.
   Shrinks itself until the word fits — a long Arabic word never spills
   over the edge of the badge. */
function shout(c, px, text, fill, tilt, maxW, cyFactor, outline) {
  const limit = (maxW || 0.72) * px;
  let size = px * 0.30;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let i = 0; i < 14; i++) {
    c.font = '900 ' + size + 'px system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif';
    if (c.measureText(text).width <= limit) break;
    size *= 0.9;
  }
  c.save();
  c.translate(px / 2, px * (cyFactor || 0.5));
  c.rotate((tilt || 0) * (Math.PI / 180));
  c.lineJoin = 'round';
  c.lineWidth = px * (outline ? 0.030 : 0.055);
  c.strokeStyle = outline || '#101024';
  c.strokeText(text, 0, 0);
  c.fillStyle = fill || '#FFFFFF';
  c.fillText(text, 0, 0);
  c.restore();
}

/* ── the drawn icons — no text, just shapes ── */

function heart(c, px, color) {
  const s = px * 0.30, cx = px / 2, cy = px * 0.54;
  c.beginPath();
  c.moveTo(cx, cy + s * 0.85);
  c.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.55, cy - s * 1.35, cx, cy - s * 0.35);
  c.bezierCurveTo(cx + s * 0.55, cy - s * 1.35, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.85);
  c.closePath();
  c.fillStyle = color || '#F43F5E';
  c.fill();
  c.lineWidth = px * 0.028; c.strokeStyle = '#101024'; c.stroke();
}

function star5(c, px, color) {
  const cx = px / 2, cy = px / 2, rO = px * 0.28, rI = px * 0.125;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rO : rI;
    const a = (i / 10) * TAU - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  c.fillStyle = color || '#FBBF24'; c.fill();
  c.lineWidth = px * 0.028; c.strokeStyle = '#101024'; c.stroke();
}

function flame(c, px) {
  const cx = px / 2, base = px * 0.76;
  const petal = (w, h, col) => {
    c.beginPath();
    c.moveTo(cx, base);
    c.bezierCurveTo(cx - w, base - h * 0.5, cx - w * 0.5, base - h, cx, base - h * 1.25);
    c.bezierCurveTo(cx + w * 0.5, base - h, cx + w, base - h * 0.5, cx, base);
    c.closePath();
    c.fillStyle = col; c.fill();
  };
  petal(px * 0.24, px * 0.38, '#F97316');
  petal(px * 0.15, px * 0.26, '#FBBF24');
  petal(px * 0.075, px * 0.15, '#FEF3C7');
}

function thumb(c, px, up) {
  c.save();
  c.translate(px / 2, px / 2);
  if (!up) c.rotate(Math.PI);
  c.scale(px / 100, px / 100);
  c.translate(-50, -50);
  c.fillStyle = '#FCD9B6';
  c.strokeStyle = '#101024';
  c.lineWidth = 2.6;
  c.lineJoin = 'round';
  // the classic silhouette: a fist with one thumb straight up
  c.beginPath();
  c.moveTo(36, 74);          // wrist, bottom left
  c.lineTo(36, 50);
  c.quadraticCurveTo(36, 44, 42, 42);
  c.lineTo(46, 41);
  c.quadraticCurveTo(49, 40, 49, 36);
  c.lineTo(49, 26);          // the thumb, pointing at the sky
  c.quadraticCurveTo(49, 20, 54, 20);
  c.quadraticCurveTo(59, 20, 59, 26);
  c.lineTo(59, 40);
  c.lineTo(70, 40);
  c.quadraticCurveTo(76, 40, 76, 46);
  c.quadraticCurveTo(76, 50, 72, 52);
  c.quadraticCurveTo(76, 54, 76, 58);
  c.quadraticCurveTo(76, 62, 72, 64);
  c.quadraticCurveTo(75, 66, 75, 69);
  c.quadraticCurveTo(75, 74, 68, 74);
  c.closePath();
  c.fill(); c.stroke();
  // the fingers folded under
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(60, 52); c.lineTo(71, 52);
  c.moveTo(60, 64); c.lineTo(71, 64);
  c.stroke();
  // the cuff
  c.fillStyle = '#7C3AED';
  c.beginPath();
  c.rect(32, 72, 20, 8);
  c.fill(); c.lineWidth = 2.4; c.stroke();
  c.restore();
}

function coffee(c, px) {
  c.strokeStyle = '#101024'; c.lineWidth = px * 0.026; c.lineJoin = 'round';
  // steam first, behind the cup
  c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = px * 0.026;
  [-0.07, 0.02].forEach((o) => {
    c.beginPath();
    c.moveTo(px * (0.50 + o), px * 0.34);
    c.quadraticCurveTo(px * (0.55 + o), px * 0.28, px * (0.50 + o), px * 0.22);
    c.stroke();
  });
  // the cup
  c.strokeStyle = '#101024';
  c.fillStyle = '#FFFFFF';
  const x = px * 0.32, y = px * 0.40, w = px * 0.30, h = px * 0.26;
  c.beginPath();
  c.moveTo(x, y); c.lineTo(x + w, y);
  c.lineTo(x + w * 0.84, y + h); c.lineTo(x + w * 0.16, y + h);
  c.closePath(); c.fill(); c.stroke();
  // the handle
  c.beginPath(); c.arc(x + w + px * 0.02, y + h * 0.38, px * 0.052, -1.1, 1.4); c.stroke();
  // what's in it
  c.fillStyle = '#6B3F1D';
  c.beginPath(); c.ellipse(x + w / 2, y + px * 0.008, w * 0.46, px * 0.030, 0, 0, TAU); c.fill();
  c.lineWidth = px * 0.016; c.stroke();
}

function ball(c, px) {
  c.beginPath(); c.arc(px / 2, px / 2, px * 0.24, 0, TAU);
  c.fillStyle = '#FFFFFF'; c.fill();
  c.lineWidth = px * 0.026; c.strokeStyle = '#101024'; c.stroke();
  c.fillStyle = '#101024';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    c.beginPath();
    c.arc(px / 2 + Math.cos(a) * px * 0.16, px / 2 + Math.sin(a) * px * 0.16, px * 0.026, 0, TAU);
    c.fill();
  }
  c.beginPath(); c.arc(px / 2, px / 2, px * 0.048, 0, TAU); c.fill();
}

function moonNight(c, px) {
  c.fillStyle = '#FDE68A';
  c.beginPath(); c.arc(px * 0.52, px * 0.48, px * 0.20, 0, TAU); c.fill();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath(); c.arc(px * 0.60, px * 0.40, px * 0.18, 0, TAU); c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#FFFFFF';
  [[0.30, 0.28, 0.016], [0.70, 0.66, 0.020], [0.34, 0.70, 0.013]].forEach(([x, y, r]) => {
    c.beginPath(); c.arc(px * x, px * y, px * r, 0, TAU); c.fill();
  });
}

function cake(c, px) {
  c.strokeStyle = '#101024'; c.lineWidth = px * 0.024;
  c.fillStyle = '#FDE68A';
  c.beginPath(); c.rect(px * 0.30, px * 0.50, px * 0.40, px * 0.20); c.fill(); c.stroke();
  c.fillStyle = '#F9A8D4';
  c.beginPath(); c.rect(px * 0.30, px * 0.44, px * 0.40, px * 0.08); c.fill(); c.stroke();
  c.fillStyle = '#FFFFFF';
  c.beginPath(); c.rect(px * 0.48, px * 0.32, px * 0.04, px * 0.12); c.fill(); c.stroke();
  flameSmall(c, px, px * 0.50, px * 0.30);
}

function flameSmall(c, px, x, y) {
  c.beginPath();
  c.moveTo(x, y);
  c.bezierCurveTo(x - px * 0.04, y - px * 0.03, x - px * 0.02, y - px * 0.08, x, y - px * 0.10);
  c.bezierCurveTo(x + px * 0.02, y - px * 0.08, x + px * 0.04, y - px * 0.03, x, y);
  c.closePath();
  c.fillStyle = '#FB923C'; c.fill();
}

function rocket(c, px) {
  c.save();
  c.translate(px / 2, px / 2);
  c.rotate(-0.35);
  c.strokeStyle = '#101024'; c.lineWidth = px * 0.024;
  c.fillStyle = '#F8FAFC';
  c.beginPath();
  c.moveTo(0, -px * 0.26);
  c.bezierCurveTo(px * 0.13, -px * 0.06, px * 0.11, px * 0.12, 0, px * 0.20);
  c.bezierCurveTo(-px * 0.11, px * 0.12, -px * 0.13, -px * 0.06, 0, -px * 0.26);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#38BDF8';
  c.beginPath(); c.arc(0, -px * 0.06, px * 0.055, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#EF4444';
  [-1, 1].forEach((s) => {
    c.beginPath();
    c.moveTo(s * px * 0.075, px * 0.06);
    c.lineTo(s * px * 0.19, px * 0.20);
    c.lineTo(s * px * 0.06, px * 0.19);
    c.closePath(); c.fill(); c.stroke();
  });
  c.fillStyle = '#FB923C';
  c.beginPath();
  c.moveTo(-px * 0.05, px * 0.20); c.lineTo(0, px * 0.36); c.lineTo(px * 0.05, px * 0.20);
  c.closePath(); c.fill();
  c.restore();
}

function crown(c, px) {
  c.fillStyle = '#FBBF24'; c.strokeStyle = '#101024'; c.lineWidth = px * 0.026;
  c.beginPath();
  c.moveTo(px * 0.28, px * 0.62);
  c.lineTo(px * 0.28, px * 0.38);
  c.lineTo(px * 0.39, px * 0.50);
  c.lineTo(px * 0.50, px * 0.34);
  c.lineTo(px * 0.61, px * 0.50);
  c.lineTo(px * 0.72, px * 0.38);
  c.lineTo(px * 0.72, px * 0.62);
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#EF4444';
  [0.36, 0.50, 0.64].forEach((x) => { c.beginPath(); c.arc(px * x, px * 0.56, px * 0.022, 0, TAU); c.fill(); });
}

function note(c, px) {
  c.fillStyle = '#FFFFFF'; c.strokeStyle = '#101024'; c.lineWidth = px * 0.026;
  c.beginPath(); c.ellipse(px * 0.40, px * 0.62, px * 0.085, px * 0.065, -0.3, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(px * 0.66, px * 0.55, px * 0.085, px * 0.065, -0.3, 0, TAU); c.fill(); c.stroke();
  c.lineWidth = px * 0.035;
  c.beginPath();
  c.moveTo(px * 0.475, px * 0.615); c.lineTo(px * 0.475, px * 0.34);
  c.lineTo(px * 0.735, px * 0.28); c.lineTo(px * 0.735, px * 0.545);
  c.stroke();
}

function rain(c, px) {
  c.fillStyle = '#E2E8F0'; c.strokeStyle = '#101024'; c.lineWidth = px * 0.024;
  c.beginPath();
  c.arc(px * 0.40, px * 0.44, px * 0.11, 0, TAU);
  c.arc(px * 0.56, px * 0.42, px * 0.14, 0, TAU);
  c.arc(px * 0.68, px * 0.48, px * 0.09, 0, TAU);
  c.fill();
  c.fillStyle = '#38BDF8';
  [[0.42, 0.64], [0.54, 0.70], [0.66, 0.64]].forEach(([x, y]) => {
    c.beginPath();
    c.moveTo(px * x, px * y);
    c.lineTo(px * (x - 0.025), px * (y + 0.09));
    c.lineTo(px * (x + 0.025), px * (y + 0.09));
    c.closePath(); c.fill();
  });
}

function shades(c, px) {
  c.fillStyle = '#FCD9B6';
  c.beginPath(); c.arc(px / 2, px / 2, px * 0.28, 0, TAU); c.fill();
  c.lineWidth = px * 0.026; c.strokeStyle = '#101024'; c.stroke();
  c.fillStyle = '#101024';
  c.beginPath();
  c.roundRect ? c.roundRect(px * 0.28, px * 0.42, px * 0.18, px * 0.10, px * 0.04)
              : c.rect(px * 0.28, px * 0.42, px * 0.18, px * 0.10);
  c.fill();
  c.beginPath();
  c.roundRect ? c.roundRect(px * 0.54, px * 0.42, px * 0.18, px * 0.10, px * 0.04)
              : c.rect(px * 0.54, px * 0.42, px * 0.18, px * 0.10);
  c.fill();
  c.lineWidth = px * 0.018;
  c.beginPath(); c.moveTo(px * 0.46, px * 0.46); c.lineTo(px * 0.54, px * 0.46); c.stroke();
  c.beginPath();
  c.arc(px / 2, px * 0.62, px * 0.09, 0.15, Math.PI - 0.15);
  c.lineWidth = px * 0.024; c.stroke();
}

function handWave(c, px) {
  c.save();
  c.translate(px / 2, px / 2);
  c.rotate(0.22);
  c.scale(px / 100, px / 100);
  c.translate(-50, -50);
  c.fillStyle = '#FCD9B6'; c.strokeStyle = '#101024';
  c.lineWidth = 2.6; c.lineJoin = 'round';
  // palm
  c.beginPath();
  c.moveTo(34, 56);
  c.quadraticCurveTo(32, 74, 50, 78);
  c.quadraticCurveTo(68, 78, 68, 58);
  c.lineTo(68, 44);
  c.lineTo(34, 44);
  c.closePath();
  c.fill(); c.stroke();
  // four fingers, each its own shape so they read as fingers
  [38, 48, 58, 67].forEach((x, i) => {
    const top = [30, 24, 26, 33][i];
    c.beginPath();
    c.moveTo(x - 4, 48);
    c.lineTo(x - 4, top + 5);
    c.quadraticCurveTo(x, top - 2, x + 4, top + 5);
    c.lineTo(x + 4, 48);
    c.closePath();
    c.fill(); c.stroke();
  });
  // thumb
  c.beginPath();
  c.moveTo(34, 52);
  c.quadraticCurveTo(22, 54, 24, 63);
  c.quadraticCurveTo(27, 69, 36, 64);
  c.closePath();
  c.fill(); c.stroke();
  c.restore();
}

const ICONS = {
  heart, star5, flame, coffee, ball, moonNight, cake, rocket, crown, note, rain, shades, handWave,
  thumbUp: (c, px) => thumb(c, px, true),
  thumbDown: (c, px) => thumb(c, px, false),
};

/* ── the pack ──────────────────────────────────────────────────────
   kind: 'burst' (spiky + a word) · 'bubble' (speech + a word) ·
   'icon' (a drawn thing on a plain badge). */
export const COMICS = [
  // English shouts
  { id: 'pow', label: 'POW', kind: 'burst', text: 'POW!', bg: '#F43F5E', edge: '#7F1D1D', tilt: -8 },
  { id: 'boom', label: 'BOOM', kind: 'burst', text: 'BOOM!', bg: '#F97316', edge: '#7C2D12', tilt: 6 },
  { id: 'wow', label: 'WOW', kind: 'burst', text: 'WOW!', bg: '#0EA5E9', edge: '#0C4A6E', tilt: -5 },
  { id: 'lol', label: 'LOL', kind: 'burst', text: 'LOL', bg: '#FBBF24', edge: '#92400E', tilt: 8 },
  { id: 'omg', label: 'OMG', kind: 'burst', text: 'OMG!', bg: '#A855F7', edge: '#4C1D95', tilt: -6 },
  { id: 'yes', label: 'YES', kind: 'burst', text: 'YES!', bg: '#22C55E', edge: '#14532D', tilt: 5 },
  { id: 'nope', label: 'NOPE', kind: 'burst', text: 'NOPE', bg: '#64748B', edge: '#1E293B', tilt: -4 },
  { id: 'oops', label: 'Oops', kind: 'bubble', text: 'oops', bg: '#FDE68A', ink: '#101024', tilt: -3 },
  { id: 'brb', label: 'BRB', kind: 'bubble', text: 'brb', bg: '#E0E7FF', ink: '#101024', tilt: 2 },
  { id: 'hi', label: 'Hi', kind: 'bubble', text: 'hi!', bg: '#FFFFFF', ink: '#101024', tilt: -2 },
  { id: 'ok', label: 'OK', kind: 'bubble', text: 'ok', bg: '#DCFCE7', ink: '#101024', tilt: 3 },
  { id: 'huh', label: 'Huh?', kind: 'bubble', text: '?!', bg: '#FFFFFF', ink: '#101024', tilt: -4 },
  { id: 'bravo', label: 'Bravo', kind: 'burst', text: 'BRAVO', bg: '#EC4899', edge: '#831843', tilt: 4 },
  { id: 'thanks', label: 'Thanks', kind: 'bubble', text: 'thanks!', bg: '#FFFFFF', ink: '#101024', tilt: -2 },

  // Arabic — the way people here actually talk
  { id: 'yalla', label: 'يلا', kind: 'burst', text: 'يلا!', bg: '#7C3AED', edge: '#3B0764', tilt: -6 },
  { id: 'tamam', label: 'تمام', kind: 'bubble', text: 'تمام', bg: '#DCFCE7', ink: '#101024', tilt: 2 },
  { id: 'habibi', label: 'حبيبي', kind: 'burst', text: 'حبيبي', bg: '#F43F5E', edge: '#7F1D1D', tilt: 5 },
  { id: 'mabrouk', label: 'مبروك', kind: 'burst', text: 'مبروك', bg: '#FBBF24', edge: '#92400E', tilt: -4 },
  { id: 'khalas', label: 'خلاص', kind: 'bubble', text: 'خلاص', bg: '#FEE2E2', ink: '#101024', tilt: 3 },
  { id: 'helw', label: 'حلو', kind: 'burst', text: 'حلو!', bg: '#22C55E', edge: '#14532D', tilt: -5 },
  { id: 'meen', label: 'مين؟', kind: 'bubble', text: 'مين؟', bg: '#FFFFFF', ink: '#101024', tilt: -3 },
  { id: 'ezayak', label: 'عامل ايه', kind: 'bubble', text: 'عامل ايه؟', bg: '#E0F2FE', ink: '#101024', tilt: 2 },
  { id: 'wahashtny', label: 'وحشتني', kind: 'burst', text: 'وحشتني', bg: '#EC4899', edge: '#831843', tilt: 4 },
  { id: 'rabena', label: 'ربنا يكرمك', kind: 'bubble', text: 'ربنا يكرمك', bg: '#FEF3C7', ink: '#101024', tilt: -2 },
  { id: 'esbr', label: 'اصبر', kind: 'bubble', text: 'استنى بس', bg: '#F1F5F9', ink: '#101024', tilt: 3 },
  { id: 'gamed', label: 'جامد', kind: 'burst', text: 'جامد!', bg: '#0EA5E9', edge: '#0C4A6E', tilt: -7 },

  // drawn things
  { id: 'i-heart', label: 'Love', kind: 'icon', icon: 'heart', bg: '#FECDD3', edge: '#F43F5E' },
  { id: 'i-star', label: 'Star', kind: 'icon', icon: 'star5', bg: '#FEF3C7', edge: '#F59E0B' },
  { id: 'i-fire', label: 'Fire', kind: 'icon', icon: 'flame', bg: '#FFEDD5', edge: '#EA580C' },
  { id: 'i-up', label: 'Nice', kind: 'icon', icon: 'thumbUp', bg: '#DCFCE7', edge: '#16A34A' },
  { id: 'i-down', label: 'Nope', kind: 'icon', icon: 'thumbDown', bg: '#FEE2E2', edge: '#DC2626' },
  { id: 'i-coffee', label: 'Coffee', kind: 'icon', icon: 'coffee', bg: '#F5E6D3', edge: '#92400E' },
  { id: 'i-ball', label: 'Match', kind: 'icon', icon: 'ball', bg: '#DCFCE7', edge: '#15803D' },
  { id: 'i-moon', label: 'Night', kind: 'icon', icon: 'moonNight', bg: '#1E293B', edge: '#0F172A' },
  { id: 'i-cake', label: 'Birthday', kind: 'icon', icon: 'cake', bg: '#FCE7F3', edge: '#DB2777' },
  { id: 'i-rocket', label: 'Let’s go', kind: 'icon', icon: 'rocket', bg: '#E0E7FF', edge: '#4338CA' },
  { id: 'i-crown', label: 'King', kind: 'icon', icon: 'crown', bg: '#FEF3C7', edge: '#B45309' },
  { id: 'i-note', label: 'Tune', kind: 'icon', icon: 'note', bg: '#EDE9FE', edge: '#6D28D9' },
  { id: 'i-rain', label: 'Rainy', kind: 'icon', icon: 'rain', bg: '#E0F2FE', edge: '#0369A1' },
  { id: 'i-cool', label: 'Cool', kind: 'icon', icon: 'shades', bg: '#FEF9C3', edge: '#CA8A04' },
  { id: 'i-wave', label: 'Wave', kind: 'icon', icon: 'handWave', bg: '#FFE4E6', edge: '#E11D48' },
];

/* Draw one and hand back a PNG data URL — exactly what a chat message
   or a story overlay needs. Web-only by nature (canvas); callers get
   null elsewhere and simply don't show the pack. */
export function comicToDataUrl(item, size) {
  if (typeof document === 'undefined' || !item) return null;
  const px = size || 320;
  const cv = document.createElement('canvas');
  cv.width = px; cv.height = px;
  const c = cv.getContext('2d');
  if (!c) return null;

  try {
    if (item.kind === 'burst') {
      burst(c, px, item.bg, item.edge, 13);
      halftone(c, px, '#FFFFFF', 0.13);
      shout(c, px, item.text, '#FFFFFF', item.tilt, 0.62);
    } else if (item.kind === 'bubble') {
      bubble(c, px, item.bg);
      shout(c, px, item.text, item.ink || '#101024', item.tilt, 0.62, 0.44, '#FFFFFF');
    } else {
      badge(c, px, item.bg, item.edge);
      halftone(c, px, '#FFFFFF', 0.10);
      const draw = ICONS[item.icon];
      if (draw) draw(c, px);
    }
  } catch (e) { return null; }
  return cv.toDataURL('image/png');
}
