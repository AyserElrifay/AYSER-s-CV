/* ─── لمّة · THE SCORING ENGINE ───────────────────────────────────────
   The whole game is decided here, so this file is deliberately boring:
   one pure function, no imports, no clock, no network, no randomness.
   Give it the same arguments and it gives the same answer, every time,
   on any machine. That is what makes it testable, and being testable is
   what makes a scoreboard something people will argue with instead of
   distrust.

   THIS COPY IS NOT THE AUTHORITY. The server has the same arithmetic in
   SQL (lamma_award in supabase/schema_v14_lamma.sql) and the server's
   answer is the one that counts. This copy exists so the app can show
   you what a tap was worth without waiting for a round trip, and so the
   rules can be tested in milliseconds instead of against a database.
   The two are kept in step by scripts/check-lamma.mjs, which runs the
   same table of cases through both and fails the build if they ever
   disagree.

   HOW A SCORE IS BUILT
     · a correct answer is worth `base`, and answering faster keeps more
       of it — but never less than half, so a slow right answer still
       beats a fast wrong one by a mile
     · a streak multiplies it, up to one and a half times, capped so a
       runaway leader cannot lap the room
     · a wrong answer is worth nothing and breaks the streak

   WHY THE FIRST HALF-SECOND IS FREE
     Nobody reads a question and answers it in under 500ms — they were
     already moving. That window exists so somebody with a fast phone
     and a fast connection is not rewarded for their hardware. Below it,
     everybody scores the same.                                        */

export const BASE_STANDARD = 1000;
export const BASE_DOUBLE = 2000;
export const FREE_WINDOW_MS = 500;   // below this, speed stops mattering
export const FLOOR_RATIO = 0.5;      // a correct answer never scores less
export const STREAK_STEP = 0.1;      // each extra correct answer in a row
export const STREAK_CAP = 1.5;       // reached on a 6-streak, held for ever

/* ── THE COMEBACK LANE ─────────────────────────────────────────────
   The brief asks for 1.5× on the last two questions. It is built, and
   it is one constant so it can be changed in one place.

   Worth saying plainly, because it is easier to change now than later:
   multiplying EVERY player by the same number does not create
   comebacks. It scales the whole board equally, so the ranking barely
   moves — what it really does is make the first eight questions feel
   like they did not count. Kahoot takes this criticism fairly.

   A real catch-up mechanic has to be asymmetric — worth more to the
   player who is behind than to the leader. Set COMEBACK_MULT to 1 to
   switch this off, or say the word and I will make it scale with the
   gap instead.                                                       */
export const COMEBACK_MULT = 1.5;

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);

/* A number we can do arithmetic on, whatever we were handed. undefined,
   null, NaN, Infinity and "800" all have to mean something safe rather
   than poison the scoreboard. */
const num = (v, fallback = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

export function baseFor(pointsStyle) {
  if (pointsStyle === 'double') return BASE_DOUBLE;
  if (pointsStyle === 'none') return 0;
  return BASE_STANDARD;
}

/* How much a streak is worth. `streak` counts this answer: the first
   correct answer is a streak of 1 and multiplies by exactly 1. */
export function streakMultiplier(streak) {
  const s = Math.max(1, Math.floor(num(streak, 1)));
  return Math.min(1 + STREAK_STEP * (s - 1), STREAK_CAP);
}

/* ── THE ONE FUNCTION ──────────────────────────────────────────────
   {
     isCorrect      : boolean
     elapsedMs      : how long the player took, measured on their own
                      device from the frame the question appeared
     timerMs        : how long the question allowed
     pointsStyle    : 'standard' | 'double' | 'none'
     streak         : their streak INCLUDING this answer (1 = first)
     isLastTwo      : is this one of the final two questions
   }
   → { points, streak, multiplier, raw }
   `streak` comes back as it now stands, so the caller never has to
   remember to reset it — a wrong answer returns 0.                   */
export function scoreAnswer({
  isCorrect,
  elapsedMs,
  timerMs,
  pointsStyle = 'standard',
  streak = 1,
  isLastTwo = false,
} = {}) {
  const base = baseFor(pointsStyle);

  // wrong is worth nothing, and it costs you the streak
  if (!isCorrect) return { points: 0, streak: 0, multiplier: 0, raw: 0 };

  /* A timer of zero or nonsense would divide the game by zero. One
     second is the smallest thing that can honestly be called a timer. */
  const timer = Math.max(1000, Math.floor(num(timerMs, 20000)));
  const elapsed = clamp(Math.floor(num(elapsedMs, timer)), 0, timer);

  let raw = elapsed <= FREE_WINDOW_MS
    ? base
    : Math.floor(base * (1 - (elapsed / timer) / 2));

  // being slow costs you half at most, never more
  raw = Math.max(raw, Math.floor(base * FLOOR_RATIO));

  /* ── WHY THE MULTIPLIER IS ROUNDED ────────────────────────────
     A streak of three on one of the last two questions is meant to be
     1.2 × 1.5 = 1.8. In binary floating point it is
     1.7999999999999998, so a thousand-point answer paid 1799 — and a
     scoreboard that says 1799 where a person can see 1800 looks
     broken, whatever the IEEE standard has to say about it.

     Rounded to two places before it is applied. The server rounds in
     exactly the same place and the same way, so the two still agree to
     the point; this is about what the number looks like, not about who
     decides it. */
  const mult = streakMultiplier(streak);
  const rawMult = isLastTwo ? mult * COMEBACK_MULT : mult;
  const finalMult = Math.round(rawMult * 100) / 100;

  return {
    points: Math.floor(raw * finalMult),
    streak: Math.max(1, Math.floor(num(streak, 1))),
    multiplier: finalMult,
    raw,
  };
}

/* Ordering a leaderboard is a rule too, and leaving it implicit is how
   two screens end up disagreeing about who came second. Most points
   first; a tie goes to the longer best streak, then to whoever got
   there first. Deterministic, so the same game always ranks the same
   way — never Array.sort's mercy on equal rows. */
export function rankPlayers(players) {
  return [...(players || [])].sort((a, b) => {
    const p = num(b.score) - num(a.score);
    if (p) return p;
    const s = num(b.best_streak) - num(a.best_streak);
    if (s) return s;
    const t = String(a.joined_at || '').localeCompare(String(b.joined_at || ''));
    if (t) return t;
    return String(a.user_id || '').localeCompare(String(b.user_id || ''));
  });
}
