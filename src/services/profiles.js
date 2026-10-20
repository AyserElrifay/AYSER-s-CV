import { supabase } from '../lib/supabase';

/* Self-healing: accounts created BEFORE the signup trigger existed have
   no profiles row, which breaks every insert that references it (posts,
   stories, vibes…). Upsert your own row so posting always works.
   Requires the "users can insert own profile" policy (schema_v3). */
export async function ensureMyProfile(user) {
  if (!user) return;
  /* Not from the email. Seeding a display name out of somebody's
     address puts it on every post they ever make, and they never chose
     it. Their own name if they gave one, a neutral placeholder if not
     — which they can change in a second. */
  const name = (user.user_metadata && user.user_metadata.name) || 'Explorer';
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, name }, { onConflict: 'id', ignoreDuplicates: true });
  if (error && error.code !== '23505') throw error;
}

/* ─── WHAT OF A PROFILE ANYBODY MAY READ ──────────────────────────────
   The database hands out a profile column by column (RUN_ME.sql,
   "SECURITY · WHAT ANYBODY CAN READ"): the public face — name, photo,
   flag, bio — to anybody signed in; where somebody is, their gender and
   their settings to nobody but themselves. So nothing here asks for "*"
   of somebody else's row: that would be refused whole.

   PUBLIC_PROFILE only names columns that have been there since the
   early days, so it works on a database that has not had the newest
   setup yet as well as on one that has. */
export const PUBLIC_PROFILE = 'id, name, handle, emoji, avatar_url, avatar_dna, bio, intent, verified, country, country_flag, city, hobbies, account_type, artist_genre, last_active_at';
const PROFILE_PAGE = PUBLIC_PROFILE + ', cover_url, cover_kind, cover_lat, cover_lng, cover_place, age, occupation, education, '
  + 'speaks_language, learning_language, learning_level, learning_visible, host_role, host_verified_at, guide_langs, guide_areas, guide_since, guide_about, '
  + 'community_xp, community_events, visited_countries, travel_love, created_at';

/* the database not set up for the new way yet: a column or a function it does not have */
const notYet = (e) => !!e && (/^(42703|PGRST202|PGRST204|42883)$/.test(String(e.code || '')) || /does not exist|could not find/i.test(String(e.message || '')));

async function myId() {
  try { const { data } = await supabase.auth.getSession(); return (data && data.session && data.session.user && data.session.user.id) || null; } catch (e) { return null; }
}

export async function getProfile(userId) {
  // your own full row — only ever yours — from the server
  if (userId && userId === (await myId())) {
    const { data, error } = await supabase.rpc('my_profile');
    if (!error && data) return data;
    if (error && !notYet(error)) throw error;
  }
  let { data, error } = await supabase.from('profiles').select(PROFILE_PAGE).eq('id', userId).single();
  if (error && notYet(error)) ({ data, error } = await supabase.from('profiles').select('*').eq('id', userId).single());
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
  /* guides and hosts have their own tab, with their documents */
  return (data || []).filter((r) => r.role !== 'guide' && r.role !== 'host');
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
    // no "select" back: the row is read again the one way that may read all of it
    const { error } = await supabase
      .from('profiles')
      .update(attempt)
      .eq('id', userId);
    if (!error) return getProfile(userId);
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

/* ── organisations waiting for the owner's yes (owner only; the
   database refuses anybody else — venues_pending / venue_decide) ── */
export async function fetchPendingVenues() {
  const { data, error } = await supabase.rpc('venues_pending');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
export async function decideVenue(id, approve) {
  const { data, error } = await supabase.rpc('venue_decide', { p_id: id, p_approve: !!approve });
  if (error) throw error;
  return data;
}

/* where the phone is, so the morning and night lines (RUN_ME.sql, "A
   GOOD WORD, MORNING AND NIGHT") arrive at 8 and 9 there */
export function saveMyTz() {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (z) supabase.rpc('set_my_tz', { p_tz: z }).then(() => {}, () => {});
  } catch (e) { /* an old browser: Cairo time it is */ }
}
