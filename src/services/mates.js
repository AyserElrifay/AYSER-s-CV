import { supabase } from '../lib/supabase';

/* ── MATES · the real friend graph ─────────────────────────────────
   "Mate up" sends a real request row. If the other person already
   requested YOU, it auto-accepts — you're mates instantly (the
   Snapchat add-back moment). Needs supabase/schema_v8_mates.sql. */

// 'none' | 'requested' | 'incoming' | 'mates'
export async function getMateStatus(myId, otherId) {
  const { data, error } = await supabase
    .from('mates')
    .select('*')
    .or(`and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`)
    .limit(1);
  if (error) throw error;
  const row = data && data[0];
  if (!row) return 'none';
  if (row.status === 'accepted') return 'mates';
  return row.requester_id === myId ? 'requested' : 'incoming';
}

/* Send a request; auto-accept if they already asked you. Returns new status. */
export async function mateUp(myId, otherId) {
  const status = await getMateStatus(myId, otherId);
  if (status === 'mates' || status === 'requested') return status;
  if (status === 'incoming') {
    const { error } = await supabase
      .from('mates')
      .update({ status: 'accepted' })
      .eq('requester_id', otherId)
      .eq('addressee_id', myId);
    if (error) throw error;
    return 'mates';
  }
  const { error } = await supabase
    .from('mates')
    .insert({ requester_id: myId, addressee_id: otherId });
  if (error && error.code !== '23505') throw error; // duplicate = already requested
  return 'requested';
}

export async function unmate(myId, otherId) {
  const { error } = await supabase
    .from('mates')
    .delete()
    .or(`and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`);
  if (error) throw error;
}

/* How many accepted mates a user has (public count for profiles). */
export async function countMates(userId) {
  const { count, error } = await supabase
    .from('mates')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  return count || 0;
}

/* Incoming requests waiting on you — for a "Mate requests" inbox. */
export async function fetchIncomingRequests(myId) {
  const { data, error } = await supabase
    .from('mates')
    .select('*, requester:profiles!mates_requester_id_fkey(*)')
    .eq('addressee_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function acceptRequest(requestId) {
  const { error } = await supabase
    .from('mates')
    .update({ status: 'accepted' })
    .eq('id', requestId);
  if (error) throw error;
}
