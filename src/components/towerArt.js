import { PLACES, rng, rr, paintSky } from './worldCulture';
import { drawMonument, drawToken } from './heritageArt';

/* ─── THE CLIMB · the world it happens in ────────────────────────────
   A tower drawn inside a fixed VIRTUAL WIDTH. Every phone, every laptop,
   every window size plays the exact same tower — the canvas is scaled to
   the virtual width instead of the level being generated to fit the
   screen. Without that a wide screen would be an easier game and the
   shared leaderboard would be meaningless.

   Up is negative y, the ground is y = 0, and floor n sits at -n·FLOOR_H. */

export const VW_WORLD = 360;      // the virtual width everything is drawn in
export const WALL = 26;           // the stone shaft down each side
export const FLOOR_H = 76;        // the gap between one ledge and the next
export const LEFT = WALL + 6;
export const RIGHT = VW_WORLD - WALL - 6;
export const FLOORS = 220;        // how tall each chapter's tower is built

/* Six chapters, one per place, each with the thing rising behind you and
   a challenge that is not the same challenge as the last one. */
export const CHAPTERS = PLACES.map((place, i) => {
  const goals = [
    { kind: 'floors', value: 40 },
    { kind: 'tokens', value: 10 },
    { kind: 'floors', value: 60 },
    { kind: 'combo', value: 4 },
    { kind: 'tokens', value: 16 },
    { kind: 'floors', value: 90 },
  ];
  const rising = [
    { id: 'sand', label: 'The sandstorm', labelAr: 'العاصفة الرملية', col: 'rgba(214,170,104,', speed: 34 },
    { id: 'dust', label: 'The dust wind', labelAr: 'الغبار', col: 'rgba(196,98,74,', speed: 38 },
    { id: 'haze', label: 'The evening haze', labelAr: 'شبورة المغرب', col: 'rgba(217,111,60,', speed: 41 },
    { id: 'water', label: 'The rising water', labelAr: 'المياه الطالعة', col: 'rgba(58,124,165,', speed: 44 },
    { id: 'rain', label: 'The monsoon', labelAr: 'المطر الموسمي', col: 'rgba(90,140,190,', speed: 47 },
    { id: 'petals', label: 'The blossom storm', labelAr: 'عاصفة الزهر', col: 'rgba(240,150,180,', speed: 50 },
  ];
  return {
    id: place.id,
    place,
    idx: i,
    goal: goals[i],
    rising: rising[i],
    // what the ledges are made of, which changes how they behave
    slippery: place.id === 'kyoto' || place.id === 'agra',   // polished stone
    crumbles: i >= 2,                                        // old ledges give way
    movers: i >= 1,
  };
});

export function goalText(ch, ar) {
  const g = ch.goal;
  if (g.kind === 'floors') return ar ? 'اطلع ' + g.value + ' دور' : 'Climb ' + g.value + ' floors';
  if (g.kind === 'tokens') return ar ? 'اجمع ' + g.value + ' ' + ch.place.tokenNameAr : 'Collect ' + g.value + ' ' + ch.place.tokenName.toLowerCase() + 's';
  return ar ? 'اعمل كومبو ×' + g.value : 'Land a ×' + g.value + ' combo';
}

/* ── building the tower ─────────────────────────────────────────────
   Ledges are placed floor by floor, each one within jumping reach of the
   one below it, so the tower can never generate a wall you cannot pass.
   Every eighth floor is a wide one — somewhere to breathe, and the thing
   that makes a long climb readable. */
