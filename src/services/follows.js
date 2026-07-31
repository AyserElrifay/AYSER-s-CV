import { supabase } from '../lib/supabase';

/* ─── FOLLOWING · one direction ───────────────────────────────────────
   Mates are mutual — both people agreed. Following is the other thing:
   you follow whoever you like, they don't have to follow back, and the
   two numbers on a profile can differ. That difference is the only
   reason showing both is worth anything; two identical counts would be
   decoration. */

export async function countFollowers(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('followee_id', userId);
  if (error) return 0;
  return count || 0;
}

export async function countFollowing(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('follows')
    .select('followee_id', { count: 'exact', head: true })
    .eq('follower_id', userId);
  if (error) return 0;
  return count || 0;
}

export async function amFollowing(myId, otherId) {
  if (!myId || !otherId) return false;
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', myId)
    .eq('followee_id', otherId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function follow(myId, otherId) {
  if (!myId || !otherId || myId === otherId) return false;
  const { error } = await supabase.from('follows').insert({ follower_id: myId, followee_id: otherId });
  if (error && !/duplicate/i.test(error.message || '')) throw error;
  return true;
}

export async function unfollow(myId, otherId) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', myId)
    .eq('followee_id', otherId);
  if (error) throw error;
  return true;
}

/* The people on either side, as profiles — for the lists behind the
   two numbers on a profile. */
export async function fetchFollowers(userId, limit = 200) {
  const { data, error } = await supabase
    .from('follows')
    .select('follower:profiles!follows_follower_id_fkey(id,name,handle,avatar_url,avatar_dna,country_flag,verified)')
    .eq('followee_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map((r) => r.follower).filter(Boolean);
}

export async function fetchFollowing(userId, limit = 200) {
  const { data, error } = await supabase
    .from('follows')
    .select('followee:profiles!follows_followee_id_fkey(id,name,handle,avatar_url,avatar_dna,country_flag,verified)')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map((r) => r.followee).filter(Boolean);
}
