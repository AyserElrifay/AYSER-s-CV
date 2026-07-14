import { supabase } from '../lib/supabase';

/* Real 24h stories — rows expire via the RLS policy (expires_at). */

export async function createStory(userId, { mediaUrl, caption, sound }) {
  let payload = {
    user_id: userId,
    media_url: mediaUrl,
    caption: caption || null,
    sound_title: sound ? sound.title : null,
    sound_artist: sound ? sound.artist : null,
    sound_url: sound ? sound.audio_url || null : null, // actually playable
  };
  // strip any column this DB doesn't have yet and retry — a missing
  // optional column must never block posting a story
  for (let i = 0; i < 4; i++) {
    const { data, error } = await supabase
      .from('stories')
      .insert(payload)
      .select('*, user:profiles(name, avatar_url)')
      .single();
    if (!error) return data;
    const missing = /find the '([^']+)' column/i.exec(error.message || '');
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing[1])) {
      const next = { ...payload };
      delete next[missing[1]];
      payload = next;
      continue;
    }
    throw error;
  }
  throw new Error('Could not post your story — try again.');
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
