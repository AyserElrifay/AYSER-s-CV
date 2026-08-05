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

/* ── HOW BIG A FILE CAN BE ────────────────────────────────────────────
   The old cap was 48 MB, and it was never a limit on storage — it was
   the limit on ONE request. Anything larger had to be refused, which
   meant an ordinary iPhone video was refused, because an ordinary
   iPhone video is over 100 MB.

   The obvious fix is to compress it, and the obvious fix does not work
   here: re-encoding in a browser goes through canvas.captureStream(),
   and on WebKit — every browser on an iPhone — that produces a file
   where every frame is black. Measured earlier in this project, on a
   real recording. A 120 MB video turned into an 8 MB black one is
   worse than a refusal.

   So the file is sent in pieces instead. Nothing is re-encoded, nothing
   loses quality, and it works on an iPhone because it is just a series
   of ordinary requests. Supabase speaks TUS for exactly this, and
   requires chunks of exactly 6 MB.

   200 MB is the ceiling now: enough for a couple of minutes of phone
   video, and still a number rather than a shrug. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/* Above this, send it in pieces. Below it, one request is quicker. */
const RESUMABLE_ABOVE = 40 * 1024 * 1024;
const TUS_CHUNK = 6 * 1024 * 1024;   // Supabase requires exactly this
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

/* ─── SENDING IT IN PIECES (TUS) ──────────────────────────────────────
   Three steps, and nothing clever:

     POST  /storage/v1/upload/resumable   → the server hands back a URL
     PATCH that URL with 6 MB and an offset, over and over
     stop when the offset reaches the end

   Every chunk gets its own stall timer, so a connection that dies
   halfway through a 120 MB video is caught in seconds rather than
   hanging for ever — the same rule as the single-request path.

   `sent` counts bytes already accepted by the server, so progress is
   real: it is what got through, not what we handed to the socket. */
function tusChunk({ url, token, blob, offset, contentType, onBytes, signal }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let moved = Date.now();
    const stall = setInterval(() => {
      if (Date.now() - moved > STALL_MS) {
        clearInterval(stall);
        try { xhr.abort(); } catch (e) {}
        reject(new Error('The upload stopped moving — your connection dropped out. It will carry on from here when you try again.'));
      }
    }, 2000);
    const done = () => clearInterval(stall);

    if (signal) signal.addEventListener('abort', () => { done(); try { xhr.abort(); } catch (e) {} reject(new Error('Upload cancelled')); });

    xhr.upload.onprogress = (e) => { moved = Date.now(); if (onBytes && e.lengthComputable) onBytes(e.loaded); };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) {
        const next = parseInt(xhr.getResponseHeader('Upload-Offset') || '0', 10);
        resolve(isFinite(next) ? next : offset + blob.size);
        return;
      }
      reject(new Error('HTTP ' + xhr.status + ' sending part of the file'));
    };
    xhr.onerror = () => { done(); reject(new Error('A piece of the upload didn\'t reach the server')); };
    xhr.onabort = () => done();

    xhr.open('PATCH', url, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Tus-Resumable', '1.0.0');
    xhr.setRequestHeader('Upload-Offset', String(offset));
    xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');
    xhr.send(blob);
  });
}

async function uploadResumable({ base, token, bucket, path, body, contentType, onProgress, signal }) {
  const meta = [
    'bucketName ' + btoa(bucket),
    'objectName ' + btoa(path),
    'contentType ' + btoa(contentType || 'application/octet-stream'),
  ].join(',');

  const create = await fetch(base + '/storage/v1/upload/resumable', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(body.size),
      'Upload-Metadata': meta,
    },
  });
  if (!create.ok) throw new Error('Could not start the upload (HTTP ' + create.status + ')');
  const location = create.headers.get('Location');
  if (!location) throw new Error('Could not start the upload — the server gave no address to send to');
  const url = /^https?:/i.test(location) ? location : base + location;

  let offset = 0;
  while (offset < body.size) {
    const end = Math.min(offset + TUS_CHUNK, body.size);
    const at = offset;
    offset = await tusChunk({
      url, token, blob: body.slice(at, end), offset: at, contentType, signal,
      onBytes: (n) => { if (onProgress) onProgress(at + n, body.size); },
    });
    if (onProgress) onProgress(offset, body.size);
  }
}

async function uploadToSupabase(userId, uri, ext, contentType, opts) {
  const { onProgress, signal } = opts || {};
  // Blob, not ArrayBuffer — half the memory footprint, which is what
  // made Safari throw 'Load failed' on big videos.
  const body = await asBlob(uri);
  if (body.size > MAX_UPLOAD_BYTES) {
    throw new Error('That file is ' + Math.round(body.size / 1048576) + 'MB — the limit is '
      + Math.round(MAX_UPLOAD_BYTES / 1048576) + 'MB. Trim it and try again.');
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
      if (canWatch && token && body.size > RESUMABLE_ABOVE) {
        // too big for one request — send it in 6MB pieces
        await uploadResumable({
          base: SUPABASE_URL.replace(/\/$/, ''), token, bucket: 'media', path,
          body, contentType, onProgress, signal,
        });
      } else if (canWatch && token) {
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
