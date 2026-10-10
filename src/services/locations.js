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
   reads. If the database has not been updated yet, see below. */
export async function fetchNearbyPeople(at = null) {
  const { data, error } = await supabase.rpc('people_on_map', {
    p_lat: at && at.latitude != null ? at.latitude : null,
    p_lng: at && at.longitude != null ? at.longitude : null,
  });
  if (!error && Array.isArray(data)) {
    return data.map((r) => ({
      user_id: r.id, lat: r.lat, lng: r.lng, doing: r.doing, seen: r.seen, km: r.km,
      mutuals: Number(r.mutuals) || 0, is_mate: !!r.is_mate,
      profile: {
        name: r.name, handle: r.handle, avatar_url: r.avatar_url, avatar_dna: r.avatar_dna, emoji: r.emoji,
        intent: r.intent, verified: r.verified, country_flag: r.country_flag, country: r.country, city: r.city, hobbies: r.hobbies,
      },
    }));
  }
  /* The database has not been updated yet (part 17 not run). Still
     everyone: the live rows (last 30 minutes) give the pins, and the
     profiles — readable by any signed-in user — give the rest, with no
     spot, only their city. Same shape, same precision rules. It used to
     fall back to the live rows alone, and said "0 people on Moments". */
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const [live, profiles] = await Promise.all([
    supabase.from('live_locations')
      .select('user_id, lat, lng, doing, updated_at, profile:profiles(name, handle, avatar_url, avatar_dna, emoji, intent, verified, country_flag, country, city, hobbies)')
      .gt('updated_at', cutoff),
    supabase.from('profiles')
      .select('id, name, handle, avatar_url, avatar_dna, emoji, intent, verified, country_flag, country, city, hobbies, last_active_at')
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .limit(200),
  ]);
  if (live.error && profiles.error) throw profiles.error;
  const out = (live.data || []).map((r) => ({ ...r, seen: 'now' }));
  const here = new Set(out.map((r) => r.user_id));
  for (const pr of profiles.data || []) {
    if (!pr || !pr.id || here.has(pr.id) || !String(pr.name || '').trim()) continue;
    out.push({ user_id: pr.id, lat: null, lng: null, doing: null, seen: null, km: null, profile: pr });
  }
  return out;
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
