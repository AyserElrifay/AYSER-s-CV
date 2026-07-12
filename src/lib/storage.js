import { supabase, SUPABASE_READY } from './supabase';

/* ── MEDIA STORAGE · Cloudflare R2 first, Supabase Storage fallback ──
   R2 has ZERO egress fees, so it's the right home for video at scale.
   The upload is presigned by a server (a Supabase Edge Function
   'r2-presign' or a Cloudflare Worker) that holds the R2 secret keys —
   the app only ever gets a short-lived PUT url. If R2 isn't configured
   yet, we fall back to Supabase Storage so uploads always work.

   Configure by setting EXPO_PUBLIC_R2_PUBLIC_URL (the bucket's public
   base, e.g. https://media.moments.app) and deploying the presign fn. */

export const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL || '';
export const R2_READY = !!R2_PUBLIC_URL;

// Quality guardrails — keep storage + bandwidth costs sane.
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024; // 60 MB hard cap
export const VIDEO_QUALITIES = { hd: 720, sd: 480 }; // we never store above 720p

async function uploadToR2(userId, uri, ext, contentType) {
  const key = userId + '/' + Date.now() + '.' + ext;
  // Ask the server for a presigned PUT url (secret keys stay server-side).
  const { data, error } = await supabase.functions.invoke('r2-presign', {
    body: { key, contentType },
  });
  if (error || !data || !data.uploadUrl) throw new Error('r2-presign unavailable');

  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD_BYTES) throw new Error('File too large (max 60MB)');

  const put = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!put.ok) throw new Error('R2 upload failed');
  return (data.publicUrl || (R2_PUBLIC_URL.replace(/\/$/, '') + '/' + key));
}

async function uploadToSupabase(userId, uri, ext, contentType) {
  const path = userId + '/' + Date.now() + '.' + ext;
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_UPLOAD_BYTES) throw new Error('File too large (max 60MB)');
  const { error } = await supabase.storage.from('media').upload(path, body, { contentType });
  if (error) throw error;
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

/* One entry point for every upload. Tries R2, falls back to Supabase. */
export async function uploadMediaSmart(userId, uri, ext, contentType) {
  if (!SUPABASE_READY) return uri; // demo mode keeps the local blob url
  if (R2_READY) {
    try { return await uploadToR2(userId, uri, ext, contentType); }
    catch (e) { /* fall through to Supabase */ }
  }
  return uploadToSupabase(userId, uri, ext, contentType);
}
