import { supabase } from '../lib/supabase';

/* Community reviews on the curated destinations (schema_v10). */

export async function fetchDestReviews(destId) {
  const { data, error } = await supabase
    .from('destination_reviews')
    .select('*, user:profiles(name, avatar_url, country_flag)')
    .eq('dest_id', destId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data || [];
}

/* Upsert — one review per person per place, always editable. */
export async function addDestReview(destId, userId, stars, body) {
  const { data, error } = await supabase
    .from('destination_reviews')
    .upsert({ dest_id: destId, user_id: userId, stars, body: body || null }, { onConflict: 'dest_id,user_id' })
    .select('*, user:profiles(name, avatar_url, country_flag)')
    .single();
  if (error) throw error;
  return data;
}
