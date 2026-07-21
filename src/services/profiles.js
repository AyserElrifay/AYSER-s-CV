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

/* Presence heartbeat — stamp when you were last active, so chats can
   show a REAL "Active now / Active 12m ago" instead of a fake status.
   Fails soft (missing column before the SQL runs → just no-ops). */
export async function touchLastActive(userId) {
  if (!userId) return;
  try {
    await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', userId);
  } catch (e) { /* column not there yet — ignore */ }
}

/* ── Verification (artists & musicians) — real, owner-reviewed ──────── */

// A creator asks for the tick. One row per user (re-request updates it).
export async function requestVerification(userId, kind, note) {
  const { error } = await supabase
    .from('verification_requests')
    .upsert({ user_id: userId, kind: kind || 'artist', note: note || null, status: 'pending' }, { onConflict: 'user_id' });
  if (error) throw error;
  return true;
}

// Your own request status (pending | approved | rejected | null).
export async function myVerificationStatus(userId) {
  try {
    const { data } = await supabase.from('verification_requests').select('status').eq('user_id', userId).maybeSingle();
    return data ? data.status : null;
  } catch (e) { return null; }
}

// Owner only: the pending queue, with each requester's profile.
export async function fetchPendingVerifications() {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*, user:profiles!verification_requests_user_id_fkey(id, name, handle, avatar_url, account_type, artist_genre)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Owner only: approve or reject → flips the profile's verified tick.
export async function decideVerification(targetUserId, approve) {
  const { error } = await supabase.rpc('approve_verification', { target: targetUserId, approve: !!approve });
  if (error) throw error;
  return true;
}

/* Self-healing update: if the database is missing a column (a schema
   file not run yet), drop just that field and retry — so changing your
   name/username NEVER fails because an optional column is absent. */
export async function updateProfile(userId, fields) {
  let attempt = { ...fields };
  for (let i = 0; i < 8; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .update(attempt)
      .eq('id', userId)
      .select()
      .single();
    if (!error) return data;
    const missing = /find the '([^']+)' column/i.exec(error.message || '');
    if (missing && Object.prototype.hasOwnProperty.call(attempt, missing[1])) {
      delete attempt[missing[1]];
      if (!Object.keys(attempt).length) return getProfile(userId); // nothing left to save
      continue; // retry without the column this DB doesn't have yet
    }
    throw error;
  }
  throw new Error('Could not save your profile — try again.');
}
