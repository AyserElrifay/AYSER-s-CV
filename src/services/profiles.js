import { supabase } from '../lib/supabase';

/* Self-healing: accounts created BEFORE the signup trigger existed have
   no profiles row, which breaks every insert that references it (posts,
   stories, vibes…). Upsert your own row so posting always works.
   Requires the "users can insert own profile" policy (schema_v3). */
export async function ensureMyProfile(user) {
  if (!user) return;
  const name =
    (user.user_metadata && user.user_metadata.name) ||
    (user.email ? user.email.split('@')[0] : 'Explorer');
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, name }, { onConflict: 'id', ignoreDuplicates: true });
  if (error && error.code !== '23505') throw error;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, fields) {
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