export function makeTower(seed, chapterIdx) {
  const ch = CHAPTERS[chapterIdx % CHAPTERS.length];
  const r = rng(seed + chapterIdx * 6151);
  const ledges = [];
  const tokens = [];

  // the ground floor: the whole width, so nobody dies before they start
  ledges.push({ floor: 0, x: LEFT, w: RIGHT - LEFT, y: 0, kind: 'solid' });

  let prevMid = VW_WORLD / 2;
  for (let f = 1; f <= FLOORS; f++) {
    const rest = f % 8 === 0;
    const wide = rest ? 150 : 62 + r() * (f < 12 ? 70 : 48);
    // never further sideways than a jump can carry you
    const reach = 132;
    let mid = prevMid + (r() * 2 - 1) * reach;
    mid = Math.max(LEFT + wide / 2, Math.min(RIGHT - wide / 2, mid));
    let kind = 'solid';
    if (!rest && f > 10) {
      const roll = r();
      if (ch.movers && roll < 0.16) kind = 'mover';
      else if (ch.crumbles && roll < 0.3) kind = 'crumble';
      else if (ch.slippery && roll < 0.44) kind = 'slick';
    }
    const led = {
      floor: f,
      x: mid - wide / 2,
      w: wide,
      y: -f * FLOOR_H,
      kind,
      // movers carry you, which is a gift going up and a trap coming down
      amp: kind === 'mover' ? 40 + r() * 46 : 0,
      spd: kind === 'mover' ? 0.4 + r() * 0.5 : 0,
      phase: r() * 6.28,
      homeX: mid - wide / 2,
    };
    ledges.push(led);
    prevMid = mid;

    // a token every few floors, floating just above a ledge, and always
    // over the harder ledges rather than the easy ones
    if (f > 3 && r() < (kind === 'solid' ? 0.16 : 0.42)) {
      tokens.push({ x: mid, y: -f * FLOOR_H - 34, got: false });
    }
  }

  /* The tower is 220 floors tall and no goal asks for more tokens than
     it scatters, but the check belongs here rather than in a comment:
     a challenge that cannot be met is a broken level, not a hard one. */
  const need = ch.goal.kind === 'tokens' ? ch.goal.value + 3 : 0;
  for (let f = 5; tokens.length < need && f <= FLOORS; f += 3) {
    const led = ledges[f];
    if (!led || tokens.some((t) => Math.abs(t.y + f * FLOOR_H + 34) < 1)) continue;
    tokens.push({ x: led.x + led.w / 2, y: -f * FLOOR_H - 34, got: false });
  }

  return { chapter: ch, ledges, tokens, top: -FLOORS * FLOOR_H };
}

/* Where a ledge actually is this frame (movers slide). */
export function ledgeX(l, t) {
  if (l.kind !== 'mover') return l.x;
  const x = l.homeX + Math.sin(t * 0.001 * l.spd + l.phase) * l.amp;
  return Math.max(LEFT, Math.min(RIGHT - l.w, x));
}

/* ── the walls ──────────────────────────────────────────────────────
   Each place builds its shaft out of what it actually builds with:
   sandstone courses, cut cliff, glazed tile, travertine, marble, timber. */
