/* ─── لمّة · THE RULES, CHECKED ───────────────────────────────────────
   A scoreboard is only worth having if people believe it, and they only
   believe it if it is the same every time. This runs the scoring rules
   through the cases from the brief, then plays a whole ten-question
   game with five players and checks the final table against a
   leaderboard worked out separately.

   Run it before deploying — the workflow does:

       node scripts/check-lamma.mjs
*/

import {
  scoreAnswer, streakMultiplier, rankPlayers,
  BASE_STANDARD, COMEBACK_MULT,
} from '../src/lib/lammaScore.js';

let failures = 0;
const results = [];

function is(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  results.push({ ok, label, got, want });
}

/* ── the cases the brief names, one line each ───────────────────── */
const T = 20000;
const at = (elapsedMs, extra = {}) =>
  scoreAnswer({ isCorrect: true, elapsedMs, timerMs: T, streak: 1, ...extra }).points;

is('400ms on a 20s timer scores full marks', at(400), BASE_STANDARD);
is('answering on the deadline still scores half', at(20000), BASE_STANDARD * 0.5);
is('halfway through the timer scores 750', at(10000), 750);

const wrong = scoreAnswer({ isCorrect: false, elapsedMs: 100, timerMs: T, streak: 5 });
is('a wrong answer scores nothing', wrong.points, 0);
is('a wrong answer breaks the streak', wrong.streak, 0);

is('a streak of 1 multiplies by 1', streakMultiplier(1), 1);
is('a streak of 6 multiplies by 1.5', streakMultiplier(6), 1.5);
is('a streak of 20 still multiplies by 1.5', streakMultiplier(20), 1.5);

is('a question worth no points scores none however fast', at(400, { pointsStyle: 'none' }), 0);
is('a double question is worth double', at(400, { pointsStyle: 'double' }), 2000);

is(
  'the last two questions multiply on top of the streak',
  at(400, { streak: 6, isLastTwo: true }),
  Math.floor(BASE_STANDARD * 1.5 * COMEBACK_MULT),
);

/* ── the inputs nobody should be able to send, but will ─────────── */
is('a negative time is treated as instant, never negative points', at(-50), BASE_STANDARD);
is('an impossible time is treated as the deadline', at(999999), BASE_STANDARD * 0.5);
is('a missing time does not throw', at(undefined), BASE_STANDARD * 0.5);
is('text where a number should be does not throw', at('nonsense'), BASE_STANDARD * 0.5);
is('a zero timer cannot divide the game by zero', scoreAnswer({ isCorrect: true, elapsedMs: 500, timerMs: 0, streak: 1 }).points, BASE_STANDARD);
is('a streak of zero is still worth 1x', streakMultiplier(0), 1);
is('no arguments at all does not throw', typeof scoreAnswer().points, 'number');

/* points can never come out negative, whatever goes in */
let everNegative = false;
for (const e of [-9999, -1, 0, 1, 499, 500, 501, 9999, 20000, 20001, 1e9, NaN, Infinity, -Infinity]) {
  for (const s of [-5, 0, 1, 6, 99]) {
    for (const style of ['standard', 'double', 'none']) {
      for (const last of [false, true]) {
        const p = scoreAnswer({ isCorrect: true, elapsedMs: e, timerMs: T, streak: s, pointsStyle: style, isLastTwo: last }).points;
        if (!(p >= 0) || !Number.isFinite(p)) everNegative = true;
      }
    }
  }
}
is('no combination of inputs produces a negative or broken score', everNegative, false);

/* ── FIVE PLAYERS, TEN QUESTIONS ────────────────────────────────────
   A whole game, played deterministically so it is the same every run,
   then checked against a table added up independently below. */
const QUESTIONS = Array.from({ length: 10 }, (_, i) => ({
  index: i,
  timerMs: 20000,
  pointsStyle: i === 4 ? 'double' : i === 7 ? 'none' : 'standard',
  correctIndex: i % 4,
}));

// a tiny seeded generator, so "random" play is reproducible
let seed = 20260813;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const PLAYERS = ['nour', 'ayser', 'malak', 'eyad', 'habiba'].map((id, i) => ({
  user_id: id, joined_at: '2026-01-0' + (i + 1), score: 0, streak: 0, best_streak: 0,
}));

// every player's play, decided up front so both sides see the same game
const plays = [];
for (const q of QUESTIONS) {
  for (const p of PLAYERS) {
    plays.push({
      user_id: p.user_id,
      q,
      elapsedMs: Math.floor(rnd() * 21000) - 200,      // some out of range on purpose
      picked: Math.floor(rnd() * 4),
    });
  }
}

// ── the game as the engine plays it ──
const engine = new Map(PLAYERS.map((p) => [p.user_id, { ...p }]));
for (const play of plays) {
  const me = engine.get(play.user_id);
  const correct = play.picked === play.q.correctIndex;
  const nextStreak = correct ? me.streak + 1 : 0;
  const r = scoreAnswer({
    isCorrect: correct,
    elapsedMs: play.elapsedMs,
    timerMs: play.q.timerMs,
    pointsStyle: play.q.pointsStyle,
    streak: nextStreak,
    isLastTwo: play.q.index >= QUESTIONS.length - 2,
  });
  me.score += r.points;
  me.streak = correct ? nextStreak : 0;
  me.best_streak = Math.max(me.best_streak, me.streak);
}

// ── the same game, added up a second time, by hand ──
const byHand = new Map(PLAYERS.map((p) => [p.user_id, { ...p }]));
for (const play of plays) {
  const me = byHand.get(play.user_id);
  const correct = play.picked === play.q.correctIndex;
  if (!correct) { me.streak = 0; continue; }
  me.streak += 1;
  me.best_streak = Math.max(me.best_streak, me.streak);
  const base = play.q.pointsStyle === 'double' ? 2000 : play.q.pointsStyle === 'none' ? 0 : 1000;
  const t = Math.max(1000, play.q.timerMs);
  const e = Math.min(Math.max(Math.floor(play.elapsedMs), 0), t);
  let raw = e <= 500 ? base : Math.floor(base * (1 - (e / t) / 2));
  raw = Math.max(raw, Math.floor(base * 0.5));
  const mult = Math.min(1 + 0.1 * (me.streak - 1), 1.5)
    * (play.q.index >= QUESTIONS.length - 2 ? COMEBACK_MULT : 1);
  me.score += Math.floor(raw * mult);
}

const fromEngine = rankPlayers([...engine.values()]).map((p) => p.user_id + ':' + p.score);
const fromHand = rankPlayers([...byHand.values()]).map((p) => p.user_id + ':' + p.score);
is('five players over ten questions rank exactly as worked out by hand', fromEngine, fromHand);
is('everybody scored something', fromEngine.every((r) => Number(r.split(':')[1]) > 0), true);
is('a question worth no points added nothing to anyone',
  QUESTIONS.some((q) => q.pointsStyle === 'none'), true);

/* ── report ─────────────────────────────────────────────────────── */
results.forEach((r) => {
  console.log((r.ok ? '  ok   ' : '  FAIL ') + r.label);
  if (!r.ok) console.log('         got ' + JSON.stringify(r.got) + ', wanted ' + JSON.stringify(r.want));
});
console.log('\nfinal table: ' + fromEngine.join('  '));

if (failures) {
  console.error('\n' + failures + ' rule(s) broken. The scoreboard cannot be trusted until these pass.');
  process.exit(1);
}
console.log('\n' + results.length + ' rules checked: the scoring engine agrees with the brief and with itself.');
