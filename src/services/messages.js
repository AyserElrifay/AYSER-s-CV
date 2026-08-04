import { supabase } from '../lib/supabase';

/* Real chat — squad group threads and 1:1 DMs share one table,
   distinguished by which foreign key is set. */

export async function getOrCreateDmThread(otherUserId, myId) {
  const { data, error } = await supabase.rpc('get_or_create_dm_thread', { other_user: otherUserId });
  if (error) throw error;
  const threadId = data; // uuid

  /* Mark the two sides: whoever opened it has obviously accepted, the
     other person hasn't been asked yet. Mates skip all of this — they
     already agreed to each other. Any failure here is left alone rather
     than blocking the conversation. */
  if (threadId && myId) {
    try {
      const { data: mate } = await supabase
        .from('mates')
        .select('id')
        .eq('status', 'accepted')
        .or('and(requester_id.eq.' + myId + ',addressee_id.eq.' + otherUserId + '),and(requester_id.eq.' + otherUserId + ',addressee_id.eq.' + myId + ')')
        .maybeSingle();
      if (!mate) {
        await supabase.from('dm_participants')
          .update({ accepted: true }).eq('thread_id', threadId).eq('user_id', myId);
        await supabase.from('dm_participants')
          .update({ accepted: false, invited_by: myId })
          .eq('thread_id', threadId).eq('user_id', otherUserId).is('accepted', null);
      }
    } catch (e) { /* never block a conversation over this */ }
  }
  return threadId;
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

/* Send a Moment — a photo/video shot in the camera, dropped straight
   into the chat like a Snapchat snap. It's a real message row with
   media attached; body carries the caption (or a 🔥 fallback so the
   NOT NULL constraint holds). Falls back to a plain text message if the
   moment columns aren't in the DB yet (SQL not run), so it never fails
   silently. */
export async function sendMoment({ squadId, dmThreadId, userId, mediaUrl, mediaKind, caption }) {
  const body = (caption && caption.trim()) || '🔥 Moment';
  const full = {
    squad_id: squadId || null, dm_thread_id: dmThreadId || null, user_id: userId,
    body, media_url: mediaUrl, media_kind: mediaKind || 'photo', kind: 'moment',
  };
  let res = await supabase.from('messages').insert(full)
    .select('*, user:profiles(name, handle, avatar_url)').single();
  // DB without the moment columns yet → send the caption as a normal message
  if (res.error && /media_url|media_kind|'kind'|column/i.test(res.error.message || '')) {
    res = await supabase.from('messages')
      .insert({ squad_id: squadId || null, dm_thread_id: dmThreadId || null, user_id: userId, body })
      .select('*, user:profiles(name, handle, avatar_url)').single();
  }
  if (res.error) throw res.error;
  return res.data;
}

/* Send a real "Catch Your Mate" duel invite into the chat — a normal
   message row, just carrying a game_match_id so it renders as an
   invite card instead of text (see ChatThread). */
export async function sendGameInvite({ dmThreadId, userId, matchId }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ dm_thread_id: dmThreadId, user_id: userId, body: '🏃 Catch Your Mate — invite sent', kind: 'game_invite', game_match_id: matchId })
    .select('*, user:profiles(name, handle, avatar_url)')
    .single();
  if (error) throw error;
  return data;
}

/* Snapchat-style streak: consecutive days on which BOTH people sent at
   least one Moment. Computed purely from the loaded chat messages (local
   shape: { userId, createdAt, kind, mediaUrl }) — real, no separate
   counter to drift out of sync. The streak stays "alive" through today
   even before today's moment lands; it breaks once a full day is missed. */
export function computeStreak(messages, myId, peerId) {
  if (!myId || !peerId) return 0;
  const key = (t) => { const x = new Date(t); return x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate(); };
  const byDay = {}; // dayKey → { me:bool, peer:bool }
  (messages || []).forEach((m) => {
    const isMoment = m.kind === 'moment' || !!m.mediaUrl;
    const when = m.createdAt || m.created_at;
    if (!isMoment || !when) return;
    const k = key(when);
    if (!byDay[k]) byDay[k] = { me: false, peer: false };
    if (m.userId === myId) byDay[k].me = true;
    else if (m.userId === peerId) byDay[k].peer = true;
  });
  const MS = 86400000;
  const now = Date.now();
  const bothToday = byDay[key(now)] && byDay[key(now)].me && byDay[key(now)].peer;
  const start = bothToday ? now : now - MS; // yesterday still counts as alive
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const d = byDay[key(start - i * MS)];
    if (d && d.me && d.peer) streak++;
    else break;
  }
  return streak;
}

/* A milestone flair for a streak number — the little badge that rides
   next to the 🔥, Snapchat-style. */
