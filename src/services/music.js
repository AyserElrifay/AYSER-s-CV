import { supabase } from '../lib/supabase';
import { uploadMediaSmart } from '../lib/storage';

/* Indie Music Hub — original tracks discovered by how they SOUND
   (mood, BPM, instruments), never by artist name. */

export async function fetchTracks({ mood, bpmMin, bpmMax, instrument } = {}) {
  let q = supabase.from('tracks').select('*, uploader:profiles!tracks_uploader_id_fkey(name, handle)').order('uses_count', { ascending: false }).limit(60);
  if (mood) q = q.eq('mood', mood);
  if (bpmMin != null) q = q.gte('bpm', bpmMin);
  if (bpmMax != null) q = q.lte('bpm', bpmMax);
  if (instrument) q = q.contains('instruments', [instrument]);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function uploadTrack(userId, fileUri, ext, contentType, meta) {
  const audioUrl = await uploadMediaSmart(userId, fileUri, ext, contentType);
  const { data, error } = await supabase
    .from('tracks')
    .insert({
      uploader_id: userId,
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
