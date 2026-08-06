import { PLACES, rng, rr, paintSky } from './worldCulture';
import { drawMonument, drawToken } from './heritageArt';

/* ─── THE CROSSING · the world it happens in ─────────────────────────
   A street, a river, and whatever else is between you and the monument
   on the far side. Same six places as the climb, so the two games are
   one world.

   Like the climb, everything is laid out inside a fixed VIRTUAL WIDTH,
   so a phone and a laptop play the identical crossing and the shared
   leaderboard means something.

   The traffic in each place is the traffic of that place — the black and
   white taxis and tuk-tuks of Cairo, the calèche of Marrakech, the trams
   of Kyoto. Every one of them is drawn here out of rectangles and arcs,
   by us; none of it is anybody's artwork or anybody's brand.          */

export const COLS = 9;
export const COL = 44;
export const VW_WORLD = COLS * COL;   // 396
export const ROW_H = 46;
export const SPAN = VW_WORLD + 240;   // the loop traffic runs around

export const colX = (col) => col * COL + COL / 2;
export const rowY = (row) => -row * ROW_H;

/* what each place puts on its road and on its water */
const TRAFFIC = {
  giza: { road: ['taxi', 'tuktuk', 'microbus', 'cart'], craft: 'felucca', water: 'The Nile', waterAr: 'النيل', ground: '#C8A96A', grass: '#7A8C4A' },
  petra: { road: ['jeep', 'camel'], craft: 'raft', water: 'The wadi', waterAr: 'الوادي', ground: '#C2624A', grass: '#8A7A4A' },
  marrakech: { road: ['scooter', 'caleche', 'cart'], craft: 'raft', water: 'The canal', waterAr: 'الساقية', ground: '#D98F5C', grass: '#6E8C52' },
  rome: { road: ['scooter', 'car', 'bus'], craft: 'rowboat', water: 'The river', waterAr: 'النهر', ground: '#CBB894', grass: '#6E8C52' },
  agra: { road: ['rickshaw', 'bus', 'cow'], craft: 'woodboat', water: 'The river', waterAr: 'النهر', ground: '#D6C6A8', grass: '#6E9C56' },
  kyoto: { road: ['bike', 'car', 'tram'], craft: 'woodboat', water: 'The canal', waterAr: 'القناة', ground: '#B8A88E', grass: '#5E8C58' },
};

export const STAGES = PLACES.map((place, i) => {
  const goals = [
    { kind: 'cross' },
    { kind: 'tokens', value: 6 },
    { kind: 'cross' },
    { kind: 'time', value: 65 },
    { kind: 'tokens', value: 10 },
    { kind: 'time', value: 75 },
  ];
  return {
    id: place.id,
    place,
    idx: i,
    rows: 30 + i * 5,
    goal: goals[i],
    traffic: TRAFFIC[place.id],
    // everything moves a little quicker the further you travel
    pace: 1 + i * 0.14,
  };
});

export function goalText(st, ar) {
  const g = st.goal;
  if (g.kind === 'tokens') return ar ? 'عدّي واجمع ' + g.value + ' ' + st.place.tokenNameAr : 'Cross and collect ' + g.value + ' ' + st.place.tokenName.toLowerCase() + 's';
  if (g.kind === 'time') return ar ? 'عدّي في أقل من ' + g.value + ' ثانية' : 'Cross in under ' + g.value + 's';
  return ar ? 'اوصل للناحية التانية' : 'Reach the other side';
}

