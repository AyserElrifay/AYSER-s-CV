import { supabase } from '../lib/supabase';
import { explain } from '../lib/explain';

/* Real communities — create, discover, join, leave. */

/* WHY a group read or write failed, in the only three flavours that
   lead anywhere different. A missing table is a one-time setup somebody
   has to run; a refused row is a sign-in; anything else is the network.
   Telling them apart matters because the screen used to say "this is
   the connection, not you" while the card underneath it correctly said
   the tables were not there — two answers to the same question, one of
   them wrong.

   The sorting itself now lives in src/lib/explain.js, because the home
   feed needed exactly the same three answers. */
export const explainGroups = explain;

export async function fetchGroups(myUserId) {
  const { data, error } = await supabase
    .from('groups_with_counts')
    .select('*')
    .order('members_count', { ascending: false })
    .limit(50);
  if (error) throw error;

  /* Joined, waiting, or neither — three states, not two. Somebody who
     asked to join a private group and is waiting must not be shown a
     "Join" button that would do nothing, and must not be told they are
     in. Both of those were the same "joined: true/false" before. */
  const mine = new Map();
  if (myUserId) {
    const { data: mem } = await supabase
      .from('group_members').select('group_id, status, role').eq('user_id', myUserId);
    (mem || []).forEach((r) => mine.set(r.group_id, r));
  }

  /* "4 new posts" for every group at once. It is one call, and if the
     database has not been set up yet it simply comes back empty — a
     group list without badges is still a group list. */
  let unread = new Map();
  if (myUserId) {
    const { data: u } = await supabase.rpc('group_unread');
    (u || []).forEach((r) => unread.set(r.group_id, r.unread));
  }

  return (data || []).map((g) => {
    const m = mine.get(g.id);
    return {
      id: g.id,
      name: g.name,
      emoji: g.emoji || '🌐',
      about: g.about || '',
      cover_url: g.cover_url || null,
      city: g.city || null,
      rules: g.rules || null,
      privacy: g.privacy || 'open',
      members: g.members_count,
      owner_id: g.owner_id,
      joined: !!(m && m.status === 'joined'),
      waiting: !!(m && m.status === 'requested'),
      role: (m && m.role) || null,
      unread: unread.get(g.id) || 0,
    };
  });
}

/* One group on its own, for its page. */
export async function fetchGroup(groupId, myUserId) {
  const { data, error } = await supabase
    .from('groups_with_counts').select('*').eq('id', groupId).single();
  if (error) throw error;
  let m = null;
  if (myUserId) {
    const { data: rows } = await supabase
      .from('group_members').select('status, role')
      .eq('group_id', groupId).eq('user_id', myUserId).limit(1);
    m = (rows || [])[0] || null;
  }
  return {
    id: data.id,
    name: data.name,
    emoji: data.emoji || '🌐',
    about: data.about || '',
    cover_url: data.cover_url || null,
    city: data.city || null,
    rules: data.rules || null,
    privacy: data.privacy || 'open',
    members: data.members_count,
    owner_id: data.owner_id,
    joined: !!(m && m.status === 'joined'),
    waiting: !!(m && m.status === 'requested'),
    role: (m && m.role) || null,
    admin: !!(m && m.status === 'joined' && (m.role === 'owner' || m.role === 'admin')),
    owner: !!(myUserId && data.owner_id === myUserId),
  };
}

/* ── THE WALL ────────────────────────────────────────────────────────
   Author, words, picture, how many liked it, how many answered, and
   whether YOU liked it — one call, because six requests to paint one
   screen is what makes a feed feel slow on a phone. The server decides
   whether this wall is yours to read; the app does not get a say. */
export async function fetchWall(groupId, before) {
  const { data, error } = await supabase.rpc('group_wall', {
    gid: groupId, before_ts: before || null, lim: 20,
  });
  if (error) throw error;
  return data || [];
}

export async function postToGroup(groupId, authorId, { body, mediaUrl }) {
  const { data, error } = await supabase
    .from('group_posts')
    .insert({ group_id: groupId, author_id: authorId, body: (body || '').trim() || null, media_url: mediaUrl || null })
    .select().single();
  if (error) throw error;
  return data;
}

