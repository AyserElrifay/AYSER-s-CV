import { supabase } from '../lib/supabase';

/* ── TAGGING PEOPLE ────────────────────────────────────────────────
   Putting somebody's name on a moment is a claim about them, so the
   rules are the strict ones: only the person who shared the moment can
   tag, and whoever was tagged can always take themselves back out —
   the database enforces both, not just this file.

   Every tag is a real row, a real notification, and a real entry in
   that person's Tagged tab. Nothing here is decorative. */

export async function tagPeople(postId, taggerId, userIds) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!postId || !ids.length) return [];
  const rows = ids.map((id) => ({ post_id: postId, user_id: id, tagged_by: taggerId }));
  const { data, error } = await supabase
    .from('post_tags')
    .upsert(rows, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
    .select('post_id, user_id');
  if (error) throw error;
  return data || [];
}

/* Who is in this moment — the faces under the photo. */
export async function fetchPostTags(postId) {
  const { data, error } = await supabase
    .from('post_tags')
    .select('user_id, created_at, user:profiles!post_tags_user_id_fkey(id, name, handle, avatar_url, country_flag, verified)')
    .eq('post_id', postId)
    .limit(30);
  if (error) return [];
  return (data || []).map((r) => r.user).filter(Boolean);
}

/* Tags across a set of posts in one go — used by the feed so a card
   knows who's in it without a query per card. */
export async function fetchTagsForPosts(postIds) {
  const out = {};
  if (!postIds || !postIds.length) return out;
  const { data, error } = await supabase
    .from('post_tags')
    .select('post_id, user:profiles!post_tags_user_id_fkey(id, name, handle, avatar_url)')
    .in('post_id', postIds)
    .limit(500);
  if (error) return out;
  (data || []).forEach((r) => {
    if (!r.user) return;
    (out[r.post_id] = out[r.post_id] || []).push(r.user);
  });
  return out;
}

/* Moments you're in — the Tagged tab, at last with something in it. */
export async function fetchTaggedPosts(userId) {
  const { data, error } = await supabase
    .from('post_tags')
    .select('created_at, post:posts!post_tags_post_id_fkey(*, user:profiles!posts_user_id_fkey(*), vibes:post_vibes(count))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return [];
  return (data || [])
    .filter((r) => r.post)
    .map((r) => ({
      ...r.post,
      vibesCount: (r.post.vibes && r.post.vibes[0] && r.post.vibes[0].count) || 0,
      tagged_at: r.created_at,
    }));
}

/* Take yourself out of somebody's moment — or, if it's yours, take
   somebody else out of it. */
export async function removeTag(postId, userId) {
  const { error } = await supabase
    .from('post_tags')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  if (error) throw error;
}
