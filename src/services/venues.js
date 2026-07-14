import { supabase } from '../lib/supabase';

/* A REAL reservation row (schema v14 in RUN_ME.sql). The venue owner
   sees it (RLS lets them) and you see your own — plus it lands in the
   owner's DMs so nothing gets missed. */
export async function createVenueBooking({ venueId, venueName, userId, fullName, phone, bookingDate, people, notes }) {
  const { data, error } = await supabase
    .from('venue_bookings')
    .insert({
      venue_id: venueId || null,
      venue_name: venueName || null,
      user_id: userId,
      full_name: fullName,
      phone,
      booking_date: bookingDate || null,
      people: Math.max(1, parseInt(people, 10) || 1),
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Real bookable places on the map. A venue only shows to everyone once
   status flips from 'pending' to 'live' after human review — the same
   principle as certified course instructors. */

export async function fetchLiveVenues() {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('status', 'live')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function applyAsVenue(ownerId, { name, kind, emoji, sub, price, lat, lng }) {
  const { data, error } = await supabase
    .from('venues')
    .insert({ owner_id: ownerId, name, kind, emoji, sub, price, lat, lng })
    .select()
    .single();
  if (error) throw error;
  return data;
}
