import { av } from '../constants/mockData';
import { fetchActiveBoosts } from './ads';

/* ── NATIVE ADS ───────────────────────────────────────────────
   Paid boosts rendered as native content — a normal-looking card in
   the feed, always tagged "Sponsored". Feed uses 'featured_collection'
   + 'top_search' boosts; Search uses 'top_search'; Map uses
   'promoted_pin'. Empty until a real venue actually pays. */

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

export async function fetchFeedAds() {
  try {
    const [featured, top] = await Promise.all([
      fetchActiveBoosts('featured_collection'),
      fetchActiveBoosts('top_search'),
    ]);
    return [...featured, ...top].slice(0, 3).map(boostToCard);
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
