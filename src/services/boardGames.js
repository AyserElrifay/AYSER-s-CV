/* ─── TWO PEOPLE, ONE BOARD ───────────────────────────────────────────
   Four turn-based games you play against a real person from a chat.

   Everything in here is a pure function: given a board and a move, it
   returns the next board. No timers, no randomness inside a move, no
   reaching for the network. That matters for two reasons —

     · both phones run the same function on the same move and land on
       the same board, so nobody can be shown a different game to the
       one their opponent is playing;
     · the whole board is a small piece of JSON, so it can live in the
       match row and survive a reload, a flat battery, or a flight.

   Where a game normally needs dice — Snakes & Ladders, and the Ludo-ish
   race — we don't roll any. Ayser asked for those two without dice, and
   it turns out that's the better game anyway: instead of luck deciding,
   you're handed a small hand of steps and you choose which piece to
   spend them on. The hand is dealt from a shuffled bag that both sides
   derive from the same seed, so it is fair, identical on both phones,
   and never something one side could rig. */

export const GAMES = [
  {
    id: 'xo',
    title: 'XO',
    emoji: '⭕',
    blurb: 'Three in a row. Older than all of us, still unbeaten.',
    players: 2,
  },
  {
    id: 'four',
    title: 'Connect Four',
    emoji: '🔴',
    blurb: 'Drop a disc, get four in a line — across, down or diagonal.',
    players: 2,
  },
  {
    id: 'snakes',
    title: 'Snakes & Ladders',
    emoji: '🐍',
    blurb: 'No dice. You get a hand of steps and choose how to spend them.',
    players: 2,
  },
  {
    id: 'race',
    title: 'Four Home',
    emoji: '🏠',
    blurb: 'Get all four pieces home. No dice — you pick the move.',
    players: 2,
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id) || null;
export const isBoardGame = (kind) => !!gameById(kind);

/* ── a shared shuffle ──────────────────────────────────────────────
   Both phones need the same sequence of step values, and neither is
   allowed to influence it. So the sequence comes out of the match id:
   a small deterministic generator, seeded once, producing the same bag
   of numbers on both sides forever. */
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* A bag holding a fair spread of step values, shuffled once. Drawing
   from a bag rather than rolling means over a game you get the same
   spread of numbers your opponent does — the luck is in the order, and
   the skill is in what you do with it.

   The bag wraps: draw past the end and you come round to the front
   again. That matters — the first version held a fixed 120 steps, three
   went every turn, and on turn 41 a game simply handed both players an
   empty hand and stopped. A wrapping bag can't run out, and it keeps
   the state small enough to sit in a database row. */
function stepBag(seed, length) {
  const values = [1, 2, 3, 4, 5, 6];
  const bag = [];
  while (bag.length < length) values.forEach((v) => bag.push(v));
  const r = rng(seed);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
  }
  return bag.slice(0, length);
}

/* The next `n` steps, wrapping round the bag. */
function drawFrom(state, n) {
  const bag = state.bag || [];
  if (!bag.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(bag[(state.draw + i) % bag.length]);
  return out;
}

/* ── XO ────────────────────────────────────────────────────────────── */
const XO_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function xoNew() {
  return { cells: Array(9).fill(0) };
}

function xoWinner(cells) {
  for (const [a, b, c] of XO_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) return { seat: cells[a], line: [a, b, c] };
  }
  return null;
}

function xoMove(state, seat, move) {
  const i = move.cell;
  if (!Number.isInteger(i) || i < 0 || i > 8) return null;
  if (state.cells[i]) return null;
  const cells = state.cells.slice();
  cells[i] = seat;
  const win = xoWinner(cells);
  return {
    state: { cells, line: win ? win.line : null },
    over: !!win || cells.every(Boolean),
    winner: win ? win.seat : 0,
    pass: true,
  };
}

/* ── Connect Four ──────────────────────────────────────────────────── */
const F_COLS = 7, F_ROWS = 6;

function fourNew() {
  return { cells: Array(F_COLS * F_ROWS).fill(0) };
}

const fAt = (cells, col, row) => cells[row * F_COLS + col];