export function streakBadge(n) {
  if (n >= 1000) return '🌟';
  if (n >= 365) return '👑';
  if (n >= 100) return '💯';
  if (n >= 30) return '✨';
  return '';
}

/* The full streak picture for a chat: the number, whether it's about to
   break (both people need to send a Moment today or lose it), how many
   hours are left today, and a milestone badge. Real — all derived from
   the moments actually exchanged. */
export function streakInfo(messages, myId, peerId) {
  const n = computeStreak(messages, myId, peerId);
  if (!n) return { n: 0, expiring: false, hoursLeft: 0, badge: '' };
  const key = (t) => { const x = new Date(t); return x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate(); };
  const today = key(Date.now());
  let meToday = false, peerToday = false;
  (messages || []).forEach((m) => {
    const isMoment = m.kind === 'moment' || !!m.mediaUrl;
    const when = m.createdAt || m.created_at;
    if (!isMoment || !when || key(when) !== today) return;
    if (m.userId === myId) meToday = true;
    else if (m.userId === peerId) peerToday = true;
  });
  const bothToday = meToday && peerToday;
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const hoursLeft = Math.max(0, Math.round((endOfDay - now) / 3600000));
  return { n, expiring: !bothToday, meToday, peerToday, hoursLeft, badge: streakBadge(n) };
}

/* Streaks across ALL your DM threads at once — so the chats list can show
   a 🔥 next to each conversation. Fail-soft: returns {} if the moment
   columns aren't in the DB yet. Shape: { [threadId]: streakInfo }. */
export async function fetchDmStreaks(userId) {
  try {
    const { data: mine } = await supabase.from('dm_participants').select('thread_id').eq('user_id', userId);
    const threadIds = (mine || []).map((r) => r.thread_id);
    if (!threadIds.length) return {};
    const { data: others } = await supabase
      .from('dm_participants').select('thread_id, user_id').in('thread_id', threadIds).neq('user_id', userId);
    const peerByThread = {};
    (others || []).forEach((o) => { peerByThread[o.thread_id] = o.user_id; });
    const { data: moments, error } = await supabase
      .from('messages')
      .select('dm_thread_id, user_id, created_at, kind, media_url')
      .in('dm_thread_id', threadIds)
      .order('created_at', { ascending: false })
      .limit(4000);
    if (error) return {};
    const byThread = {};
    (moments || []).forEach((m) => {
      if (m.kind !== 'moment' && !m.media_url) return;
      (byThread[m.dm_thread_id] = byThread[m.dm_thread_id] || []).push({
        userId: m.user_id, createdAt: m.created_at, kind: m.kind, mediaUrl: m.media_url,
      });
    });
    const out = {};
    threadIds.forEach((tid) => {
      const info = streakInfo(byThread[tid] || [], userId, peerByThread[tid]);
      if (info.n > 0) out[tid] = info;
    });
    return out;
  } catch (e) {
    return {};
  }
}

export function subscribeMessages({ squadId, dmThreadId }, onInsert) {
  const filter = squadId ? 'squad_id=eq.' + squadId : 'dm_thread_id=eq.' + dmThreadId;
  const channel = supabase
    .channel('messages_' + (squadId || dmThreadId))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, onInsert)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* ── Disappearing messages ──────────────────────────────────────────
   Each DM thread can have a TTL (hours). Messages older than the TTL
   are filtered out of every fetch and swept from the DB — so the
   choice (24h / week / month / 3 months / keep forever) is REAL, not
   cosmetic. null = keep forever. */

export async function getThreadTtl(threadId) {
  const { data, error } = await supabase.from('dm_threads').select('ttl_hours').eq('id', threadId).maybeSingle();
  if (error) throw error;
  return data ? data.ttl_hours : null;
}

export async function setThreadTtl(threadId, hours) {
  const { error } = await supabase.from('dm_threads').update({ ttl_hours: hours }).eq('id', threadId);
  if (error) throw error;
}

/* Hard-delete the thread's expired TEXT messages (best-effort — RLS
   lets a participant do this; failures are silent, the client filter
   still hides them). Media Moments are deliberately spared: deleting
   them would break streaks longer than the timer window. */
