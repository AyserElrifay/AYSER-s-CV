import { supabase } from '../lib/supabase';
import { uploadMediaSmart } from '../lib/storage';

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

export async function toggleLaugh(postId, userId, on) {
  if (on) {
    const { error } = await supabase
      .from('post_laughs')
      .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('post_laughs')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

export async function toggleRepost(postId, userId, on) {
  if (on) {
    const { error } = await supabase
      .from('post_reposts')
      .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('post_reposts')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

/* Joining a moment ("Join the Vibe") — a real membership row. */
export async function joinPost(postId, userId) {
  const { error } = await supabase
    .from('post_joins')
    .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
  if (error) throw error;
}

/* Everything needed to restore YOUR reactions after a refresh:
   stars, laughs, reposts and joins — plus crowd totals for the ones
   the feed query doesn't embed. Each part fails soft so a missing
   table (SQL not run yet) never breaks the feed. */
export async function fetchEngagement(userId) {
  const out = { myVibes: {}, myLaughs: {}, myReposts: {}, myJoins: {}, laughCounts: {}, repostCounts: {} };
  try {
    const { data } = await supabase.from('post_vibes').select('post_id').eq('user_id', userId).limit(1000);
    (data || []).forEach((r) => { out.myVibes[r.post_id] = true; });
  } catch (e) {}
  try {
    const { data } = await supabase.from('post_laughs').select('post_id, user_id').limit(3000);
    (data || []).forEach((r) => {
      out.laughCounts[r.post_id] = (out.laughCounts[r.post_id] || 0) + 1;
      if (r.user_id === userId) out.myLaughs[r.post_id] = true;
    });
  } catch (e) {}
  try {
    const { data } = await supabase.from('post_reposts').select('post_id, user_id').limit(3000);
    (data || []).forEach((r) => {
      out.repostCounts[r.post_id] = (out.repostCounts[r.post_id] || 0) + 1;
      if (r.user_id === userId) out.myReposts[r.post_id] = true;
    });
  } catch (e) {}
  try {
    const { data } = await supabase.from('post_joins').select('post_id').eq('user_id', userId).limit(1000);
    (data || []).forEach((r) => { out.myJoins[r.post_id] = true; });
  } catch (e) {}
  return out;
}

/* Who starred a post — the people behind the count, newest first. */
export async function fetchVibers(postId) {
  const { data, error } = await supabase
    .from('post_vibes')
    .select('created_at, user:profiles!post_vibes_user_id_fkey(*)')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).map((r) => r.user).filter(Boolean);
}

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    // name the exact FK (comments.user_id → profiles) so PostgREST never
    // has to guess — fixes "more than one relationship was found"
    .select('*, user:profiles!comments_user_id_fkey(*)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function addComment(postId, userId, body, parentId) {
  let payload = { post_id: postId, user_id: userId, body, parent_id: parentId || null };
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase
      .from('comments')
      .insert(payload)
      .select('*, user:profiles!comments_user_id_fkey(*)')
      .single();
    if (!error) return data;
    // DB without the replies column yet → post it as a normal comment
    if (/find the 'parent_id' column/i.test(error.message || '') && 'parent_id' in payload) {
      payload = { ...payload };
      delete payload.parent_id;
      continue;
    }
    throw error;
  }
  throw new Error('Could not post your comment.');
}

/* Likes on comments — restore + counts, fail-soft before the SQL runs. */
export async function fetchCommentLikes(commentIds, myId) {
  const out = { counts: {}, mine: {} };
  if (!commentIds.length) return out;
  try {
    const { data } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', commentIds)
      .limit(2000);
    (data || []).forEach((r) => {
      out.counts[r.comment_id] = (out.counts[r.comment_id] || 0) + 1;
      if (r.user_id === myId) out.mine[r.comment_id] = true;
    });
  } catch (e) {}
  return out;
}

export async function toggleCommentLike(commentId, userId, on) {
  if (on) {
    const { error } = await supabase
      .from('comment_likes')
      .upsert({ comment_id: commentId, user_id: userId }, { onConflict: 'comment_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
  }
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

/* Uploads captured media (a blob/data URL from the in-app camera).
   Routes through R2 (zero egress) with a Supabase Storage fallback. */
export async function uploadCapture(userId, uri, ext, contentType) {
  return uploadMediaSmart(userId, uri, ext, contentType);
}

/* Uploads a local image uri; returns the public URL to store on the post.
   Also R2-first via uploadMediaSmart. */
export async function uploadMedia(userId, localUri) {
  const ext = (localUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  const ct = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
  return uploadMediaSmart(userId, localUri, ext, ct);
}

/* Legacy direct-to-Supabase path, kept for reference. */
async function _uploadMediaSupabase(userId, localUri) {
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
