/* ─── A FEED THAT ENDS IN SOMETHING TO DO ─────────────────────────────
   The rule: a post is in the feed only if it is tied to somewhere or to
   a plan — a place, a point on the map, a travel plan, or a time to
   meet. Each one ends in a button that leads out of the feed: join it,
   or make a plan at that place. A photo of nowhere in particular, an
   advert, a thought with no place: those belong on a profile, not in
   the thing you open every morning.

   And the feed ends. Thirty at most, then "you're all caught up" and
   the week near you.

       node scripts/check-action-feed.mjs
*/
export const FEED_MAX = 30;

export function isActionPost(c) {
  if (!c || c.sponsored) return false;
  const place = typeof c.place === 'string' && c.place.trim().length > 0;
  return !!(c.coords || place || c.plan || c.joinable);
}

/* what the button on the card does */
export function actionOf(c) {
  if (!isActionPost(c)) return null;
  return c.joinable ? 'join' : 'hangout';
}

export const actionFeed = (cards) => (cards || []).filter(isActionPost).slice(0, FEED_MAX);