function fourWinner(cells, col, row) {
  const seat = fAt(cells, col, row);
  if (!seat) return null;
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of dirs) {
    const line = [row * F_COLS + col];
    for (const sign of [1, -1]) {
      let c = col + dx * sign, r = row + dy * sign;
      while (c >= 0 && c < F_COLS && r >= 0 && r < F_ROWS && fAt(cells, c, r) === seat) {
        line.push(r * F_COLS + c);
        c += dx * sign; r += dy * sign;
      }
    }
    if (line.length >= 4) return { seat, line };
  }
  return null;
}

function fourMove(state, seat, move) {
  const col = move.col;
  if (!Number.isInteger(col) || col < 0 || col >= F_COLS) return null;
  const cells = state.cells.slice();
  let row = -1;
  for (let r = F_ROWS - 1; r >= 0; r--) {
    if (!fAt(cells, col, r)) { row = r; break; }
  }
  if (row < 0) return null;                     // that column is full
  cells[row * F_COLS + col] = seat;
  const win = fourWinner(cells, col, row);
  return {
    state: { cells, line: win ? win.line : null, last: row * F_COLS + col },
    over: !!win || cells.every(Boolean),
    winner: win ? win.seat : 0,
    pass: true,
  };
}

/* ── Snakes & Ladders, without dice ─────────────────────────────────
   The board is the board everyone knows. What changes is how you move:
   each turn you're shown three steps drawn from the shared bag, and you
   pick one. Landing on a ladder still lifts you, landing on a snake
   still drops you — so the choice is real: the big number isn't always
   the good one, and that is the whole game. */
const SNAKES = { 17: 7, 24: 9, 39: 20, 47: 26, 58: 38, 66: 45, 74: 53, 87: 64, 93: 72, 99: 78 };
const LADDERS = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 };
const S_GOAL = 100;

function snakesNew(seed) {
  return { pos: [0, 0], bag: stepBag(seed, 60), draw: 0, hand: 3, last: null };
}

function snakesHand(state) {
  return drawFrom(state, state.hand || 3);
}

function snakesMove(state, seat, move) {
  const hand = snakesHand(state);
  const idx = move.pick;
  if (!Number.isInteger(idx) || idx < 0 || idx >= hand.length) return null;
  const step = hand[idx];
  const pos = state.pos.slice();
  const from = pos[seat - 1];
  let next = from + step;
  if (next > S_GOAL) next = from;                // overshooting stays put
  let via = null;
  if (LADDERS[next]) { via = { kind: 'ladder', from: next, to: LADDERS[next] }; next = LADDERS[next]; }
  else if (SNAKES[next]) { via = { kind: 'snake', from: next, to: SNAKES[next] }; next = SNAKES[next]; }
  pos[seat - 1] = next;
  return {
    state: { ...state, pos, draw: state.draw + hand.length, last: { seat, step, via, to: next } },
    over: next >= S_GOAL,
    winner: next >= S_GOAL ? seat : 0,
    pass: true,
  };
}

/* ── Four Home ──────────────────────────────────────────────────────
   The Ludo shape — four pieces each, once round the track, first one
   home wins — with the dice taken out, exactly as asked. Each turn you
   get three steps from the shared bag and choose BOTH which step to use
   and which of your pieces spends it. Landing on the other side's piece
   sends it back to the start, so the whole thing is a real decision
   every single turn instead of a wait for a six. */
const R_TRACK = 40;                              // squares once round
const R_HOME = R_TRACK + 4;                      // 4 home squares past the lap
const R_START = [0, 20];                         // where each side joins the track

function raceNew(seed) {
  return { pieces: [[-1, -1, -1, -1], [-1, -1, -1, -1]], bag: stepBag(seed, 60), draw: 0, hand: 3, last: null };
}

function raceHand(state) {
  return drawFrom(state, state.hand || 3);
}

/* Where a piece actually sits on the shared ring, so we can tell
   whether two pieces from opposite sides are on the same square. */
export function raceRingIndex(seat, p) {
  if (p < 0 || p >= R_TRACK) return -1;          // not out, or already home-bound
  return (R_START[seat - 1] + p) % R_TRACK;
}

