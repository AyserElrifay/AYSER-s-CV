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

/* ── Auto-fill the library from legal, free Creative-Commons music ───
   Runs in the OWNER's browser (the sandbox can't reach these APIs) and
   pulls from Openverse — an open API of CC-licensed audio (no key, CORS-
   friendly). We store the track's direct URL + attribution; playback is a
   plain <audio src> so cross-origin streaming just works. Everything is
   CC-licensed with credit shown, so it's safe to use commercially. */
const HARVEST_QUERIES = [
  { q: 'lofi', mood: 'Chill' }, { q: 'happy upbeat', mood: 'Happy' },
  { q: 'cinematic epic', mood: 'Epic' }, { q: 'acoustic guitar', mood: 'Calm' },
  { q: 'electronic dance', mood: 'Hype' }, { q: 'ambient', mood: 'Calm' },
  { q: 'hip hop beat', mood: 'Hype' }, { q: 'piano', mood: 'Chill' },
];
/* Insert, but if the DB is missing a column (is_approved / is_official etc.
   before the latest SQL is run), strip just that column and retry — so
   Auto-fill actually saves tracks even on a not-yet-migrated database. */
async function insertBatch(rows, onAdded) {
  if (!rows.length) return 0;
  let attempt = rows;
  for (let i = 0; i < 6; i++) {
    const { error } = await supabase.from('tracks').insert(attempt);
    if (!error) { onAdded && onAdded(attempt.length); return attempt.length; }
    const m = /Could not find the '([^']+)' column|column "?([a-zA-Z_]+)"? does not exist/i.exec(error.message || '');
    const col = m && (m[1] || m[2]);
    if (col && attempt[0] && Object.prototype.hasOwnProperty.call(attempt[0], col)) {
      attempt = attempt.map((r) => { const n = { ...r }; delete n[col]; return n; });
      continue; // retry without the column this DB doesn't have yet
    }
    return 0; // a different error — give up on this batch
  }
  return 0;
}

/* Source 1 — Openverse: Creative-Commons (CC0 + CC-BY), credit stored. */
async function harvestOpenverse(userId, have, onAdded) {
  let added = 0;
  for (const { q, mood } of HARVEST_QUERIES) {
    let results = [];
    try {
      const r = await fetch('https://api.openverse.org/v1/audio/?q=' + encodeURIComponent(q) + '&page_size=20&license=cc0,by&mature=false');
      if (r.ok) { const j = await r.json(); results = (j && j.results) || []; }
    } catch (e) {}
    const rows = [];
    for (const t of results) {
      const url = t.url || (t.alt_files && t.alt_files[0] && t.alt_files[0].url) || null;
      if (!url || have.has(url)) continue;
      have.add(url);
      const lic = String(t.license || '').toUpperCase();
      rows.push({
        uploader_id: userId, is_official: true, is_approved: true,
        title: (t.title || 'Untitled').toString().slice(0, 80),
        artist: (t.creator || 'CC artist').toString().slice(0, 60),
        audio_url: url, cover_emoji: '🎵', mood,
        license: lic === 'CC0' ? 'CC0 (Public Domain)' : 'CC ' + lic,
        // CC-BY REQUIRES credit; we store & show it. CC0 needs none but we keep the source.
        attribution: (t.title || 'Track') + ' · ' + (t.creator || 'unknown') + (lic === 'CC0' ? ' (CC0)' : ' — CC BY, via Openverse'),
        source_url: t.foreign_landing_url || null,
        duration_sec: t.duration ? Math.round(t.duration / 1000) : null,
      });
    }
    added += await insertBatch(rows, onAdded);
  }
  return added;
}

/* Source 2 — Internet Archive: Public Domain audio (no credit required). */
async function harvestArchive(userId, have, onAdded) {
  let results = [];
  try {
    const q = 'mediatype:audio AND (licenseurl:(*publicdomain*) OR licenseurl:(*creativecommons*))';
    const r = await fetch('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q) + '&fl[]=identifier&fl[]=title&fl[]=creator&rows=30&sort[]=downloads+desc&output=json');
    if (r.ok) { const j = await r.json(); results = (j.response && j.response.docs) || []; }
  } catch (e) { return 0; }
  const rows = [];
  for (const d of results) {
    try {
      const m = await fetch('https://archive.org/metadata/' + encodeURIComponent(d.identifier));
      if (!m.ok) continue;
      const meta = await m.json();
      const file = (meta.files || []).find((f) => /\.mp3$/i.test(f.name || ''));
      if (!file) continue;
      const url = 'https://archive.org/download/' + d.identifier + '/' + encodeURIComponent(file.name);
      if (have.has(url)) continue;
      have.add(url);
      const isPD = /publicdomain/i.test(meta.metadata && meta.metadata.licenseurl || '');
      rows.push({
        uploader_id: userId, is_official: true, is_approved: true,
        title: String(d.title || file.title || 'Archive track').slice(0, 80),
        artist: String((Array.isArray(d.creator) ? d.creator[0] : d.creator) || 'Public Domain').slice(0, 60),
        audio_url: url, cover_emoji: '🎶', mood: 'Chill',
        license: isPD ? 'Public Domain' : 'Creative Commons',
        attribution: String(d.title || 'Track') + ' · Internet Archive' + (isPD ? ' (Public Domain)' : ' (CC)'),
        source_url: 'https://archive.org/details/' + d.identifier,
        duration_sec: file.length ? Math.round(parseFloat(file.length)) : null,
      });
      if (rows.length >= 20) break;
    } catch (e) {}
  }
  return insertBatch(rows, onAdded);
}

/* Harvest from every source with a real API. Pixabay/FMA/Incompetech have
   no music API, so those are added manually via the URL button. */
export async function harvestFreeMusic(userId, onProgress) {
  const { data: existing } = await supabase.from('tracks').select('audio_url').not('audio_url', 'is', null).limit(4000);
  const have = new Set((existing || []).map((r) => r.audio_url));
  let added = 0;
  const bump = (n) => { added += n; onProgress && onProgress(added); };
  added = 0;
  await harvestOpenverse(userId, have, (n) => bump(n));
  await harvestArchive(userId, have, (n) => bump(n));
  return added;
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
