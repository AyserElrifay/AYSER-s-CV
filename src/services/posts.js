import { supabase } from '../lib/supabase';

/* Feed data access. Rows come back with the author profile joined in
   (posts.user_id → profiles) so the feed renders in a single query. */

export async function fetchFeed() {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:profiles!posts_user_id_fkey(*), vibe_rows:post_vibes(count), comment_rows:comments(count)')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  // flatten the embedded counts so every caller sees plain numbers
  return (data || []).map((row) => ({
    ...row,
    vibes: (row.vibe_rows && row.vibe_rows[0] && row.vibe_rows[0].count) || 0,
    comments: (row.comment_rows && row.comment_rows[0] && row.comment_rows[0].count) || 0,
  }));
}

/* ── REPOSTS, with an actual effect ───────────────────────────────
   Pressing repeat used to write a row nobody ever read: you reposted
   something and not one person saw it. A repost now carries the moment
   back into the feed under the name of whoever passed it on — the same
   post, credited to the person who thought it was worth sharing. */
export async function fetchReposts(limit = 24) {
  const { data, error } = await supabase
    .from('post_reposts')
    .select('created_at, by:profiles!post_reposts_user_id_fkey(id, name, avatar_url, country_flag, verified), post:posts!post_reposts_post_id_fkey(*, user:profiles!posts_user_id_fkey(*), vibe_rows:post_vibes(count), comment_rows:comments(count))')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];                       // table/FK not there yet → feed still loads
  return (data || [])
    .filter((r) => r.post && r.by)
    .map((r) => ({
      ...r.post,
      vibes: (r.post.vibe_rows && r.post.vibe_rows[0] && r.post.vibe_rows[0].count) || 0,
      comments: (r.post.comment_rows && r.post.comment_rows[0] && r.post.comment_rows[0].count) || 0,
      reposted_by: r.by,
      reposted_at: r.created_at,
    }));
}

/* What someone passed on — shown on their own profile, because a
   repost is part of what you put out into the world. */
export async function fetchRepostsByUser(userId) {
  const { data, error } = await supabase
    .from('post_reposts')
    .select('created_at, post:posts!post_reposts_post_id_fkey(*, user:profiles!posts_user_id_fkey(*), vibes:post_vibes(count))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return [];
  return (data || [])
    .filter((r) => r.post)
    .map((r) => ({
      ...r.post,
      vibesCount: (r.post.vibes && r.post.vibes[0] && r.post.vibes[0].count) || 0,
      reposted_at: r.created_at,
    }));
}

/* Real post search — matches captions and tagged places of ACTUAL
   posts in the database. Powers the Discover "Posts" results. */
export async function searchPosts(q) {
  // strip the characters PostgREST's or() filter treats as syntax
  const like = '%' + q.replace(/[%_(),]/g, ' ').trim() + '%';
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:profiles!posts_user_id_fkey(*), vibe_rows:post_vibes(count), comment_rows:comments(count)')
    .or('caption.ilike.' + like + ',place.ilike.' + like)
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    vibes: (row.vibe_rows && row.vibe_rows[0] && row.vibe_rows[0].count) || 0,
    comments: (row.comment_rows && row.comment_rows[0] && row.comment_rows[0].count) || 0,
  }));
}

/* Posts & videos tagged AT a place — powers the map: tap a spot and
   see the real moments people shared there. Matches two ways so it
   works whether the poster typed the place name or just dropped a pin:
   a small lat/lng bounding box around the point, OR a place-name match.
   radiusKm defaults to ~0.4km (a block or two). */
export async function fetchPostsNearby({ lat, lng, name }, radiusKm = 0.4) {
  const dLat = radiusKm / 111; // ~111km per degree of latitude
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  let filter = 'and(lat.gte.' + (lat - dLat) + ',lat.lte.' + (lat + dLat) +
    ',lng.gte.' + (lng - dLng) + ',lng.lte.' + (lng + dLng) + ')';
  if (name) {
    const clean = name.replace(/[%_(),]/g, ' ').trim();
    if (clean) filter += ',place.ilike.%' + clean + '%';
  }
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:profiles!posts_user_id_fkey(*), vibe_rows:post_vibes(count), comment_rows:comments(count)')
    .or(filter)
    .order('created_at', { ascending: false })
    .limit(24);
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    vibes: (row.vibe_rows && row.vibe_rows[0] && row.vibe_rows[0].count) || 0,
    comments: (row.comment_rows && row.comment_rows[0] && row.comment_rows[0].count) || 0,
  }));
}

/* ── Everything happening ON the map right now ────────────────────
   Every recent moment that was shared WITH a location becomes a pin
   you can see and open — so the map shows where life is actually
   happening, not just who's standing where. Only the last few days,
   so the map stays current instead of turning into an archive. */
export async function fetchMomentPins(days = 3, limit = 120) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, type, media_url, caption, place, lat, lng, created_at, user:profiles!posts_user_id_fkey(name, avatar_url, country_flag)')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* One post by id — powers shared links (?post=…). */
export async function fetchPost(postId) {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:profiles!posts_user_id_fkey(*), vibe_rows:post_vibes(count), comment_rows:comments(count)')
    .eq('id', postId)
    .single();
  if (error) throw error;
  return {
    ...data,
    vibes: (data.vibe_rows && data.vibe_rows[0] && data.vibe_rows[0].count) || 0,
    comments: (data.comment_rows && data.comment_rows[0] && data.comment_rows[0].count) || 0,
  };
}

/* Long-form videos (YouTube-style) — every post of type 'vod'.
   Powers the Chill tab; newest first, author profile joined in. */
export async function fetchVideos() {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:profiles!posts_user_id_fkey(*)')
    .eq('type', 'vod')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return data;
}

