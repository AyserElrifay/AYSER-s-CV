import { supabase } from '../lib/supabase';

/* Real notifications — rows written by DB triggers (schema_v11), so
   every star, laugh, comment and mate event lands here guaranteed. */

export async function fetchMyNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(name, avatar_url, country_flag), post:posts(caption, media_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return data || [];
}

export async function countUnread(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
  return count || 0;
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
