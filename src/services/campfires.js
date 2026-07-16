import { supabase } from '../lib/supabase';

/* Real live rooms. A campfire is "live" while ended_at is null. */

export async function fetchLiveCampfires() {
  const { data, error } = await supabase
    .from('campfires')
    .select('*, host:profiles!campfires_host_id_fkey(name, handle, avatar_url, emoji)')
    .is('ended_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // drop any whose chosen duration has passed (ends_at in the past)
  const now = Date.now();
  return (data || []).filter((c) => !c.ends_at || new Date(c.ends_at).getTime() > now);
}

/* Edit your own campfire — title and/or its duration (ends_at). */
export async function updateCampfire(id, hostId, fields) {
  let attempt = { ...fields };
  for (let i = 0; i < 4; i++) {
    const { data, error } = await supabase
      .from('campfires')
      .update(attempt)
      .eq('id', id)
      .eq('host_id', hostId)
      .select('*, host:profiles!campfires_host_id_fkey(name, handle, avatar_url, emoji)')
      .single();
    if (!error) return data;
    // DB without the ends_at column yet → save without it
    const missing = /find the '([^']+)' column/i.exec(error.message || '');
    if (missing && Object.prototype.hasOwnProperty.call(attempt, missing[1])) { delete attempt[missing[1]]; continue; }
    throw error;
  }
  throw new Error('Could not update the campfire.');
}

export async function hostCampfire(hostId, { title, topic, lat, lng, hours }) {
  const row = { host_id: hostId, title, topic, lat, lng };
  if (hours) row.ends_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  let attempt = { ...row };
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase
      .from('campfires')
      .insert(attempt)
      .select('*, host:profiles!campfires_host_id_fkey(name, handle, avatar_url, emoji)')
      .single();
    if (!error) return data;
    const missing = /find the '([^']+)' column/i.exec(error.message || '');
    if (missing && Object.prototype.hasOwnProperty.call(attempt, missing[1])) { delete attempt[missing[1]]; continue; }
    throw error;
  }
  throw new Error('Could not host the campfire.');
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
