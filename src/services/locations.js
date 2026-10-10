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

/* The real people on Moments, nearest first, each at the precision
   they agreed to (people_on_map in RUN_ME.sql): here now → their pin;
   seen this week → a spot rounded to ~1 km; everyone else → no spot,
   just their city. The rows come back in the shape the map already
   reads. If the database has not been updated yet, the old live-only
   query still works. */
export async function fetchNearbyPeople(at = null) {
  const { data, error } = await supabase.rpc('people_on_map', {
    p_lat: at && at.latitude != null ? at.latitude : null,
    p_lng: at && at.longitude != null ? at.longitude : null,
  });
  if (!error && Array.isArray(data)) {
    return data.map((r) => ({
      user_id: r.id, lat: r.lat, lng: r.lng, doing: r.doing, seen: r.seen, km: r.km,
      profile: {
        name: r.name, handle: r.handle, avatar_url: r.avatar_url, avatar_dna: r.avatar_dna, emoji: r.emoji,
        intent: r.intent, verified: r.verified, country_flag: r.country_flag, country: r.country, city: r.city,
      },
    }));
  }
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const old = await supabase
    .from('live_locations')
    .select('user_id, lat, lng, doing, updated_at, profile:profiles(name, handle, avatar_url, avatar_dna, emoji, intent, verified, country_flag)')
    .gt('updated_at', cutoff);
  if (old.error) throw old.error;
  return (old.data || []).map((r) => ({ ...r, seen: 'now' }));
}

/* Your own current row — used to rehydrate the "doing" badge on load,
   since the client's local state resets on every app open but your
   real visibility on the map does not. */
export async function fetchMyLiveLocation(userId) {
  const { data, error } = await supabase
    .from('live_locations')
    .select('doing, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
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