const VEH = {
  taxi: { w: 62, body: '#111318', roof: '#F2F2F2', speed: 108 },
  tuktuk: { w: 40, body: '#1E7F4E', roof: '#0F4F30', speed: 96 },
  microbus: { w: 84, body: '#E8E4D8', roof: '#B9C4CC', speed: 86 },
  cart: { w: 58, body: '#8A5A2A', roof: '#6B421E', speed: 52 },
  jeep: { w: 66, body: '#8A8F6A', roof: '#666B4C', speed: 118 },
  camel: { w: 54, body: '#C79A62', roof: '#A87F4C', speed: 46 },
  scooter: { w: 34, body: '#E23B57', roof: '#B32943', speed: 128 },
  caleche: { w: 74, body: '#3B2E5A', roof: '#241C3A', speed: 58 },
  car: { w: 60, body: '#3E6FD4', roof: '#2B4FA0', speed: 116 },
  bus: { w: 106, body: '#E0932F', roof: '#B4711D', speed: 78 },
  rickshaw: { w: 46, body: '#F0C33C', roof: '#0E7A5A', speed: 104 },
  cow: { w: 58, body: '#EDE6DA', roof: '#C9BCA8', speed: 22 },
  bike: { w: 30, body: '#2FBFA0', roof: '#1B8871', speed: 88 },
  tram: { w: 122, body: '#4CA35A', roof: '#2E6E3C', speed: 96 },
};
export const vehWidth = (kind) => (VEH[kind] || VEH.car).w;

const CRAFT = { felucca: 96, raft: 78, rowboat: 70, woodboat: 86 };
export const craftWidth = (kind) => CRAFT[kind] || 80;

/* ── building one crossing ─────────────────────────────────────────
   Row by row: pavement to stand on, roads to time, water to ride, and a
   railway that is quiet right up until it is not. Two safe rows always
   open the stage and one always closes it, so nobody is killed by the
   first frame or the last one. */
export function makeStage(seed, stageIdx) {
  const st = STAGES[stageIdx % STAGES.length];
  const r = rng(seed + stageIdx * 4211);
  const rows = [];
  const tokens = [];

  /* THE RHYTHM matters more than the randomness. Left to a plain dice
     roll the generator produced three water rows and then seven roads —
     a wall, then a slog, and nowhere to stand and think in between. Two
     of anything is the most you ever get before solid ground, so a
     crossing reads as islands with something between them. */
  let runKind = 'safe';
  let runLen = 2;

  for (let i = 0; i <= st.rows; i++) {
    if (i <= 2 || i === st.rows) { rows.push({ i, kind: 'safe' }); continue; }

    let kind;
    if ((runKind === 'road' || runKind === 'water') && runLen >= 2) {
      kind = 'safe';
    } else {
      const roll = r();
      const lastRail = rows.some((x) => x.kind === 'rail' && i - x.i < 4);
      // it is a street crossing first and a river crossing second
      if (roll < 0.08 && i > 8 && !lastRail) kind = 'rail';
      else if (roll < 0.32) kind = 'water';
      else if (roll < 0.92) kind = 'road';
      else kind = 'safe';
    }

    /* ── A RIVER HAS BANKS ────────────────────────────────────────
       Water put straight against a road was a trap with no way out: a
       boat is a moving deadline, so if the road on the far side never
       cleared before the boat left the screen, you drowned holding a
       choice you never had. Land on both sides of the water fixes it
       — the bank is where you wait and the water is where you move,
       which is the whole rhythm of a crossing. */
    if (runKind === 'water' && kind !== 'water') kind = 'safe';
    else if (kind === 'water' && runKind !== 'water' && runKind !== 'safe') kind = 'safe';

    runLen = kind === runKind ? runLen + 1 : 1;
    runKind = kind;

    if (kind === 'road' || kind === 'water') {
      const isRoad = kind === 'road';
      const pool = isRoad ? st.traffic.road : [st.traffic.craft];
      const veh = pool[Math.floor(r() * pool.length)];
      const base = isRoad ? (VEH[veh] || VEH.car).speed : 30 + r() * 26;
      const width = isRoad ? vehWidth(veh) : craftWidth(veh);
      /* ROADS: never so many cars that the gap between them is smaller
         than a person. A lane you cannot pass is not difficulty, it is
         a wait you can do nothing about.

         WATER: the opposite problem. Boats spaced further apart than one
         hop meant that once you were on one, sideways was drowning and
         the only moves were forward and back — so a boat drifting
         towards the edge with a blocked road ahead was a death you
         could not play your way out of. Enough boats that the gaps
         between them are narrower than a single hop fixes it: there is
         always another boat within reach. */
      const speed = base * st.pace * (0.8 + r() * 0.5) * (stageIdx === 0 && i < 9 ? 0.72 : 1);
      /* Fast traffic gets thinner traffic. Four quick taxis in one lane
         left the lane clear less than a third of the time, which is not
         a challenge so much as a wait for the dice. */
      const roadMost = Math.min(
        Math.max(2, Math.floor(SPAN / (width + 96))),
        speed > 110 ? 3 : 4,
      );
      const n = isRoad
        ? Math.min(2 + Math.floor(r() * 3), roadMost)
        : Math.max(3, Math.ceil(SPAN / (width + 38)));
      rows.push({
        i, kind, veh,
        dir: r() < 0.5 ? -1 : 1,
        speed,
        n,
        gap: SPAN / n,
        off: r() * SPAN,
      });
    } else if (kind === 'rail') {
      rows.push({ i, kind, period: 4200 + r() * 2600, phase: r() * 6000, speed: 900 });
    } else {
      rows.push({ i, kind });
    }

    // something worth stopping for, never on the water
    if (kind !== 'water' && i > 2 && r() < 0.24) {
      tokens.push({ col: Math.floor(r() * COLS), row: i, got: false });
    }
  }
  return { stage: st, rows, tokens, top: st.rows };
}

