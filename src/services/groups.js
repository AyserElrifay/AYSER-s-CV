import { supabase } from '../lib/supabase';

/* Real communities — create, discover, join, leave. */

/* WHY a group read or write failed, in the only three flavours that
   lead anywhere different. A missing table is a one-time setup somebody
   has to run; a refused row is a sign-in; anything else is the network.
   Telling them apart matters because the screen used to say "this is
   the connection, not you" while the card underneath it correctly said
   the tables were not there — two answers to the same question, one of
   them wrong. */
export function explainGroups(e) {
  const msg = String((e && (e.message || e.hint)) || '');
  const code = e && e.code;
  if (code === '42P01' || /does not exist|schema cache|could not find/i.test(msg)) return 'setup';
  if (code === '42501' || /row-level security|policy/i.test(msg)) return 'permission';
  return 'offline';
}

export async function fetchGroups(myUserId) {
  const { data, error } = await supabase
    .from('groups_with_counts')
    .select('*')
    .order('members_count', { ascending: false })
    .limit(50);
  if (error) throw error;

  let mine = new Set();
  if (myUserId) {
    const { data: mem } = await supabase.from('group_members').select('group_id').eq('user_id', myUserId);
    mine = new Set((mem || []).map((r) => r.group_id));
  }
  return (data || []).map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji || '🌐',
    about: g.about || '',
    members: g.members_count,
    owner_id: g.owner_id,
    joined: mine.has(g.id),
  }));
}

export async function createGroup(ownerId, { name, emoji, about }) {
  const { data, error } = await supabase
    .from('groups')
    .insert({ owner_id: ownerId, name, emoji: emoji || '🌐', about: about || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function joinGroup(groupId, userId) {
  const { error } = await supabase
    .from('group_members')
    .upsert({ group_id: groupId, user_id: userId }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function leaveGroup(groupId, userId) {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}
