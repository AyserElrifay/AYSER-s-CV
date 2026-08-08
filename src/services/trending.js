import { supabase } from '../lib/supabase';

/* ── REAL TRENDING · counted off things that actually happened ────────
   Nothing here is invented. Every row is something somebody really
   typed, tagged, searched for or joined.

   WHY IT WAS EMPTY. The window was three days and the only two things
   that counted were a #hashtag in a caption and a tagged place. On an
   app this young that is almost always nothing at all — not because
   nothing is happening, but because we were looking through a slit.

   So the window is two weeks, and freshness is a weight rather than a
   wall: something posted today counts for its whole score, something
   from twelve days ago counts for about a third. A slow week now shows
   what the fortnight actually held instead of a blank space, and a
   busy day still rises straight to the top of it.

   And four kinds of real signal count now, not two:
     • #hashtags people typed in their captions
     • places people tagged a moment with
     • what people searched for (often the earliest signal of all —
       a thing gets looked for before anybody posts about it)
     • groups people made and joined

   Score = mentions + engagement (stars + 2×comments) + searches, each
   aged by how long ago it happened. Same weighting spirit as the feed
   ranking in services/algorithm.js. */

const GENERIC_PLACES = new Set(['somewhere out there', 'right here']);
const HASHTAG_RE = /#[\p{L}\p{N}_]{2,30}/gu;
const WINDOW_DAYS = 14;

/* Today counts fully; the far edge of the window counts about a third.
   Nothing falls off a cliff, so a trend fades instead of vanishing. */
const freshness = (iso) => {
  const age = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (!(age >= 0)) return 1;
  return Math.max(0.3, 1 - (age / WINDOW_DAYS) * 0.7);
};

const ONE_DAY = 86400000;

export async function fetchTrending(limit = 8) {
  const cutoff = new Date(Date.now() - WINDOW_DAYS * ONE_DAY).toISOString();
  const { data, error } = await supabase
    .from('posts')
    .select('caption, place, created_at, vibe_rows:post_vibes(count), comment_rows:comments(count)')
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;

  const buckets = new Map(); // tag -> { count, engagement, weight, today }
  const bump = (tag, engagement, w, isToday) => {
    const key = tag.toLowerCase();
    const b = buckets.get(key) || { tag, count: 0, engagement: 0, weight: 0, today: 0 };
    b.count += 1;
    b.engagement += engagement;
    b.weight += w;
    if (isToday) b.today += 1;
    buckets.set(key, b);
  };

  (data || []).forEach((row) => {
    const vibes = (row.vibe_rows && row.vibe_rows[0] && row.vibe_rows[0].count) || 0;
    const comments = (row.comment_rows && row.comment_rows[0] && row.comment_rows[0].count) || 0;
    const engagement = vibes + comments * 2;
    const w = freshness(row.created_at);
    const isToday = Date.now() - new Date(row.created_at).getTime() < ONE_DAY;

    const tags = (row.caption || '').match(HASHTAG_RE) || [];
    tags.forEach((t) => bump(t, engagement, w, isToday));

    const place = (row.place || '').trim();
    if (place && !GENERIC_PLACES.has(place.toLowerCase())) bump('📍 ' + place, engagement, w, isToday);
  });

  /* A group somebody made, or joined, this fortnight is as real a trend
     as a hashtag — and on a young app it is usually the first one there
     is. Missing table, no connection, no permission: it simply does not
     contribute, and nothing anywhere claims that it did. */
  try {
    const groups = await fetchGroupTrends(cutoff);
    groups.forEach((g) => {
      const key = ('👥 ' + g.name).toLowerCase();
      const b = buckets.get(key) || { tag: '👥 ' + g.name, count: 0, engagement: 0, weight: 0, today: 0 };
      b.members = g.members;
      b.isGroup = true;
      b.weight += g.weight;
      buckets.set(key, b);
    });
  } catch (e) { /* groups just don't count today */ }

  /* What people SEARCH for is the other half of a trend, and often the
     earlier half: a thing gets looked for before anyone posts about it.
     Search volume is folded into the same score, so a term climbing in
     the search box can trend before it has a single post. */
  let searches = [];
  try { searches = await fetchSearchTrends(); } catch (e) { searches = []; }
  searches.forEach((s) => {
    const key = s.term.toLowerCase();
    const b = buckets.get(key) || { tag: s.term, count: 0, engagement: 0, weight: 0, today: 0 };
    b.searches = (b.searches || 0) + s.searches;
    buckets.set(key, b);
  });

  return Array.from(buckets.values())
    .map((b) => ({
      id: 'trend-' + b.tag,
      tag: b.tag,
      moments: b.count,
      today: b.today || 0,
      searches: b.searches || 0,
      members: b.members || 0,
      isGroup: !!b.isGroup,
      category: b.isGroup ? 'Group'
        : (b.searches || 0) >= 3 && b.count === 0 ? 'People are looking'
        : b.today >= 2 ? 'Trending now'
        : b.count >= 5 ? 'Trending now'
        : 'Rising',
      /* Aged mentions rather than raw ones, so five posts today beat
         five posts a fortnight ago — which is what "trending" means.
         A search is a weaker signal than a post and a much stronger one
         than nothing, so it sits between a mention and an engagement. */
      score: (b.weight || b.count) + b.engagement * 0.3 + (b.searches || 0) * 0.6,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* Groups made or joined inside the window. Two small reads, and the
   count is of real memberships — never a number we decided on. */
async function fetchGroupTrends(cutoff) {
  const { data: made, error } = await supabase
    .from('groups')
    .select('id, name, created_at')
    .gt('created_at', cutoff)
    .limit(40);
  if (error) throw error;
  const rows = made || [];
  if (!rows.length) return [];

  const ids = rows.map((g) => g.id);
  const { data: mem } = await supabase
    .from('group_members')
    .select('group_id, joined_at')
    .in('group_id', ids);

  const byGroup = new Map();
  (mem || []).forEach((m) => {
    const e = byGroup.get(m.group_id) || { members: 0, weight: 0 };
    e.members += 1;
    e.weight += freshness(m.joined_at) * 0.5;   // a join is half a post
    byGroup.set(m.group_id, e);
  });

  return rows.map((g) => {
    const e = byGroup.get(g.id) || { members: 0, weight: 0 };
    return { name: g.name, members: e.members, weight: e.weight + freshness(g.created_at) };
  }).filter((g) => g.members > 0);
}

/* The line under a trend says what it is counting, in the units the
   thing is actually measured in. "12 moments" when a hashtag really
   was written twelve times; "8 people looked for this" when nobody has
   posted it yet but the search box says otherwise. A number with no
   noun is how you end up with a screen full of figures nobody trusts. */
export function trendWhy(item) {
  if (!item) return '';
  if (item.isGroup) return item.members + (item.members === 1 ? ' member' : ' members');
  const bits = [];
  if (item.moments) bits.push(item.moments + (item.moments === 1 ? ' moment' : ' moments'));
  if (item.today) bits.push(item.today + ' today');
  if (item.searches) bits.push(item.searches + (item.searches === 1 ? ' search' : ' searches'));
  return bits.join(' · ') || 'just started';
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
