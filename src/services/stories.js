import { supabase } from '../lib/supabase';

/* Real 24h stories — rows expire via the RLS policy (expires_at). */

export async function createStory(userId, { mediaUrl, caption, sound }) {
  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: userId,
      media_url: mediaUrl,
      caption: caption || null,
      sound_title: sound ? sound.title : null,
      sound_artist: sound ? sound.artist : null,
    })
    .select('*, user:profiles(name, avatar_url)')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchActiveStories() {
  const { data, error } = await supabase
    .from('stories')
    .select('*, user:profiles(id, name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}
