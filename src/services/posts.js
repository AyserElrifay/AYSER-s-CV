import { supabase } from '../lib/supabase';

/* Feed data access. Rows come back with the author profile joined in
   (posts.user_id → profiles) so the feed renders in a single query. */

export async function fetchFeed() {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:profiles(*)')
    .order('created_at', { ascending: false })
    .limit(30);
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
    .select('*, user:profiles(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPost({ userId, type = 'post', caption, place, mediaUrl, textBg, lat, lng, squadName }) {
  const insert = () => supabase
    .from('posts')
    .insert({
      user_id: userId,
      type,
      caption,
      place,
      media_url: mediaUrl,
      text_bg: textBg,
      lat,
      lng,
      squad_name: squadName,
    })
    .select('*, user:profiles(*)')
    .single();

  let { data, error } = await insert();
  if (error && error.code === '23503') {
    // Missing profiles row (account pre-dates the signup trigger):
    // create it, then retry once. Needs the schema_v3 insert policy.
    await supabase.from('profiles').upsert({ id: userId, name: 'Explorer' }, { onConflict: 'id', ignoreDuplicates: true });
    ({ data, error } = await insert());
  }
  if (error) throw error;
  return data;
}
