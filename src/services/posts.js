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

export async function createPost({ userId, type = 'post', caption, place, mediaUrl, textBg, lat, lng, squadName, sound }) {
  let payload = {
    user_id: userId,
    type,
    caption,
    place,
    media_url: mediaUrl,
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

  for (let i = 0; i < 6; i++) {
    const { data, error } = await insert();
    if (!error) return data;
    if (error.code === '23503') {
      // Missing profiles row (account pre-dates the signup trigger):
      // create it, then retry. Needs the schema_v3 insert policy.
      await supabase.from('profiles').upsert({ id: userId, name: 'Explorer' }, { onConflict: 'id', ignoreDuplicates: true });
      continue;
    }
    // strip columns this DB doesn't have yet (sound_url etc.) and retry
    const missing = /find the '([^']+)' column/i.exec(error.message || '');
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing[1])) {
      payload = { ...payload };
      delete payload[missing[1]];
      continue;
    }
    throw error;
  }
  throw new Error('Could not share — try again.');
}
