import { av } from '../constants/mockData';
import { fetchActiveBoosts, feedbackFactor } from './ads';

/* ── NATIVE ADS ───────────────────────────────────────────────
   Paid boosts rendered as native content — a normal-looking card in
   the feed, always tagged "Sponsored". Feed uses 'featured_collection'
   + 'top_search' boosts; Search uses 'top_search'; Map uses
   'promoted_pin'. Empty until a real venue actually pays. */

/* ── THE AD RANK AUCTION ──────────────────────────────────────
   Which paid boost wins a slot is NOT first-come / highest-bidder.
   Like Google & Meta, we rank by:

       Ad Rank = bid (CPC)  ×  Quality  ×  Relevance

   • bid       — what the advertiser pays per click (boost.cpc)
   • Quality   — driven by the Feedback Factor: a loved place (high
                 rating) scores higher and can outrank a bigger bid;
                 a badly-rated place scores lower, and below the floor
                 it's dropped from the auction entirely (blocked).
   • Relevance — 1.0 by default, boosted when the ad's category matches
                 the viewer's picked intent (hook: pass viewerIntent).

   Net effect: money alone can't buy the top slot — quality does. This
   is the same lever as the Feedback Factor on price, applied to rank. */

function qualityScore(venue) {
  const f = feedbackFactor(venue.rating || 0, venue.rating_count || 0);
  if (f.blocked) return 0;              // too badly rated to advertise
  // Cheaper clicks (better rating) → higher quality. mult 0.6..1.6 → ~1.67..0.63
  return 1 / (f.mult || 1);
}

function relevanceScore(venue, viewerIntent) {
  if (!viewerIntent || !venue) return 1;
  const hay = ((venue.category || '') + ' ' + (venue.name || '') + ' ' + (venue.sub || '')).toLowerCase();
  const want = String(viewerIntent).toLowerCase().replace(/[^a-z ]/g, '').trim();
  return want && hay.includes(want.split(' ').pop()) ? 1.5 : 1;
}

export function adRank(boost, viewerIntent) {
  const v = boost.venue || {};
  const bid = Number(boost.cpc) || 1;
  return bid * qualityScore(v) * relevanceScore(v, viewerIntent);
}

/* Rank a set of boosts by Ad Rank, drop the blocked ones, keep top N. */
export function rankAds(boosts, viewerIntent, limit = 3) {
  return (boosts || [])
    .map((b) => ({ b, r: adRank(b, viewerIntent) }))
    .filter((x) => x.r > 0)
    .sort((a, b) => b.r - a.r)
    .slice(0, limit)
    .map((x) => x.b);
}

const GRADS = ['sky', 'lavender', 'mint', 'night'];

/* Shape a boosted venue into a card PostCard already knows how to render
   (its sponsored path). */
function boostToCard(boost, i) {
  const v = boost.venue || {};
  return {
    id: 'ad-' + boost.id,
    sponsored: true,
    type: 'post',
    user: { name: v.name || 'Sponsored', avatar: av(20), verified: true },
    media: null,
    textBg: GRADS[i % GRADS.length],
    caption: (v.emoji ? v.emoji + '  ' : '') + (v.name || 'A place near you') + (v.sub ? '\n' + v.sub : ''),
    place: 'Sponsored',
    startsIn: 'Ad',
    cta: v.price ? 'Book · ' + v.price : 'Learn more',
    vibes: 0, comments: 0, joinable: false,
    _boost: boost,
  };
}

export async function fetchFeedAds(viewerIntent) {
  try {
    const [featured, top] = await Promise.all([
      fetchActiveBoosts('featured_collection'),
      fetchActiveBoosts('top_search'),
    ]);
    // Run the Ad Rank auction over every eligible boost, not just the newest.
    return rankAds([...featured, ...top], viewerIntent, 3).map(boostToCard);
  } catch (e) {
    return [];
  }
}

/* Splice ads into a list of feed cards, one after every `every` posts. */
export function injectAds(posts, ads, every = 4) {
  if (!ads || !ads.length) return posts;
  const out = [];
  let ai = 0;
  posts.forEach((p, idx) => {
    out.push(p);
    if ((idx + 1) % every === 0 && ai < ads.length) out.push(ads[ai++]);
  });
  // if the feed is short, still show one ad at the end
  while (ai < ads.length && out.length) out.push(ads[ai++]);
  return out;
}
