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

  return Array.from(buckets.values())
    .map((b) => ({
      id: 'trend-' + b.tag,
      tag: b.tag,
      moments: b.count,
      category: b.count >= 5 ? 'Trending now' : 'Rising',
      score: b.count + b.engagement * 0.3,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