/* Where each vehicle on a row is right now — one function, used by both
   the drawing and the collision, so what you see is exactly what hits
   you. There is no second copy of this maths to drift out of step. */
export function vehiclesOn(row, t) {
  const out = [];
  if (row.kind !== 'road' && row.kind !== 'water') return out;
  const w = row.kind === 'road' ? vehWidth(row.veh) : craftWidth(row.veh);
  const travel = (row.off + t * 0.001 * row.speed * row.dir) % SPAN;
  for (let i = 0; i < row.n; i++) {
    let x = (travel + i * row.gap) % SPAN;
    if (x < 0) x += SPAN;
    out.push({ x: x - 120, w, kind: row.veh });
  }
  return out;
}

/* The train: silent, then a warning, then gone again. */
export function trainAt(row, t) {
  const cycle = ((t + row.phase) % row.period) / row.period;
  const warnFrom = 0.62;
  if (cycle < warnFrom) return { warn: false, x: null };
  if (cycle < 0.78) return { warn: true, x: null };
  const k = (cycle - 0.78) / 0.16;                 // the sweep across
  if (k > 1) return { warn: false, x: null };
  return { warn: true, x: -260 + k * (VW_WORLD + 520), w: 240 };
}

/* ── drawing ──────────────────────────────────────────────────────── */

