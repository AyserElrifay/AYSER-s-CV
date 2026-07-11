import { supabase } from '../lib/supabase';

/* Reactions, comments, account search, media upload.
   Screens call these only in real mode (SUPABASE_READY); demo mode
   keeps everything in local state. */

export async function toggleVibe(postId, userId, on) {
  if (on) {
    const { error } = await supabase
      .from('post_vibes')
      .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('post_vibes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, user:profiles(*)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function addComment(postId, userId, body) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, body })
    .select('*, user:profiles(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function searchProfiles(query) {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or('name.ilike.%' + q + '%,handle.ilike.%' + q + '%')
    .limit(20);
  if (error) throw error;
  return data;
}

/* Real language-exchange partners — people who opted in on their own
   profile (Settings → Learn languages), never a fabricated roster. */
export async function fetchLanguagePartners(myUserId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('learning_visible', true)
    .neq('id', myUserId)
    .limit(30);
  if (error) throw error;
  return data;
}

/* Uploads a local image uri into the public `media` bucket under the
   user's folder; returns the public URL to store on the post. */
export async function uploadMedia(userId, localUri) {
  const ext = (localUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const path = userId + '/' + Date.now() + '.' + ext;
  const res = await fetch(localUri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage
    .from('media')
    .upload(path, body, { contentType: 'image/' + (ext === 'jpg' ? 'jpeg' : ext) });
  if (error) throw error;
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}