export async function removeGroupPost(postId) {
  const { error } = await supabase.from('group_posts').delete().eq('id', postId);
  if (error) throw error;
}

/* Liking is two different statements, so it is written as one thing
   here — every screen that offers a heart should not have to remember
   which way round it is. */
export async function setPostLike(postId, userId, on) {
  const q = on
    ? supabase.from('group_post_likes').upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
    : supabase.from('group_post_likes').delete().eq('post_id', postId).eq('user_id', userId);
  const { error } = await q;
  if (error) throw error;
}

export async function fetchPostComments(postId) {
  const { data, error } = await supabase
    .from('group_post_comments')
    .select('id, body, created_at, author_id, profiles:author_id (name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id, body: c.body, created_at: c.created_at, author_id: c.author_id,
    name: (c.profiles && c.profiles.name) || 'Someone',
    avatar: (c.profiles && c.profiles.avatar_url) || null,
  }));
}

export async function addPostComment(postId, authorId, body) {
  const { data, error } = await supabase
    .from('group_post_comments')
    .insert({ post_id: postId, author_id: authorId, body: body.trim() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function removePostComment(commentId) {
  const { error } = await supabase.from('group_post_comments').delete().eq('id', commentId);
  if (error) throw error;
}

/* ── WHO IS IN IT ────────────────────────────────────────────────── */
export async function fetchMembers(groupId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, role, status, joined_at, profiles:user_id (name, avatar_url)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data || []).map((m) => ({
    id: m.user_id, role: m.role, status: m.status,
    name: (m.profiles && m.profiles.name) || 'Someone',
    avatar: (m.profiles && m.profiles.avatar_url) || null,
  }));
}

export async function approveMember(groupId, userId) {
  const { error } = await supabase.rpc('group_approve', { gid: groupId, uid: userId });
  if (error) throw error;
}
export async function setMemberRole(groupId, userId, role) {
  const { error } = await supabase.rpc('group_set_role', { gid: groupId, uid: userId, new_role: role });
  if (error) throw error;
}
export async function removeMember(groupId, userId) {
  const { error } = await supabase.rpc('group_remove_member', { gid: groupId, uid: userId });
  if (error) throw error;
}

/* Marking a group as seen is fire-and-forget on purpose: it is a
   convenience, and a failed one must never stop the wall drawing. */
export function markGroupSeen(groupId) {
  supabase.rpc('group_seen', { gid: groupId }).then(() => {}, () => {});
}

export async function updateGroup(groupId, patch) {
  const { error } = await supabase.from('groups').update(patch).eq('id', groupId);
  if (error) throw error;
}

/* ─── DELETING A GROUP ───────────────────────────────────────────────
   The policy for this has been in the database since v5 — only the
   owner, checked server-side — and there was simply no way to ask for
   it. Everything hanging off the group (the wall, its comments, its
   likes, the membership rows) is declared `on delete cascade`, so this
   one statement takes the whole thing with it.

   Which is exactly why the screen asks twice before calling it. */
export async function deleteGroup(groupId) {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function createGroup(ownerId, { name, emoji, about, privacy, city }) {
  const { data, error } = await supabase
    .from('groups')
    .insert({
      owner_id: ownerId, name, emoji: emoji || '🌐', about: about || null,
      privacy: privacy === 'request' ? 'request' : 'open',
      city: city || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Joining an open group is joining. Asking to join a private one is
   asking, and the row has to say which — the database refuses the
   wrong one, so getting this right here is what turns a refusal into
   the right button. Returns what actually happened. */
export async function joinGroup(groupId, userId, privacy) {
  const status = privacy === 'request' ? 'requested' : 'joined';
  const { error } = await supabase
    .from('group_members')
    .upsert({ group_id: groupId, user_id: userId, role: 'member', status },
            { onConflict: 'group_id,user_id', ignoreDuplicates: true });
  if (error) throw error;
  return status;
}

export async function leaveGroup(groupId, userId) {
  const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  if (error) throw error;
}
