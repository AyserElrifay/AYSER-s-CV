import { supabase } from '../lib/supabase';

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