export async function sweepExpired(threadId, ttlHours) {
  if (!ttlHours || ttlHours <= 0) return;
  const cutoff = new Date(Date.now() - ttlHours * 3600 * 1000).toISOString();
  try {
    await supabase.from('messages').delete()
      .eq('dm_thread_id', threadId)
      .is('media_url', null) // text only — snaps/moments survive for streaks
      .lt('created_at', cutoff);
  } catch (e) {}
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

  /* `user_id` is selected alongside the joined profile on purpose. The
     join comes back null whenever the other person's profile row can't
     be read — a deleted account, or a row the read policy hides — and
     the screen used to take that null straight into `d.user.id`, which
     threw and took the whole Chats tab down with it. One unreadable
     profile should cost you that one name, not every conversation you
     have. With the id in hand the thread still opens and its history is
     still there. */
  const { data: others, error: err2 } = await supabase
    .from('dm_participants')
    .select('thread_id, user_id, user:profiles(id, name, handle, avatar_url, verified)')
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

  return (others || [])
    .map((o) => ({
      threadId: o.thread_id,
      // never null — the caller renders this without asking
      user: o.user || { id: o.user_id, name: 'Someone', handle: null, avatar_url: null, verified: false },
      last: (lastByThread[o.thread_id] && lastByThread[o.thread_id].body) || 'Say hi 👋',
      time: (lastByThread[o.thread_id] && lastByThread[o.thread_id].created_at) || null,
    }))
    .filter((d) => d.threadId && d.user.id)
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
}

/* Real squads you're actually a member of. */
export async function fetchMySquads(userId) {
  // avatar_url may not exist pre-migration → fall back to name/emoji only
  const sel = 'squad:squads(id, name, emoji, avatar_url, created_at)';
  let { data, error } = await supabase.from('squad_members').select(sel).eq('user_id', userId);
  if (error && /avatar_url|column/i.test(error.message || '')) {
    ({ data, error } = await supabase.from('squad_members').select('squad:squads(id, name, emoji, created_at)').eq('user_id', userId));
  }
  if (error) throw error;
  return (data || []).map((r) => r.squad).filter(Boolean);
}

/* Create a real squad (group chat) and join it as the first member. */
export async function createSquad(userId, { name, emoji, avatarUrl }) {
  const full = { name, emoji: emoji || '🏕️', avatar_url: avatarUrl || null };
  let res = await supabase.from('squads').insert(full).select().single();
  if (res.error && /avatar_url|column/i.test(res.error.message || '')) {
    res = await supabase.from('squads').insert({ name, emoji: emoji || '🏕️' }).select().single();
  }
  if (res.error) throw res.error;
  const { error: memErr } = await supabase.from('squad_members').insert({ squad_id: res.data.id, user_id: userId });
  if (memErr) throw memErr;
  return res.data;
}

/* Set (or change) a squad's photo. */
export async function setSquadImage(squadId, avatarUrl) {
  const { error } = await supabase.from('squads').update({ avatar_url: avatarUrl }).eq('id', squadId);
  if (error) throw error;
  return true;
}

/* Who's already in a squad — so the invite sheet can mark existing
   members instead of forgetting them every time it opens (which made a
   saved invite look like it never happened). */
export async function fetchSquadMemberIds(squadId) {
  try {
    const { data } = await supabase.from('squad_members').select('user_id').eq('squad_id', squadId);
    return (data || []).map((r) => r.user_id);
  } catch (e) { return []; }
}

/* Add a mate to your squad (they appear in the group instantly). */
/* An invite, not a membership. It sits pending until they accept, and
   the squad doesn't show up in their list before that — being dropped
   into a group without a say is exactly the thing people hate. */
export async function addSquadMember(squadId, userId, invitedBy) {
  const row = { squad_id: squadId, user_id: userId, accepted: false, invited_by: invitedBy || null };
  let { error } = await supabase
    .from('squad_members')
    .upsert(row, { onConflict: 'squad_id,user_id', ignoreDuplicates: true });
  if (error && /accepted|invited_by|column/i.test(error.message || '')) {
    // older database without the invite columns — fall back rather than fail
    const res = await supabase
      .from('squad_members')
      .upsert({ squad_id: squadId, user_id: userId }, { onConflict: 'squad_id,user_id', ignoreDuplicates: true });
    error = res.error;
  }
  if (error) throw error;
}

/* Leave (close) a squad — your membership row is deleted; the squad
   vanishes from your list. Last one out leaves an empty room. */
export async function leaveSquad(squadId, userId) {
  const { error } = await supabase
    .from('squad_members')
    .delete()
    .eq('squad_id', squadId)
    .eq('user_id', userId);
  if (error) throw error;
}

/* ── SOMEBODY SCREENSHOTTED THIS ────────────────────────────────────
   A note in the thread, visible to both of you, saying a screenshot was
   taken. It isn't surveillance and it isn't presented as a catch: it's
   the same courtesy Snapchat has — if you keep a copy of what somebody
   sent you, they get told.

   Be honest about the limit, because it matters here: a browser cannot
   detect a screenshot. iOS and Android give web pages no such event,
   and they never will. What we CAN see is the moment the phone hands
   the screen to the system UI to take one, which shows up as the page
   losing focus while staying visible — plus the desktop PrintScreen
   key. So this catches most screenshots and will miss some, and we
   never claim otherwise anywhere in the app. */
