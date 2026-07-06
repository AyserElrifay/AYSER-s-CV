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

export async function createPost({ userId, type = 'post', caption, place, mediaUrl, lat, lng, squadName }) {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      type,
      caption,
      place,
      media_url: mediaUrl,
      lat,
      lng,
      squad_name: squadName,
    })
    .select('*, user:profiles(*)')
    .single();
  if (error) throw error;
  return data;
}
