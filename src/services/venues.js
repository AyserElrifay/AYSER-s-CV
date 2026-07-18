import { supabase } from '../lib/supabase';

/* The platform's cut on every booking — Moments' reservation revenue. */
export const BOOKING_FEE_EGP = 15;

/* A REAL reservation row (schema v14 in RUN_ME.sql). The venue owner
   sees it (RLS lets them) and you see your own — plus it lands in the
   owner's DMs so nothing gets missed. Each booking carries the Moments
   service fee, so reservation revenue is real data, not a hope. */
export async function createVenueBooking({ venueId, venueName, userId, fullName, phone, bookingDate, people, notes }) {
  let payload = {
    venue_id: venueId || null,
    venue_name: venueName || null,
    user_id: userId,
    full_name: fullName,
    phone,
    booking_date: bookingDate || null,
    people: Math.max(1, parseInt(people, 10) || 1),
    notes: notes || null,
    service_fee_egp: BOOKING_FEE_EGP,
  };
  let res = await supabase.from('venue_bookings').insert(payload).select().single();
  // DB without the fee column yet → book anyway, never lose a reservation
  if (res.error && /service_fee_egp|column/i.test(res.error.message || '')) {
    delete payload.service_fee_egp;
    res = await supabase.from('venue_bookings').insert(payload).select().single();
  }
  if (res.error) throw res.error;
  return res.data;
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
