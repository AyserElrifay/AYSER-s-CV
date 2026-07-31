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
/* 48 MB, not 60: Supabase Storage refuses anything over 50 MB in a
   single file on the current plan, so a 60 MB "cap" only meant the
   upload was rejected by the server after the whole thing had been
   sent. Better to say no early, and say the real number. */
export const MAX_UPLOAD_BYTES = 48 * 1024 * 1024;
export const VIDEO_QUALITIES = { hd: 720, sd: 480 }; // we never store above 720p

/* Safari cannot always fetch() its own blob: URL — it throws
   "Load failed", which is why recording a reel on an iPhone ended with
   "the upload didn't reach the server" even on a perfect connection.
   So whenever we still hold the actual Blob, we use it directly and
   never ask the browser to go and fetch it back. */
async function asBlob(uriOrBlob) {
  if (uriOrBlob && typeof uriOrBlob !== 'string') return uriOrBlob;  // already a Blob/File
  const res = await fetch(uriOrBlob);
  if (!res.ok) throw new Error('Could not read the file (' + res.status + ')');
  return res.blob();
}

async function uploadToR2(userId, uri, ext, contentType) {
  const key = userId + '/' + Date.now() + '.' + ext;
  // Ask the server for a presigned PUT url (secret keys stay server-side).
  const { data, error } = await supabase.functions.invoke('r2-presign', {
    body: { key, contentType },
  });
  if (error || !data || !data.uploadUrl) throw new Error('r2-presign unavailable');

  const body = await asBlob(uri);
  if (body.size > MAX_UPLOAD_BYTES) throw new Error('File too large (max 60MB)');

  const put = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!put.ok) throw new Error('R2 upload failed');
  return (data.publicUrl || (R2_PUBLIC_URL.replace(/\/$/, '') + '/' + key));
}

async function uploadToSupabase(userId, uri, ext, contentType) {
  // Blob, not ArrayBuffer — half the memory footprint, which is what
  // made Safari throw 'Load failed' on big videos.
  const body = await asBlob(uri);
  if (body.size > MAX_UPLOAD_BYTES) {
    throw new Error('That file is ' + Math.round(body.size / 1048576) + 'MB — the server accepts up to 48MB in one file.');
  }
  if (!body.size) throw new Error('The recording came out empty (0 bytes)');

  /* Safari drops a long upload with a bare "Load failed" often enough
     that one attempt is not a fair test — a dropped connection mid-way
     looks identical to a rejected file. Three tries, a fresh path each
     time so a half-written object never collides, and the real reason
     kept if they all fail. */
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const path = userId + '/' + Date.now() + '-' + attempt + '.' + ext;
    const { error } = await supabase.storage.from('media')
      .upload(path, body, { contentType, upsert: false });
    if (!error) {
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      return data.publicUrl;
    }
    last = error;
    const msg = String((error && error.message) || '');
    // a rejection is final; only a dropped connection is worth retrying
    if (!/load failed|failed to fetch|network|timeout|aborted/i.test(msg)) break;
    await new Promise((r) => setTimeout(r, 1200 * attempt));
  }
  const detail = (last && (last.message || last.error)) || 'unknown';
  const e = new Error('Upload failed after 3 tries — ' + detail +
    ' (' + Math.round(body.size / 1048576 * 10) / 10 + 'MB)');
  e.raw = last;
  throw e;
}

/* ── Client-side image compression (web) ──────────────────────────
   Feed images never need more than ~1600px on the long side — beyond
   that is invisible on a phone but 5-10x the bytes. Re-encoding at
   JPEG q0.85 keeps the picture visually identical while slashing
   storage + bandwidth. Returns the original uri on any failure or on
   native (no canvas). */
export function compressImage(uri, maxSide = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.document) return resolve(uri);
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          const scale = Math.min(1, maxSide / Math.max(w, h));
          const canvas = window.document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) { resolve(uri); }
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    } catch (e) { resolve(uri); }
  });
}

/* One entry point for every upload. Tries R2, falls back to Supabase.
   `uri` may be a string OR the Blob itself — pass the Blob when you
   have it and Safari's blob-fetch bug never comes up. */
export async function uploadMediaSmart(userId, uri, ext, contentType) {
  if (!SUPABASE_READY) return uri; // demo mode keeps the local blob url
  if (R2_READY) {
    try { return await uploadToR2(userId, uri, ext, contentType); }
    catch (e) { /* fall through to Supabase */ }
  }
  return uploadToSupabase(userId, uri, ext, contentType);
}
