import { supabase } from '../lib/supabase';

/* ─── TRIPS · plans other people can join ─────────────────────────────
   A campfire is "I'm here now, come over". A trip is the other thing:
   "I'm going there on Friday, there are four seats". It sits on the map
   as a plan with a date and a place, and it drops off the map on its own
   once it's been and gone.

   Girls-only trips are enforced by the database, not by hiding a button.
   The insert policy on trip_members checks the joiner's own profile, so
   the rule holds even if someone talks to the API directly — which is
   the difference between a promise and a rule. */

/* Everything still ahead of us, soonest first. */
export async function fetchTrips({ girlsOnly = false, limit = 60 } = {}) {
  let q = supabase
    .from('trips')
    .select('*, host:profiles!trips_host_id_fkey(id,name,avatar_url,avatar_dna,country_flag), members:trip_members(user_id)')
    .gte('starts_at', new Date(Date.now() - 12 * 3600 * 1000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(limit);
  if (girlsOnly) q = q.eq('girls_only', true);
  const { data, error } = await q;
  if (error) return [];
  return (data || []).map((t) => ({
    ...t,
    taken: (t.members || []).length,
    free: Math.max(0, (t.seats || 0) - (t.members || []).length),
  }));
}

export async function hostTrip(userId, { title, destination, lat, lng, startsAt, endsAt, seats, girlsOnly, note }) {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      host_id: userId,
      title: String(title || '').trim(),
      destination: destination || null,
      lat: lat == null ? null : lat,
      lng: lng == null ? null : lng,
      starts_at: startsAt,
      ends_at: endsAt || null,
      seats: Math.max(2, Math.min(40, parseInt(seats, 10) || 6)),
      girls_only: !!girlsOnly,
      note: note || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/* The database is the one that says yes or no here — full trips and
   girls-only trips are both refused by the insert policy. We translate
   that refusal into something a person can read. */
export async function joinTrip(tripId, userId) {
  const { error } = await supabase.from('trip_members').insert({ trip_id: tripId, user_id: userId });
  if (!error) return true;
  const msg = String((error && error.message) || '');
  if (/row-level security|violates/i.test(msg)) {
    throw new Error('This one is either full or set to girls only. Check your profile says so, or find another trip.');
  }
  if (/duplicate/i.test(msg)) return true;         // already on it, no harm done
  throw error;
}

export async function leaveTrip(tripId, userId) {
  const { error } = await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId);
  if (error) throw error;
}

export async function cancelTrip(tripId, userId) {
  const { error } = await supabase.from('trips').delete().eq('id', tripId).eq('host_id', userId);
  if (error) throw error;
}
