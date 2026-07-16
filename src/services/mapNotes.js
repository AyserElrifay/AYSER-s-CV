import { supabase } from '../lib/supabase';

/* Map notes — a comment/pin someone drops at their exact spot for a
   chosen duration (an hour, a day, a week, a month…). It disappears on
   its own when it expires, and the author can remove it any time. */

export async function dropNote(userId, { body, lat, lng, hours }) {
  const expires_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('map_notes')
    .insert({ user_id: userId, body, lat, lng, expires_at })
    .select('*, user:profiles!map_notes_user_id_fkey(name, avatar_url)')
    .single();
  if (error) throw error;
  return data;
}

/* Every note that hasn't expired yet, newest first. */
export async function fetchActiveNotes() {
  const { data, error } = await supabase
    .from('map_notes')
    .select('*, user:profiles!map_notes_user_id_fkey(name, avatar_url)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

/* Remove your own note (RLS lets you delete only your rows). */
export async function deleteNote(id, userId) {
  const { error } = await supabase.from('map_notes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
