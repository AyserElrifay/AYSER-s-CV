import { supabase } from '../lib/supabase';

/* ── REAL TRENDING · computed from actual recent posts ────────────────
   No fabricated topics. We look at everything posted in the last 3
   days and rank two kinds of real signal:
     • #hashtags people actually typed in their captions
     • real places people actually tagged their moment with
   Score = how many posts mention it + how much the crowd engaged with
   those posts (stars + 2×comments), same weighting spirit as the main
   feed ranking algorithm in services/algorithm.js. Recency isn't a
   separate term here — the 3-day window already keeps it fresh. */

const GENERIC_PLACES = new Set(['somewhere out there', 'right here']);
const HASHTAG_RE = /#[\p{L}\p{N}_]{2,30}/gu;

export async function fetchTrending(limit = 8) {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('posts')
    .select('caption, place, created_at, vibe_rows:post_vibes(count), comment_rows:comments(count)')
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;

  const buckets = new Map(); // tag -> { count, engagement }
  const bump = (tag, engagement) => {
    const key = tag.toLowerCase();
    const b = buckets.get(key) || { tag, count: 0, engagement: 0 };
    b.count += 1;
    b.engagement += engagement;
    buckets.set(key, b);
  };

  (data || []).forEach((row) => {
    const vibes = (row.vibe_rows && row.vibe_rows[0] && row.vibe_rows[0].count) || 0;
    const comments = (row.comment_rows && row.comment_rows[0] && row.comment_rows[0].count) || 0;
    const engagement = vibes + comments * 2;

    const tags = (row.caption || '').match(HASHTAG_RE) || [];
    tags.forEach((t) => bump(t, engagement));

    const place = (row.place || '').trim();
    if (place && !GENERIC_PLACES.has(place.toLowerCase())) bump('📍 ' + place, engagement);
  });

  /* What people SEARCH for is the other half of a trend, and often the
     earlier half: a thing gets looked for before anyone posts about it.
     Search volume is folded into the same score, so a term climbing in
     the search box can trend before it has a single post. */
  let searches = [];
  try { searches = await fetchSearchTrends(); } catch (e) { searches = []; }
  searches.forEach((s) => {
    const key = s.term.toLowerCase();
    const b = buckets.get(key) || { tag: s.term, count: 0, engagement: 0 };
    b.searches = (b.searches || 0) + s.searches;
    buckets.set(key, b);
  });

  return Array.from(buckets.values())
    .map((b) => ({
      id: 'trend-' + b.tag,
      tag: b.tag,
      moments: b.count,
      searches: b.searches || 0,
      category: (b.searches || 0) >= 5 && b.count === 0 ? 'People are looking'
        : b.count >= 5 ? 'Trending now' : 'Rising',
      // a search is a weaker signal than a post but a much stronger one
      // than nothing, so it sits between a mention and an engagement
      score: b.count + b.engagement * 0.3 + (b.searches || 0) * 0.6,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* The aggregate only — the individual rows are unreadable by anyone,
   including us, and carry no user id in the first place. */
export async function fetchSearchTrends(limit = 10) {
  const { data, error } = await supabase.rpc('trending_searches', { lim: limit });
  if (error) throw error;
  return (data || []).map((r) => ({ term: r.term, searches: Number(r.searches) || 0 }));
}

/* Record that something was looked for. Anonymous by construction: the
   table has a term and a timestamp and nowhere to put a person. Called
   only when someone actually commits to a search, not on every
   keystroke, so it measures intent rather than typing. */
export async function logSearch(term) {
  const t = String(term || '').trim().toLowerCase();
  if (t.length < 2 || t.length > 40) return;
  try { await supabase.from('search_terms').insert({ term: t }); } catch (e) { /* never block a search */ }
}
