import { supabase } from '../lib/supabase';

/* Real live rooms. A campfire is "live" while ended_at is null. */

export async function fetchLiveCampfires() {
  const { data, error } = await supabase
    .from('campfires')
    .select('*, host:profiles!campfires_host_id_fkey(name, handle, avatar_url, emoji)')
    .is('ended_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function hostCampfire(hostId, { title, topic, lat, lng }) {
  const { data, error } = await supabase
    .from('campfires')
    .insert({ host_id: hostId, title, topic, lat, lng })
    .select('*, host:profiles!campfires_host_id_fkey(name, handle, avatar_url, emoji)')
    .single();
  if (error) throw error;
  return data;
}

/* Join a gathering for real (campfire_members, schema v4). */
export async function joinCampfire(campfireId, userId) {
  const { error } = await supabase
    .from('campfire_members')
    .upsert({ campfire_id: campfireId, user_id: userId }, { onConflict: 'campfire_id,user_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function countMyCampfires(hostId) {
  const { count, error } = await supabase
    .from('campfires')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId);
  if (error) throw error;
  return count || 0;
}

export async function endCampfire(id) {
  const { error } = await supabase.from('campfires').update({ ended_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
