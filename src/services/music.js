import { supabase } from '../lib/supabase';
import { uploadMediaSmart } from '../lib/storage';

/* Indie Music Hub — original tracks discovered by how they SOUND
   (mood, BPM, instruments), never by artist name.

   Distribution is owner-approved: a track is only public once the app
   owner approves it (or it's an official/curated track). This is the
   safe library — no copyrighted uploads reach users unvetted. */

// The app owner(s) — the only accounts that can upload & approve music.
export const OWNER_EMAILS = ['ayseryourlifecoach@gmail.com'];
export const isOwner = (user) => !!(user && user.email && OWNER_EMAILS.includes(String(user.email).toLowerCase()));

export async function fetchTracks({ mood, bpmMin, bpmMax, instrument, meId, all } = {}) {
  let q = supabase.from('tracks').select('*, uploader:profiles!tracks_uploader_id_fkey(name, handle)').order('uses_count', { ascending: false }).limit(80);
  if (mood) q = q.eq('mood', mood);
  if (bpmMin != null) q = q.gte('bpm', bpmMin);
  if (bpmMax != null) q = q.lte('bpm', bpmMax);
  if (instrument) q = q.contains('instruments', [instrument]);
  const { data, error } = await q;
  if (error) {
    // is_approved column not added yet → show everything (pre-migration)
    if (/is_approved|column/i.test(error.message || '')) { const r = await q; return r.data || []; }
    throw error;
  }
  const rows = data || [];
  if (all) return rows; // owner moderation view: pending + approved
  // Public view: approved or official only (plus your own, so you see it while pending)
  return rows.filter((t) => t.is_approved || t.is_official || (meId && t.uploader_id === meId));
}

/* Owner moderation — approve or reject a pending track. */
export async function setTrackApproval(trackId, approved) {
  const { error } = await supabase.from('tracks').update({ is_approved: !!approved }).eq('id', trackId);
  if (error) throw error;
  return true;
}

/* Real play/use count — called whenever someone actually attaches this
   track to a story/reel, so producers see genuine usage, not just
   uploads. Security-definer RPC (RUN_ME.sql) since the LISTENER, not
   the uploader, triggers it. */
export async function incrementTrackUse(trackId) {
  if (!trackId) return;
  try { await supabase.rpc('increment_track_use', { p_track_id: trackId }); } catch (e) { /* non-blocking */ }
}

export async function uploadTrack(userId, fileUri, ext, contentType, meta) {
  const audioUrl = await uploadMediaSmart(userId, fileUri, ext, contentType);
  const { data, error } = await supabase
    .from('tracks')
    .insert({
      uploader_id: userId,
      is_approved: !!meta.approved, // owner uploads are auto-approved (safe library)
      title: meta.title,
      audio_url: audioUrl,
      cover_emoji: meta.cover_emoji || '🎵',
      duration_sec: meta.duration_sec || null,
      bpm: meta.bpm || null,
      music_key: meta.music_key || null,
      mood: meta.mood || null,
      timbre: meta.timbre || null,
      instruments: meta.instruments || null,
      genre_shape: meta.genre_shape || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Delete a sound YOU uploaded. RLS restricts this to the uploader, but we
   also scope by uploader_id so a stray call can never touch someone else's
   track. Best-effort removes the audio file from storage too. */
export async function deleteTrack(trackId, userId) {
  const { data: row } = await supabase.from('tracks').select('audio_url').eq('id', trackId).eq('uploader_id', userId).maybeSingle();
  const { error } = await supabase.from('tracks').delete().eq('id', trackId).eq('uploader_id', userId);
  if (error) throw error;
  // free the file (parse the storage key out of the public URL)
  try {
    const m = row && row.audio_url && row.audio_url.match(/\/object\/public\/media\/(.+?)(\?|$)/);
    if (m) await supabase.storage.from('media').remove([decodeURIComponent(m[1])]);
  } catch (e) {}
  return true;
}

/* Just the sounds you uploaded — for a "my sounds" list you can manage. */
export async function fetchMyTracks(userId) {
  const { data, error } = await supabase.from('tracks').select('*').eq('uploader_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