function drawWalls(c, VH, camY, ch, t) {
  const p = ch.place;
  const top = camY, bottom = camY + VH;
  const block = 30;
  const first = Math.floor(top / block) * block;

  [0, VW_WORLD - WALL].forEach((wx) => {
    c.fillStyle = p.stoneDark;
    c.fillRect(wx, 0, WALL, VH);
    for (let y = first; y < bottom + block; y += block) {
      const sy = y - camY;
      const row = Math.round(y / block);
      if (p.id === 'kyoto') {
        // timber posts and beams
        c.fillStyle = row % 2 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.05)';
        c.fillRect(wx + 2, sy, WALL - 4, block - 3);
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.fillRect(wx + 2, sy + block - 4, WALL - 4, 3);
      } else if (p.id === 'marrakech') {
        // zellige: small glazed diamonds
        c.fillStyle = row % 2 ? 'rgba(47,191,160,0.22)' : 'rgba(255,255,255,0.07)';
        c.fillRect(wx + 2, sy, WALL - 4, block - 3);
        c.fillStyle = p.accent;
        for (let k = 0; k < 2; k++) {
          c.save();
          c.translate(wx + 7 + k * 12, sy + block / 2 - 1);
          c.rotate(Math.PI / 4);
          c.fillRect(-3.4, -3.4, 6.8, 6.8);
          c.restore();
        }
      } else if (p.id === 'agra') {
        c.fillStyle = row % 2 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)';
        c.fillRect(wx + 2, sy, WALL - 4, block - 3);
        c.strokeStyle = 'rgba(91,200,232,0.35)'; c.lineWidth = 1.2;   // inlaid vine
        c.beginPath();
        c.moveTo(wx + 6, sy + 2);
        c.quadraticCurveTo(wx + WALL - 6, sy + block / 2, wx + 6, sy + block - 4);
        c.stroke();
      } else {
        // cut stone courses, offset every other row
        const off = row % 2 ? 0 : WALL / 2;
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.fillRect(wx + 1, sy + block - 4, WALL - 2, 3);
        c.fillStyle = 'rgba(255,255,255,0.06)';
        c.fillRect(wx + 1, sy, WALL - 2, 2);
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(wx + off, sy, 2, block - 3);
      }
    }
    // the inner edge catches the light
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(wx === 0 ? WALL - 3 : VW_WORLD - WALL, 0, 3, VH);
  });
}

function drawLedge(c, l, sx, sy, ch, t) {
  const p = ch.place;
  const h = 15;
  const dying = l.crumbleAt && !l.gone;
  c.save();
  if (dying) {
    const k = Math.min(1, (t - l.crumbleAt) / 520);
    c.translate(Math.sin(t * 0.06) * 3 * k, 0);
    c.globalAlpha = 1 - k * 0.35;
  }

  // shadow under the ledge so it reads as a shelf, not a stripe
  c.fillStyle = 'rgba(0,0,0,0.28)';
  rr(c, sx + 3, sy + 5, l.w, h, 5); c.fill();

  const top = l.kind === 'slick' ? '#DFF3FF' : l.kind === 'crumble' ? p.stoneDark : p.stone;
  c.fillStyle = top;
  rr(c, sx, sy, l.w, h, 5); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.28)';
  rr(c, sx, sy, l.w, 4, 3); c.fill();

  if (l.kind === 'slick') {
    c.fillStyle = 'rgba(120,200,255,0.55)';
    for (let i = 6; i < l.w - 6; i += 14) c.fillRect(sx + i, sy + 6, 7, 2);
  } else if (l.kind === 'crumble') {
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.4;
    for (let i = 10; i < l.w - 6; i += 16) {
      c.beginPath(); c.moveTo(sx + i, sy + 2); c.lineTo(sx + i - 4, sy + h - 2); c.stroke();
    }
  } else if (l.kind === 'mover') {
    c.fillStyle = p.accent;
    c.beginPath(); c.moveTo(sx + 6, sy + h / 2); c.lineTo(sx + 13, sy + 3); c.lineTo(sx + 13, sy + h - 3); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + l.w - 6, sy + h / 2); c.lineTo(sx + l.w - 13, sy + 3); c.lineTo(sx + l.w - 13, sy + h - 3); c.closePath(); c.fill();
  } else {
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 12; i < l.w - 8; i += 22) c.fillRect(sx + i, sy + 5, 2, h - 7);
  }
  c.restore();
}

/* The thing coming up behind you. Not a red line — weather, with a
   surface that moves, so it is obvious what it is without a label. */