/* Your real moment grid — posts + a real star (vibe) count per post,
   used by the profile screen. */
export async function fetchMyMoments(userId) {
  const { data, error } = await supabase
    .from('posts')
    .select('*, vibes:post_vibes(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    vibesCount: (row.vibes && row.vibes[0] && row.vibes[0].count) || 0,
  }));
}

export async function fetchMyPosts(userId) {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:profiles!posts_user_id_fkey(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/* Delete one of YOUR posts (RLS blocks deleting anyone else's). */
export async function deletePost(postId, userId) {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userId);
  if (error) throw error;
}

/* Edit your own moment — the caption, who it's for (RLS lets you update
   only your own rows). Returns the updated row.

   Same strip-and-retry as createPost: a database that hasn't had the
   newest column added yet shouldn't make editing a caption fail. We
   drop the column it doesn't know about and save the rest. */
export async function updatePost(postId, userId, fields) {
  let payload = { ...fields };
  const dropped = [];
  for (let i = 0; i < 4; i++) {
    const { data, error } = await supabase
      .from('posts')
      .update(payload)
      .eq('id', postId)
      .eq('user_id', userId)
      .select('*, user:profiles!posts_user_id_fkey(*)')
      .single();
    if (!error) {
      if (dropped.length && data) data.__dropped = dropped;
      return data;
    }
    const missing = /find the '([^']+)' column/i.exec(error.message || '');
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing[1])) {
      dropped.push(missing[1]);
      payload = { ...payload };
      delete payload[missing[1]];
      if (Object.keys(payload).length) continue;
    }
    throw error;
  }
  throw new Error('Could not save that — try again.');
}

/* ── TRAVEL PLANS, THE WAY THEY ARE MEANT TO BE FOUND ─────────────
   A plan posted into a chronological feed is a message in a bottle:
   the person who would answer it is somewhere else, on another day.
   Discover asks for them by destination instead, which is the whole
   point of writing one.

   Ordered by when the trip starts rather than when it was posted, so
   the person arriving next week is above the person arriving in a
   year, and plans whose dates have already passed drop off. */
export async function fetchTravelPlans({ q = '', limit = 40 } = {}) {
  let sel = supabase
    .from('posts')
    .select('*, user:profiles!posts_user_id_fkey(*)')
    .not('plan', 'is', null)
    .order('created_at', { ascending: false })
    .limit(120);
  if (q && q.trim()) {
    const like = '%' + q.replace(/[%_(),]/g, ' ').trim() + '%';
    sel = sel.or('place.ilike.' + like + ',caption.ilike.' + like);
  }
  const { data, error } = await sel;
  if (error) {
    /* A database that has not had the plan column added yet genuinely
       has no plans, so that is an empty list. Anything else — no
       connection, a refused request — is not "nobody is travelling",
       and saying so would be a lie the screen tells on our behalf. */
    const msg = String((error && error.message) || '');
    if (/plan|column|schema cache/i.test(msg)) return [];
    throw error;
  }
  const thisMonth = new Date().toISOString().slice(0, 7);
  const rows = (data || []).filter((r) => {
    const p = r.plan || {};
    const end = p.to || p.from;
    return !end || String(end) >= thisMonth;   // still ahead of us
  });
  // "soonest first" has to work off whichever end of the trip is dated;
  // sorting on `from` alone dropped a plan that only said when it ends
  // below every dated one.
  const when = (r) => String((r.plan && (r.plan.from || r.plan.to)) || '9999');
  rows.sort((a, b) => when(a).localeCompare(when(b)));
  return rows.slice(0, limit);
}

export async function createPost({ userId, type = 'post', caption, place, mediaUrl, thumbUrl, textBg, lat, lng, squadName, sound, plan }) {
  let payload = {
    user_id: userId,
    type,
    caption,
    place,
    // a travel plan: the headline, the dates and what they're up for.
    // See supabase/RUN_ME.sql for the shape.
    plan: plan || null,
    media_url: mediaUrl,
    // the still shown wherever a video can't play yet — a grid tile,
    // a chat card. Without it a posted reel was a blank white square.
    thumb_url: thumbUrl || null,
    text_bg: textBg,
    lat,
    lng,
    squad_name: squadName,
    sound_title: sound ? sound.title : null,
    sound_artist: sound ? sound.artist : null,
    sound_url: sound ? sound.audio_url || null : null,
  };
  const insert = () => supabase
    .from('posts')
    .insert(payload)
    .select('*, user:profiles!posts_user_id_fkey(*)')
    .single();

  /* Dropping a column the database does not have yet is what keeps
     posting working while the schema catches up — but doing it in
     silence is how somebody posts a travel plan and gets an ordinary
     moment with no idea why. What we had to leave out comes back with
     the row, so whoever asked can say so in plain words. */
  const dropped = [];

  for (let i = 0; i < 6; i++) {
    const { data, error } = await insert();
    if (!error) {
      if (dropped.length && data) data.__dropped = dropped;
      return data;
    }
    if (error.code === '23503') {
      // Missing profiles row (account pre-dates the signup trigger):
      // create it, then retry. Needs the schema_v3 insert policy.
      await supabase.from('profiles').upsert({ id: userId, name: 'Explorer' }, { onConflict: 'id', ignoreDuplicates: true });
      continue;
    }
    // strip columns this DB doesn't have yet (sound_url etc.) and retry
    const missing = /find the '([^']+)' column/i.exec(error.message || '');
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing[1])) {
      // only worth mentioning when it was actually carrying something
      if (payload[missing[1]] != null) dropped.push(missing[1]);
      payload = { ...payload };
      delete payload[missing[1]];
      continue;
    }
    throw error;
  }
  throw new Error('Could not share — try again.');
}