function drawVehicle(c, kind, x, y, dir) {
  const v = VEH[kind] || VEH.car;
  const w = v.w, h = 26;
  c.save();
  c.translate(x + w / 2, y);
  if (dir < 0) c.scale(-1, 1);
  c.translate(-w / 2, 0);

  c.fillStyle = 'rgba(0,0,0,0.28)';
  rr(c, 3, -4, w, 8, 4); c.fill();

  if (kind === 'camel' || kind === 'cow') {
    const body = v.body;
    c.fillStyle = body;
    rr(c, 8, -26, w - 20, 15, 7); c.fill();                    // barrel
    if (kind === 'camel') { c.beginPath(); c.arc(w / 2 - 2, -28, 8, Math.PI, 0); c.fill(); }
    c.fillRect(w - 18, -40, 7, 16);                             // neck
    c.beginPath(); c.arc(w - 12, -42, 6, 0, 7); c.fill();       // head
    c.strokeStyle = v.roof; c.lineWidth = 4; c.lineCap = 'round';
    [12, 22, w - 24, w - 16].forEach((lx, i) => {
      c.beginPath(); c.moveTo(lx, -12); c.lineTo(lx + (i % 2 ? 3 : -3), -1); c.stroke();
    });
    c.restore();
    return;
  }

  if (kind === 'scooter' || kind === 'bike') {
    c.strokeStyle = v.body; c.lineWidth = 3.5;
    c.beginPath(); c.arc(8, -7, 7, 0, 7); c.stroke();
    c.beginPath(); c.arc(w - 8, -7, 7, 0, 7); c.stroke();
    c.fillStyle = v.body;
    rr(c, 8, -20, w - 16, 9, 4); c.fill();
    c.fillStyle = '#2B2F3A';                                    // the rider
    rr(c, w / 2 - 5, -36, 11, 18, 5); c.fill();
    c.fillStyle = '#E8B98A';
    c.beginPath(); c.arc(w / 2 + 1, -40, 5.5, 0, 7); c.fill();
    c.restore();
    return;
  }

  if (kind === 'cart' || kind === 'caleche') {
    c.fillStyle = v.body;
    rr(c, 2, -24, w - 24, 14, 4); c.fill();                     // the tray
    if (kind === 'caleche') { c.fillStyle = v.roof; rr(c, 4, -40, w - 30, 18, 6); c.fill(); }
    c.strokeStyle = '#2B2F3A'; c.lineWidth = 3;
    c.beginPath(); c.arc(10, -8, 8, 0, 7); c.stroke();
    c.beginPath(); c.arc(w - 34, -8, 8, 0, 7); c.stroke();
    c.fillStyle = '#A87F4C';                                     // the horse or donkey
    rr(c, w - 26, -28, 20, 12, 6); c.fill();
    c.fillRect(w - 10, -38, 6, 13);
    c.beginPath(); c.arc(w - 6, -40, 5, 0, 7); c.fill();
    c.restore();
    return;
  }

  // everything with a cabin: taxi, bus, tram, car, jeep, microbus, tuktuk, rickshaw
  const roofH = kind === 'bus' || kind === 'tram' || kind === 'microbus' ? 30 : 16;
  c.fillStyle = v.body;
  rr(c, 0, -h - 2, w, h + 2, 6); c.fill();
  c.fillStyle = v.roof;
  rr(c, kind === 'taxi' ? 10 : 4, -h - roofH, w - (kind === 'taxi' ? 20 : 8), roofH + 4, 6); c.fill();
  // windows
  c.fillStyle = 'rgba(180,225,255,0.85)';
  const winY = -h - roofH + 5;
  for (let i = 0; i < Math.max(1, Math.round(w / 26)); i++) {
    rr(c, 10 + i * 24, winY, 16, Math.max(7, roofH - 9), 3); c.fill();
  }
  if (kind === 'taxi') {                                          // the roof sign
    c.fillStyle = '#FFD23F';
    rr(c, w / 2 - 8, -h - roofH - 8, 16, 7, 2); c.fill();
  }
  if (kind === 'rickshaw') {                                      // the canopy edge
    c.fillStyle = v.roof;
    rr(c, 2, -h - roofH - 4, w - 4, 5, 2); c.fill();
  }
  // wheels
  c.fillStyle = '#15171C';
  const wheels = w > 90 ? [14, w / 2, w - 14] : [13, w - 13];
  wheels.forEach((wx) => { c.beginPath(); c.arc(wx, -3, 7.5, 0, 7); c.fill(); });
  c.fillStyle = '#4A4F5A';
  wheels.forEach((wx) => { c.beginPath(); c.arc(wx, -3, 3, 0, 7); c.fill(); });
  // headlight, so which way it is coming is never a guess
  c.fillStyle = '#FFE9A8';
  rr(c, w - 6, -h + 4, 5, 6, 2); c.fill();
  c.restore();
}

