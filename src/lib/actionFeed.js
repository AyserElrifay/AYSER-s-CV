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

/* Ayser: "خلي عادي الناس تحط حاجة زي أنا لسه جاي أو بحب الجبنة … حاجات
   خفيفة وسريعة". A light moment — a few words or a photo from nowhere in
   particular — belongs in the feed too. The database keeps them few (2 a
   week, 4 with Plus) and kind (no sad or angry ones): light_post_guard. */
export function isLightPost(c) {
  return !!c && !c.sponsored && (c.type || 'post') === 'post' && !isActionPost(c) && !!((c.caption || '').trim() || c.media);
}

/* Ayser's spec: the Moments tab is visual again — photos and videos,
   clips included (they never play by themselves: PostCard). Text-only
   posts stay rare because the database keeps them rare
   (text_post_guard: free 2 a month, Plus 4 a week). */
export function isVisualPost(c) {
  return !!c && !c.sponsored && !!c.media && ['post', 'reel', 'vod', 'travel'].includes(c.type || 'post');
}

/* what the button on the card does */
export function actionOf(c) {
  if (!isActionPost(c)) return null;
  return c.joinable ? 'join' : 'hangout';
}

/* your own moments always stay in your feed — a moment that is not from
   an outing reaches other people through your profile, but it never
   vanishes from under the person who just posted it */
/* Ayser, November 2026 — "Keep the main Moments feed 100% PERMANENT".
   The feed keeps every post, from July or from this morning, text or
   photo; only the repost button is gone. The 48-hour rule is for the
   day's photo-prompt answers alone (posts.expires_at, set by
   RUN_ME.sql posts_lifetime): they live in the LIVE MOMENTS strip above
   the feed, count down, and when their 48 hours end they are in their
   owner's Moments Book, never in the feed. */
export const LIVE_HOURS = 48;
export const isEphemeral = (c) => !!(c && c.expiresAt);
export const isLive = (c, now = Date.now()) => !!(c && c.expiresAt && new Date(c.expiresAt).getTime() > now);
export const actionFeed = (cards, me) => (cards || []).filter((c) => !isEphemeral(c) && (isActionPost(c) || isLightPost(c) || isVisualPost(c) || (me && c && !c.sponsored && c.userId === me))).slice(0, FEED_MAX);
export const liveStrip = (cards, now = Date.now()) => (cards || []).filter((c) => !c.sponsored && c.media && isLive(c, now)).slice(0, 20);
