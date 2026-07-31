import { supabase } from '../lib/supabase';

/* ── PLAYLISTS ──────────────────────────────────────────────────────
   Nothing is downloaded. A track streams from where it already lives,
   and saving one writes a row that says "this playlist contains this
   track" — the same shape every music app uses, and the reason your
   library costs you no storage at all.

   Row-level security keeps a private playlist private: you can read
   your own and anyone's public ones, and you can only add to your own. */

const LIKED = 'Liked Songs';

export async function fetchMyPlaylists(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('playlists')
    .select('id, name, emoji, is_public, created_at, tracks:playlist_tracks(count)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((p) => ({
    ...p,
    count: (p.tracks && p.tracks[0] && p.tracks[0].count) || 0,
  }));
}

export async function createPlaylist(userId, name, emoji = '🎧') {
  const { data, error } = await supabase
    .from('playlists')
    .insert({ owner_id: userId, name: String(name || 'New playlist').slice(0, 60), emoji })
    .select('id, name, emoji, is_public')
    .single();
  if (error) throw error;
  return { ...data, count: 0 };
}

/* Your heart list, made the first time you press the heart — not on
   sign-up, so nobody carries an empty playlist around forever. */
export async function ensureLiked(userId) {
  const { data } = await supabase
    .from('playlists').select('id').eq('owner_id', userId).eq('name', LIKED).limit(1);
  if (data && data[0]) return data[0].id;
  const made = await createPlaylist(userId, LIKED, '💜');
  return made.id;
}

export async function fetchPlaylistTracks(playlistId) {
  const { data, error } = await supabase
    .from('playlist_tracks')
    .select('added_at, track:tracks(*)')
    .eq('playlist_id', playlistId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => r.track).filter(Boolean);
}

export async function addToPlaylist(playlistId, trackId) {
  const { error } = await supabase.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: trackId });
  if (error && error.code !== '23505') throw error; // already there is not a failure
}

export async function removeFromPlaylist(playlistId, trackId) {
  const { error } = await supabase
    .from('playlist_tracks').delete().eq('playlist_id', playlistId).eq('track_id', trackId);
  if (error) throw error;
}

export async function deletePlaylist(playlistId) {
  const { error } = await supabase.from('playlists').delete().eq('id', playlistId);
  if (error) throw error;
}

/* Which of these tracks you've already saved anywhere — so the heart is
   filled the moment the list draws, not after a second round trip. */
export async function fetchSavedTrackIds(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('playlist_tracks')
    .select('track_id, playlists!inner(owner_id)')
    .eq('playlists.owner_id', userId);
  if (error) return new Set();
  return new Set((data || []).map((r) => r.track_id));
}
