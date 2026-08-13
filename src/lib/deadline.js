/* ─── A REQUEST THAT NEVER ANSWERS ────────────────────────────────────
   Every loading screen in this app was written with a .catch on it, and
   a .catch only covers requests that come back to say no. A request can
   also never come back at all — the connection dies mid-flight, the
   phone changes network, a socket is left open at the other end. Then
   nothing rejects and nothing resolves, and the spinner turns for ever.

   That is the worst state a screen can hold. A failure at least tells
   you where you stand; endless loading looks like your reels, your
   chats, your music might still be arriving, so you sit and wait for
   something that stopped existing minutes ago. It is exactly what
   "الصفحه بتهنج" describes, and it is why the same complaint kept
   coming back about different tabs.

   This puts a deadline on a promise. If the answer has not arrived by
   then it rejects like any other failure, which means every screen's
   existing .catch already handles it — no new plumbing, no new state
   machine. The rejection is marked `timeout` so a screen that wants to
   say something more precise than "that didn't work" can.

   Twelve seconds: long enough for a genuinely slow connection to
   finish, short enough to stop pretending.                            */

export const DEADLINE_MS = 12000;

export function withDeadline(promise, ms = DEADLINE_MS) {
  let timer = null;
  const bell = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error('The server did not answer in time.');
      e.timeout = true;
      reject(e);
    }, ms);
  });
  // clear the timer either way, so a resolved request leaves nothing behind
  return Promise.race([promise, bell]).finally(() => clearTimeout(timer));
}

/* Did this failure come from the deadline rather than the server? */
export const isTimeout = (e) => !!(e && e.timeout);
