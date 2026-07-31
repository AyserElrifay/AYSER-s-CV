import { supabase } from '../lib/supabase';

/* ─── CLOSE FRIENDS · the smaller circle ──────────────────────────────
   One list. Yours. Private in both directions: you can read your own
   list and nobody else's, and nobody can find out whose list they're
   on — which is the whole point of it. That is a database policy, not
   a hidden button.

   A story marked close-only is filtered by the read policy on the
   table, so it holds against the API and not merely against our own
   screens. Somebody who is not on the list does not get the row. */

export async function fetchCloseFriends(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('close_friends')
    .select('friend_id, added_at, friend:profiles!close_friends_friend_id_fkey(id,name,handle,avatar_url,avatar_dna,country_flag)')
    .eq('owner_id', userId)
    .order('added_at', { ascending: false });
  if (error) return [];
  return (data || []).map((r) => ({ ...(r.friend || {}), id: r.friend_id, added_at: r.added_at }));
}

/* Just the ids — what a toggle list needs, without pulling profiles. */
export async function fetchCloseFriendIds(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase.from('close_friends').select('friend_id').eq('owner_id', userId);
  if (error) return new Set();
  return new Set((data || []).map((r) => r.friend_id));
}

export async function addCloseFriend(userId, friendId) {
  if (!userId || !friendId || userId === friendId) return false;
  const { error } = await supabase.from('close_friends').insert({ owner_id: userId, friend_id: friendId });
  if (error && !/duplicate/i.test(error.message || '')) throw error;
  return true;
}

export async function removeCloseFriend(userId, friendId) {
  const { error } = await supabase
    .from('close_friends')
    .delete()
    .eq('owner_id', userId)
    .eq('friend_id', friendId);
  if (error) throw error;
  return true;
}

export async function setCloseFriend(userId, friendId, on) {
  return on ? addCloseFriend(userId, friendId) : removeCloseFriend(userId, friendId);
}
