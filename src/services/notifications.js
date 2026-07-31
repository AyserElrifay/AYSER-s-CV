import { supabase } from '../lib/supabase';

/* Real notifications — rows written by DB triggers (schema_v11), so
   every star, laugh, comment and mate event lands here guaranteed. */

/* One row per person, per thing — the same way Instagram does it.
   If someone stars the same moment again, it's still ONE line that just
   moves back to the top, never a wall of identical rows. Comments are
   left alone: every comment really is its own event. The database keeps
   this rule too (see supabase/RUN_ME.sql); this collapses anything that
   piled up before that rule existed. */
export function collapseNotifications(rows) {
  const seen = new Set();
  const out = [];
  for (const n of rows || []) {          // rows arrive newest-first
    if (n.kind === 'comment') { out.push(n); continue; }
    const key = n.actor_id + '|' + n.kind + '|' + (n.post_id || '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

export async function fetchMyNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(name, avatar_url, country_flag), post:posts(caption, media_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  return collapseNotifications(data || []);
}

/* The badge counts what you'll actually SEE in the inbox, so eight
   re-stars from one person on one moment read as a single unread. */
export async function countUnread(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, actor_id, kind, post_id')
    .eq('user_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return collapseNotifications(data || []).length;
}

export async function markAllRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

/* Live: fires the callback the instant a new notification lands. */
export function subscribeNotifications(userId, onNew) {
  const channel = supabase
    .channel('notifs-' + userId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId },
      (payload) => onNew(payload.new))
    .subscribe();
  return () => { try { supabase.removeChannel(channel); } catch (e) {} };
}

/* ── KEEPING IT SMALL ───────────────────────────────────────────────
   A notification is useful for a few days and then it is just storage
   — yours and ours. Nothing here is worth keeping forever, so there
   are two ways for it to go: you clear it, or it ages out.

   clearMyNotifications deletes YOURS. The row is gone, not flagged
   hidden — a "cleared" list that still exists is not cleared. */
export async function clearMyNotifications(userId) {
  if (!userId) return 0;
  const { error, count } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .eq('user_id', userId);
  if (error) throw error;
  return count || 0;
}

/* Drop a single one — the swipe-away, for the one you don't care about. */
export async function dismissNotification(id, userId) {
  if (!id || !userId) return;
  const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/* Anything older than a week goes on its own. Runs once per session,
   quietly, on rows that are already yours — no schedule to maintain
   and no server job to pay for. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export async function pruneOldNotifications(userId) {
  if (!userId) return;
  const cutoff = new Date(Date.now() - WEEK_MS).toISOString();
  try {
    await supabase.from('notifications').delete().eq('user_id', userId).lt('created_at', cutoff);
  } catch (e) { /* never block the list over housekeeping */ }
}
