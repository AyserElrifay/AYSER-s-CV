import { supabase } from '../lib/supabase';

/* Real live locations — the map's "who's around right now" layer. */

export async function shareMyLocation(userId, { latitude, longitude }, doing) {
  const { error } = await supabase
    .from('live_locations')
    .upsert(
      { user_id: userId, lat: latitude, lng: longitude, doing, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

export async function goInvisible(userId) {
  const { error } = await supabase.from('live_locations').delete().eq('user_id', userId);
  if (error) throw error;
}

/* Only people active in the last 30 minutes count as "live" on the map. */
export async function fetchNearbyPeople() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('live_locations')
    .select('user_id, lat, lng, doing, updated_at, profile:profiles(name, handle, avatar_url, emoji, intent, verified)')
    .gt('updated_at', cutoff);
  if (error) throw error;
  return data;
}

export function subscribeNearby(onChange) {
  const channel = supabase
    .channel('live_locations_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