export async function noteScreenshot({ dmThreadId, squadId, userId }) {
  if (!userId || (!dmThreadId && !squadId)) return null;
  const row = { user_id: userId, body: '📸 took a screenshot', kind: 'screenshot' };
  if (dmThreadId) row.dm_thread_id = dmThreadId; else row.squad_id = squadId;
  let res = await supabase.from('messages').insert(row).select('*, user:profiles(name, handle, avatar_url)').single();
  if (res.error && /'kind'|column/i.test(res.error.message || '')) {
    // older database without the kind column — send it as plain text so
    // the other person still finds out
    delete row.kind;
    res = await supabase.from('messages').insert(row).select('*, user:profiles(name, handle, avatar_url)').single();
  }
  if (res.error) return null;
  return res.data;
}

/* ── MESSAGE REQUESTS · a stranger has to be let in ──────────────────
   Anyone may write to you. What they may not do is land in your inbox
   uninvited, keep talking when you haven't answered, or send you a
   picture before you've agreed to hear from them. The last of those is
   enforced by a trigger on the messages table, so it holds against the
   API and not merely against our screens.

   Somebody you have already accepted, or already messaged, is not a
   request — the thread is open in both directions from then on. */

/* Threads waiting on your answer, newest first, with a preview so you
   can decide without opening anything. */
export async function fetchMessageRequests(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('dm_participants')
    .select('thread_id, invited_by, inviter:profiles!dm_participants_invited_by_fkey(id,name,handle,avatar_url,avatar_dna,country_flag)')
    .eq('user_id', userId)
    .eq('accepted', false);
  if (error) return [];
  const rows = data || [];
  if (!rows.length) return [];

  // the few lines they were allowed to send, so you can judge
  const ids = rows.map((r) => r.thread_id);
  const { data: msgs } = await supabase
    .from('messages')
    .select('dm_thread_id, body, created_at')
    .in('dm_thread_id', ids)
    .order('created_at', { ascending: false });
  const firstOf = {};
  (msgs || []).forEach((m) => { if (!firstOf[m.dm_thread_id]) firstOf[m.dm_thread_id] = m; });

  return rows.map((r) => ({
    threadId: r.thread_id,
    from: r.inviter || null,
    preview: (firstOf[r.thread_id] && firstOf[r.thread_id].body) || '',
    at: firstOf[r.thread_id] && firstOf[r.thread_id].created_at,
  }));
}

export async function countMessageRequests(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('dm_participants')
    .select('thread_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('accepted', false);
  if (error) return 0;
  return count || 0;
}

export async function acceptMessageRequest(threadId, userId) {
  const { error } = await supabase
    .from('dm_participants')
    .update({ accepted: true })
    .eq('thread_id', threadId)
    .eq('user_id', userId);
  if (error) throw error;
  return true;
}

/* Declining removes you from the thread. They aren't told — being told
   you were turned down is its own small unpleasantness, and it invites
   a second attempt from another account. */
export async function declineMessageRequest(threadId, userId) {
  const { error } = await supabase
    .from('dm_participants')
    .delete()
    .eq('thread_id', threadId)
    .eq('user_id', userId);
  if (error) throw error;
  return true;
}

/* Is this thread open, or still a request? Drives whether the camera
   and the games appear at all. */
export async function isThreadOpen(threadId) {
  if (!threadId) return true;
  const { data, error } = await supabase.rpc('dm_is_open', { thread: threadId });
  if (error) return true;          // never lock someone out on a lookup failure
  return data !== false;
}

/* ── SQUAD INVITES · nobody gets dropped into a room ─────────────── */

export async function fetchSquadInvites(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('squad_members')
    .select('squad_id, invited_by, squad:squads(id,name,emoji), inviter:profiles!squad_members_invited_by_fkey(id,name,avatar_url)')
    .eq('user_id', userId)
    .eq('accepted', false);
  if (error) return [];
  return (data || []).map((r) => ({
    squadId: r.squad_id,
    squad: r.squad || null,
    from: r.inviter || null,
  }));
}

export async function acceptSquadInvite(squadId, userId) {
  const { error } = await supabase
    .from('squad_members')
    .update({ accepted: true })
    .eq('squad_id', squadId)
    .eq('user_id', userId);
  if (error) throw error;
  return true;
}

export async function declineSquadInvite(squadId, userId) {
  const { error } = await supabase
    .from('squad_members')
    .delete()
    .eq('squad_id', squadId)
    .eq('user_id', userId);
  if (error) throw error;
  return true;
}