function drawCraft(c, kind, x, y, t) {
  const w = craftWidth(kind);
  c.save();
  c.translate(x, y);
  const bob = Math.sin(t * 0.004 + x * 0.03) * 1.6;
  c.translate(0, bob);

  c.fillStyle = 'rgba(0,0,0,0.22)';
  rr(c, 4, -2, w, 7, 3); c.fill();

  if (kind === 'raft') {
    c.fillStyle = '#8A5A2A';
    for (let i = 0; i < 5; i++) {
      rr(c, 2 + i * (w - 6) / 5, -12, (w - 10) / 5, 12, 3);
      c.fill();
    }
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(2, -13, w - 4, 2);
  } else if (kind === 'felucca') {
    c.fillStyle = '#8A6134';                                     // the hull
    c.beginPath();
    c.moveTo(0, -12); c.lineTo(w, -12); c.lineTo(w - 12, 0); c.lineTo(10, 0);
    c.closePath(); c.fill();
    /* The sail is kept short on purpose: a mast the height it would
       really be hides the row above, and what is in the row above is
       what you are about to hop into. */
    c.fillStyle = '#5A3E22';                                     // the gunwale
    c.fillRect(4, -15, w - 12, 3);
    c.fillStyle = '#6B5A3E';
    c.fillRect(w * 0.42, -46, 3.5, 34);                          // the mast
    c.fillStyle = '#FFFFFF';                                     // the lateen sail
    c.beginPath();
    c.moveTo(w * 0.42, -44); c.lineTo(w * 0.42 + 28, -13); c.lineTo(w * 0.42 - 16, -13);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.08)';
    c.beginPath();
    c.moveTo(w * 0.42, -44); c.lineTo(w * 0.42 + 28, -13); c.lineTo(w * 0.42 + 5, -13);
    c.closePath(); c.fill();
  } else if (kind === 'rowboat') {
    c.fillStyle = '#7A4B2A';
    c.beginPath();
    c.moveTo(0, -13); c.quadraticCurveTo(w / 2, 4, w, -13);
    c.lineTo(w, -15); c.quadraticCurveTo(w / 2, -2, 0, -15);
    c.closePath(); c.fill();
    c.fillStyle = '#5A3520';
    c.fillRect(w * 0.3, -14, w * 0.4, 3);
    c.strokeStyle = '#8A6A4A'; c.lineWidth = 2.5;                // the oars
    c.beginPath(); c.moveTo(w * 0.35, -12); c.lineTo(w * 0.12, -2); c.stroke();
    c.beginPath(); c.moveTo(w * 0.65, -12); c.lineTo(w * 0.88, -2); c.stroke();
  } else {
    c.fillStyle = '#6E5236';                                     // a flat wooden boat
    rr(c, 0, -14, w, 14, 4); c.fill();
    c.fillStyle = '#8A6A46';
    rr(c, 5, -17, w - 10, 5, 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 1; i < 4; i++) c.fillRect(i * w / 4, -14, 2, 14);
  }
  c.restore();
}

function drawRowTerrain(c, row, sy, st, t) {
  const p = st.place, tr = st.traffic;
  if (row.kind === 'water') {
    c.fillStyle = '#1D5C8C';
    c.fillRect(0, sy - ROW_H, VW_WORLD, ROW_H);
    c.fillStyle = 'rgba(255,255,255,0.13)';
    for (let i = 0; i < 7; i++) {
      const wx = ((i * 71 + t * 0.012) % (VW_WORLD + 60)) - 30;
      rr(c, wx, sy - ROW_H + 12 + (i % 3) * 9, 26, 3, 1.5); c.fill();
    }
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(0, sy - ROW_H, VW_WORLD, 3);
  } else if (row.kind === 'road') {
    c.fillStyle = '#2E3138';
    c.fillRect(0, sy - ROW_H, VW_WORLD, ROW_H);
    c.fillStyle = 'rgba(255,255,255,0.28)';                       // the lane dashes
    for (let x = 6; x < VW_WORLD; x += 34) c.fillRect(x, sy - ROW_H / 2 - 1.5, 18, 3);
  } else if (row.kind === 'rail') {
    c.fillStyle = '#4A4038';
    c.fillRect(0, sy - ROW_H, VW_WORLD, ROW_H);
    c.fillStyle = '#6B5A48';                                      // sleepers
    for (let x = 2; x < VW_WORLD; x += 22) c.fillRect(x, sy - ROW_H + 8, 14, ROW_H - 16);
    c.fillStyle = '#B9C0C8';                                      // rails
    c.fillRect(0, sy - ROW_H + 13, VW_WORLD, 4);
    c.fillRect(0, sy - 17, VW_WORLD, 4);
  } else {
    // pavement / ground, in the colour of the place
    c.fillStyle = row.i % 2 ? tr.ground : tr.grass;
    c.fillRect(0, sy - ROW_H, VW_WORLD, ROW_H);
    c.fillStyle = 'rgba(0,0,0,0.09)';
    c.fillRect(0, sy - 4, VW_WORLD, 4);
    // a few plants, always in the same places for a given row
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let k = 0; k < 3; k++) {
      const gx = ((row.i * 137 + k * 311) % VW_WORLD);
      c.beginPath(); c.ellipse(gx, sy - 12, 7, 4, 0, 0, 7); c.fill();
    }
    /* One small plant per bank row, in the same place every frame, so
       the ground has something in it without becoming busy. */
    const fx = ((row.i * 219) % VW_WORLD);
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(fx, sy - 8); c.lineTo(fx, sy - 20); c.stroke();
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(fx - 4, sy - 21, 4, 2.6, -0.5, 0, 7); c.fill();
    c.beginPath(); c.ellipse(fx + 4, sy - 23, 4, 2.6, 0.5, 0, 7); c.fill();
  }
}