function raceMove(state, seat, move) {
  const hand = raceHand(state);
  const { pick, piece } = move;
  if (!Number.isInteger(pick) || pick < 0 || pick >= hand.length) return null;
  if (!Number.isInteger(piece) || piece < 0 || piece > 3) return null;

  const step = hand[pick];
  const mine = state.pieces[seat - 1].slice();
  const theirs = state.pieces[2 - seat].slice();
  const at = mine[piece];

  let next;
  if (at < 0) {
    /* A piece leaves the start on any step. Dice games make you wait
       for a six because a roll can't be chosen — here it can, so that
       rule only ever produced turns where you sat and did nothing. It
       also deadlocked the opening outright whenever the first hand
       held neither a 1 nor a 6. */
    next = step - 1;
  } else {
    next = at + step;
    if (next > R_HOME) return null;              // must land home exactly
  }
  mine[piece] = next;

  // send anyone standing there back to the start
  const ring = raceRingIndex(seat, next);
  if (ring >= 0) {
    for (let i = 0; i < 4; i++) {
      if (theirs[i] >= 0 && raceRingIndex(3 - seat, theirs[i]) === ring) theirs[i] = -1;
    }
  }

  const pieces = seat === 1 ? [mine, theirs] : [theirs, mine];
  const home = mine.filter((x) => x >= R_HOME).length;
  return {
    state: { ...state, pieces, draw: state.draw + hand.length, last: { seat, step, piece, to: next } },
    over: home === 4,
    winner: home === 4 ? seat : 0,
    pass: true,
  };
}

/* Can this seat do anything at all with the hand it has? If not, the
   turn passes rather than the game locking up. */
function raceCanMove(state, seat) {
  const hand = raceHand(state);
  for (let p = 0; p < hand.length; p++) {
    for (let i = 0; i < 4; i++) {
      if (raceMove(state, seat, { pick: p, piece: i })) return true;
    }
  }
  return false;
}

/* ── one shape for all four ────────────────────────────────────────── */

export function newBoard(kind, matchId) {
  const seed = seedFrom(matchId || 'moments');
  if (kind === 'xo') return xoNew();
  if (kind === 'four') return fourNew();
  if (kind === 'snakes') return snakesNew(seed);
  if (kind === 'race') return raceNew(seed);
  return null;
}

/* Apply a move. Returns null when the move isn't legal — the caller
   simply does nothing, which is the correct response to an illegal
   move whether it came from a mis-tap or from someone poking the API. */
export function applyMove(kind, state, seat, move) {
  if (!state || (seat !== 1 && seat !== 2)) return null;
  const out =
    kind === 'xo' ? xoMove(state, seat, move)
      : kind === 'four' ? fourMove(state, seat, move)
        : kind === 'snakes' ? snakesMove(state, seat, move)
          : kind === 'race' ? raceMove(state, seat, move)
            : null;
  if (!out) return null;

  /* Whoever is up next might be handed three numbers they can't use —
     every piece still boxed in, nothing that lands home exactly. Rather
     than freezing the game on a turn nobody can take, deal past that
     hand until somebody can move. The hand comes off the shared bag, so
     both phones skip in exactly the same places. */
  let nextSeat = out.pass ? (3 - seat) : seat;
  if (!out.over && kind === 'race') {
    let guard = 0;
    while (guard++ < 12 && !raceCanMove(out.state, nextSeat)) {
      out.state = { ...out.state, draw: out.state.draw + (out.state.hand || 3), skipped: nextSeat };
      // try the other side on this fresh hand before dealing again
      if (raceCanMove(out.state, 3 - nextSeat)) { nextSeat = 3 - nextSeat; break; }
    }
  }
  return { ...out, nextSeat };
}

/* What the player is being offered this turn — three steps, or nothing
   for the games that don't work that way. */
export function handFor(kind, state) {
  if (!state) return [];
  if (kind === 'snakes') return snakesHand(state);
  if (kind === 'race') return raceHand(state);
  return [];
}

export const BOARD_META = {
  xo: { cols: 3, rows: 3 },
  four: { cols: F_COLS, rows: F_ROWS },
  snakes: { goal: S_GOAL, snakes: SNAKES, ladders: LADDERS },
  race: { track: R_TRACK, home: R_HOME, starts: R_START },
};
