import { supabase } from '../lib/supabase';

/* Real chat — squad group threads and 1:1 DMs share one table,
   distinguished by which foreign key is set. */

export async function getOrCreateDmThread(otherUserId) {
  const { data, error } = await supabase.rpc('get_or_create_dm_thread', { other_user: otherUserId });
  if (error) throw error;
  return data; // thread id (uuid)
}

export async function fetchMessages({ squadId, dmThreadId }) {
  let q = supabase
    .from('messages')
    .select('*, user:profiles(name, handle, avatar_url)')
    .order('created_at', { ascending: true })
    .limit(200);
  q = squadId ? q.eq('squad_id', squadId) : q.eq('dm_thread_id', dmThreadId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function sendMessage({ squadId, dmThreadId, userId, body }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ squad_id: squadId || null, dm_thread_id: dmThreadId || null, user_id: userId, body })
    .select('*, user:profiles(name, handle, avatar_url)')
    .single();
  if (error) throw error;
  return data;
}

export function subscribeMessages({ squadId, dmThreadId }, onInsert) {
  const filter = squadId ? 'squad_id=eq.' + squadId : 'dm_thread_id=eq.' + dmThreadId;
  const channel = supabase
    .channel('messages_' + (squadId || dmThreadId))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, onInsert)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* Your real DM inbox — every thread you're actually a participant in,
   with the other person's real profile and the real last message. */
export async function fetchMyDmThreads(userId) {
  const { data: mine, error } = await supabase
    .from('dm_participants')
    .select('thread_id')
    .eq('user_id', userId);
  if (error) throw error;
  const threadIds = (mine || []).map((r) => r.thread_id);
  if (!threadIds.length) return [];

  const { data: others, error: err2 } = await supabase
    .from('dm_participants')
    .select('thread_id, user:profiles(id, name, handle, avatar_url, verified)')
    .in('thread_id', threadIds)
    .neq('user_id', userId);
  if (err2) throw err2;

  const { data: lastMsgs } = await supabase
    .from('messages')
    .select('dm_thread_id, body, created_at')
    .in('dm_thread_id', threadIds)
    .order('created_at', { ascending: false });
  const lastByThread = {};
  (lastMsgs || []).forEach((m) => { if (!lastByThread[m.dm_thread_id]) lastByThread[m.dm_thread_id] = m; });

  return others
    .map((o) => ({
      threadId: o.thread_id,
      user: o.user,
      last: (lastByThread[o.thread_id] && lastByThread[o.thread_id].body) || 'Say hi 👋',
      time: (lastByThread[o.thread_id] && lastByThread[o.thread_id].created_at) || null,
    }))
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
}

/* Real squads you're actually a member of (empty until someone builds
   the "create a squad" flow — an honest empty state, not fake rows). */
export async function fetchMySquads(userId) {
  const { data, error } = await supabase
    .from('squad_members')
    .select('squad:squads(id, name, emoji, created_at)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((r) => r.squad).filter(Boolean);
}