/* The whole crossing. camY is the world-y at the top of the screen. */
export function drawHopScene(c, VW, VH, camY, level, t, extras) {
  const st = level.stage;
  const p = st.place;
  paintSky(c, VW, VH, p.sky);

  // the far bank: the monument you are crossing towards
  const goalY = rowY(level.top) - camY;
  if (goalY > -400 && goalY < VH + 200) {
    c.save();
    c.globalAlpha = 0.95;
    drawMonument(c, p, VW / 2, goalY - ROW_H, 0.5);
    c.restore();
  }

  for (const row of level.rows) {
    const sy = rowY(row.i) - camY + ROW_H;
    if (sy < -ROW_H || sy > VH + ROW_H * 2) continue;
    drawRowTerrain(c, row, sy, st, t);
  }

  // everything that moves, drawn after all the ground so nothing is
  // half-buried by the row above it
  for (const row of level.rows) {
    const sy = rowY(row.i) - camY + ROW_H;
    if (sy < -ROW_H * 2 || sy > VH + ROW_H * 2) continue;
    if (row.kind === 'road') {
      for (const v of vehiclesOn(row, t)) drawVehicle(c, v.kind, v.x, sy - 8, row.dir);
    } else if (row.kind === 'water') {
      for (const v of vehiclesOn(row, t)) drawCraft(c, v.kind, v.x, sy - 10, t);
    } else if (row.kind === 'rail') {
      const tr = trainAt(row, t);
      if (tr.warn && tr.x == null) {
        // the warning: a red lamp that pulses on both sides of the track
        const on = Math.sin(t * 0.02) > 0;
        c.fillStyle = on ? '#FF3B30' : 'rgba(255,59,48,0.25)';
        c.beginPath(); c.arc(12, sy - ROW_H / 2, 6, 0, 7); c.fill();
        c.beginPath(); c.arc(VW - 12, sy - ROW_H / 2, 6, 0, 7); c.fill();
      }
      if (tr.x != null) {
        c.fillStyle = '#C8412F';
        rr(c, tr.x, sy - ROW_H + 4, tr.w, ROW_H - 10, 6); c.fill();
        c.fillStyle = 'rgba(180,225,255,0.85)';
        for (let i = 0; i < 6; i++) {
          rr(c, tr.x + 14 + i * 38, sy - ROW_H + 11, 24, 13, 3);
          c.fill();
        }
        c.fillStyle = '#7A2418';
        rr(c, tr.x, sy - 12, tr.w, 6, 3); c.fill();
      }
    }
  }

  // tokens
  for (const it of level.tokens) {
    if (it.got) continue;
    const sy = rowY(it.row) - camY + ROW_H;
    if (sy < -30 || sy > VH + 30) continue;
    drawToken(c, p.token, colX(it.col), sy - ROW_H / 2, 13, t);
  }

  const parts = (extras && extras.particles) || [];
  for (const pt of parts) {
    c.globalAlpha = Math.max(0, pt.life);
    c.fillStyle = pt.col;
    c.beginPath(); c.arc(pt.x, pt.y - camY, pt.r, 0, 7); c.fill();
  }
  c.globalAlpha = 1;

  /* The line you must not drop behind, drawn only once it is close
     enough to matter — a warning, not decoration. */
  if (extras && extras.behindY != null) {
    const by = extras.behindY - camY;
    if (by < VH + 30) {
      const g = c.createLinearGradient(0, by, 0, VH);
      g.addColorStop(0, 'rgba(255,59,48,0)');
      g.addColorStop(1, 'rgba(255,59,48,0.45)');
      c.fillStyle = g;
      c.fillRect(0, by, VW, VH - by);
    }
  }
}
