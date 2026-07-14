import { supabase } from '../lib/supabase';

/* Book Trip — a real booking request row (schema_v12). The owner sees
   every request in Supabase → Table Editor → trip_requests, contacts
   the traveler, arranges the trip, and earns the commission. */

export async function requestTrip({ userId, destId, destName, fullName, phone, travelDate, people, notes }) {
  const { data, error } = await supabase
    .from('trip_requests')
    .insert({
      user_id: userId,
      dest_id: destId,
      dest_name: destName,
      full_name: fullName,
      phone,
      travel_date: travelDate || null,
      people: Math.max(1, parseInt(people, 10) || 1),
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Your own requests — so travelers can see what they asked for. */
export async function fetchMyTripRequests(userId) {
  const { data, error } = await supabase
    .from('trip_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
