import { supabase, SUPABASE_READY } from './supabase';
import { SUPABASE_URL } from './supabaseConfig';

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

/* ─── ONE PUT, WATCHED ────────────────────────────────────────────────
   `supabase.storage.upload()` is a fetch, and a fetch has no progress
   and no timeout. On a phone, on 4G, a 16MB video takes a while — and
   if the connection stalls halfway the promise simply never settles.
   No error, no rejection, nothing for the `finally` to run: the button
   says "Uploading…" and keeps saying it forever. That is what Ayser was
   looking at, and it is worse than an error, because an error at least
   tells you to try again.

   XMLHttpRequest is the older API and the only one in a browser that
   reports upload progress. So: the same PUT, done by hand, with three
   things fetch cannot give us —

     • how far it has actually got, in bytes
     • a stall timer, which fires only when nothing has moved for a
       while (never a fixed deadline: a big file on a slow line is
       slow, not broken, and killing it at 60s would punish exactly
       the people this is meant to help)
     • a way to abort

   Everything else — retries, the size guard, the public URL — is as it
   was. */
const STALL_MS = 25000;   // nothing moved for this long → it's stuck, not slow

function putWithProgress({ url, token, body, contentType, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastMoved = Date.now();
    let sent = 0;

    const stall = setInterval(() => {
      if (Date.now() - lastMoved > STALL_MS) {
        clearInterval(stall);
        try { xhr.abort(); } catch (e) {}
        const pct = body.size ? Math.round((sent / body.size) * 100) : 0;
        reject(new Error('The upload stopped moving at ' + pct + '% — your connection dropped out. Try again when you have a steadier signal.'));
      }
    }, 2000);

    const done = () => clearInterval(stall);

    if (signal) {
      signal.addEventListener('abort', () => { done(); try { xhr.abort(); } catch (e) {} reject(new Error('Upload cancelled')); });
    }

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      lastMoved = Date.now();
      sent = e.loaded;
      if (onProgress) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
      let msg = 'HTTP ' + xhr.status;
      try { const j = JSON.parse(xhr.responseText); msg = j.message || j.error || msg; } catch (e) {}
      reject(new Error(msg));
    };
    xhr.onerror = () => { done(); reject(new Error('The upload didn\'t reach the server')); };
    xhr.onabort = () => { done(); };

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('x-upsert', 'false');
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(body);
  });
}

async function uploadToSupabase(userId, uri, ext, contentType, opts) {
  const { onProgress, signal } = opts || {};
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
  const canWatch = typeof XMLHttpRequest !== 'undefined';
  let token = null;
  if (canWatch) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data && data.session && data.session.access_token;
    } catch (e) { token = null; }
  }

  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const path = userId + '/' + Date.now() + '-' + attempt + '.' + ext;
    try {
      if (canWatch && token) {
        await putWithProgress({
          url: SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/media/' + path,
          token, body, contentType, onProgress, signal,
        });
      } else {
        // no XHR (native) or no session — the plain path, as before
        const { error } = await supabase.storage.from('media').upload(path, body, { contentType, upsert: false });
        if (error) throw error;
      }
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      last = e;
      const msg = String((e && e.message) || '');
      if (/cancelled/i.test(msg)) throw e;                  // they meant it
      // a rejection is final; only a dropped connection is worth retrying
      if (!/load failed|failed to fetch|network|timeout|aborted|stopped moving|didn't reach/i.test(msg)) break;
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
  const detail = (last && (last.message || last.error)) || 'unknown';
  const e = new Error(detail + ' (' + Math.round(body.size / 1048576 * 10) / 10 + 'MB)');
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
export async function uploadMediaSmart(userId, uri, ext, contentType, opts) {
  if (!SUPABASE_READY) return uri; // demo mode keeps the local blob url
  if (R2_READY) {
    try { return await uploadToR2(userId, uri, ext, contentType); }
    catch (e) { /* fall through to Supabase */ }
  }
  // `opts` carries onProgress and an abort signal — see uploadToSupabase
  return uploadToSupabase(userId, uri, ext, contentType, opts);
}