function drawRising(c, VW, VH, sy, ch, t) {
  if (sy > VH + 40) return;
  const p = ch.place, R = ch.rising;
  const g = c.createLinearGradient(0, sy - 30, 0, VH);
  g.addColorStop(0, R.col + '0)');
  g.addColorStop(0.35, R.col + '0.75)');
  g.addColorStop(1, R.col + '0.97)');
  c.fillStyle = g;
  c.fillRect(0, Math.max(-40, sy - 30), VW, VH - sy + 70);

  // a moving surface line
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.lineWidth = 2;
  c.beginPath();
  for (let x = 0; x <= VW; x += 8) {
    const y = sy + Math.sin(x * 0.05 + t * 0.004) * 5 + Math.sin(x * 0.013 + t * 0.002) * 4;
    if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();

  // whatever it is made of, blowing upward
  for (let i = 0; i < 16; i++) {
    const px = ((i * 97 + t * 0.06 * (1 + (i % 3))) % (VW + 40)) - 20;
    const py = sy - ((i * 53 + t * 0.09 * (1 + (i % 4))) % 150);
    c.globalAlpha = Math.max(0, 0.5 - (sy - py) / 300);
    if (R.id === 'petals') {
      c.fillStyle = '#FFD3E2';
      c.save(); c.translate(px, py); c.rotate(t * 0.003 + i);
      c.beginPath(); c.ellipse(0, 0, 4, 2.2, 0, 0, 7); c.fill();
      c.restore();
    } else if (R.id === 'rain' || R.id === 'water') {
      c.strokeStyle = 'rgba(220,240,255,0.8)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + 2, py + 9); c.stroke();
    } else {
      c.fillStyle = p.stone;
      c.beginPath(); c.arc(px, py, 2 + (i % 3), 0, 7); c.fill();
    }
    c.globalAlpha = 1;
  }
}

/* ── the whole scene ────────────────────────────────────────────────
   camY is the world-y at the top of the screen. Everything else is
   drawn relative to it; nothing here mutates the world.             */
export function drawTowerScene(c, VW, VH, camY, level, t, extras) {
  const ch = level.chapter;
  const p = ch.place;
  paintSky(c, VW, VH, p.sky);

  // stars, thicker the higher you are
  const high = Math.max(0, Math.min(1, -camY / (FLOORS * FLOOR_H * 0.7)));
  c.fillStyle = 'rgba(255,255,255,' + (0.15 + 0.6 * high) + ')';
  for (let i = 0; i < 46; i++) {
    const sx = (i * 71) % VW;
    const raw = ((i * 137) % (VH * 1.4)) - camY * 0.05;   // drift, not lockstep
    const sy = ((raw % VH) + VH) % VH;
    c.beginPath(); c.arc(sx, sy, (i % 3) * 0.6 + 0.6, 0, 7); c.fill();
  }

  /* The monument itself, on the ground behind the tower. It moves at a
     fraction of the camera, so it sinks away slowly as you climb — which
     is the entire feeling of having got somewhere. The constants put its
     base level with the ground floor on the first frame. */
  const groundY = -camY * 0.42 + VH * 0.36;
  if (groundY > -260) {
    c.save();
    c.globalAlpha = 0.55;
    drawMonument(c, p, VW * 0.5, groundY, 0.62);
    c.restore();
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, groundY, VW, Math.max(0, VH - groundY));
  }

  drawWalls(c, VH, camY, ch, t);

  // ledges
  for (const l of level.ledges) {
    if (l.gone) continue;
    const sy = l.y - camY;
    if (sy < -40 || sy > VH + 40) continue;
    drawLedge(c, l, ledgeX(l, t), sy, ch, t);
  }

  // tokens
  for (const it of level.tokens) {
    if (it.got) continue;
    const sy = it.y - camY;
    if (sy < -30 || sy > VH + 30) continue;
    drawToken(c, p.token, it.x, sy, 13, t);
  }

  // particles (dust off a landing, a token bursting)
  const parts = (extras && extras.particles) || [];
  for (const pt of parts) {
    c.globalAlpha = Math.max(0, pt.life);
    c.fillStyle = pt.col;
    c.beginPath(); c.arc(pt.x, pt.y - camY, pt.r, 0, 7); c.fill();
  }
  c.globalAlpha = 1;

  if (extras && extras.risingY != null) drawRising(c, VW, VH, extras.risingY - camY, ch, t);
}
