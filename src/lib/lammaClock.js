/* ─── لمّة · WHOSE CLOCK DECIDES ─────────────────────────────────────
   A player in Aswan on 3G must not lose to a player in Zamalek on 4G
   because a packet took longer to arrive. So the countdown is never run
   off the server's clock, and never off the moment the message landed.

   It runs from the frame the question actually appeared on YOUR screen.
   That is the only honest answer to "how long did you take": you cannot
   answer a question you have not seen yet, and the time before you saw
   it is the network's fault, not yours.

   markRendered() is called after paint — the first animation frame that
   follows the question being laid out, not the moment the socket
   delivered it. sinceRendered() is what the tap reports. The client
   sends that number and nothing else: no score, no verdict, nothing the
   server would have to trust.

   Device clocks are not used at all. performance.now() is monotonic and
   immune to a phone whose date is three hours out, which Date.now() is
   not — and a room full of skewed phones would otherwise disagree about
   who was first.                                                      */

const now = () =>
  (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();

export function createQuestionClock() {
  let renderedAt = null;

  return {
    /* Call once, after the question has been drawn. Waiting a frame is
       the whole point: React finishing its work is not the same moment
       as the phone showing it. */
    markRendered() {
      if (renderedAt !== null) return;
      const set = () => { renderedAt = now(); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(set));
      else set();
    },

    /* Has it been drawn yet? A tap before this is true is impossible
       from a human, and is treated as instant rather than rejected. */
    ready() { return renderedAt !== null; },

    /* How long the player took, in whole milliseconds. Never negative,
       never fractional — the server clamps it again anyway, but a
       number that is already sane is a number nobody has to argue
       about. */
    sinceRendered() {
      if (renderedAt === null) return 0;
      return Math.max(0, Math.round(now() - renderedAt));
    },

    reset() { renderedAt = null; },
  };
}

/* How much of the bar is left, given the server's deadline and the
   moment this phone drew the question. Returned as a fraction so the
   drawing code never has to know about time at all. */
export function remainingFraction(clock, timerMs) {
  const t = Math.max(1, timerMs || 20000);
  return Math.max(0, Math.min(1, 1 - clock.sinceRendered() / t));
}
