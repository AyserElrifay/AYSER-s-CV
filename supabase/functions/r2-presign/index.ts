// ═══════════════════════════════════════════════════════════════════
//  r2-presign — the only thing that holds the Cloudflare R2 keys
//
//  The app never sees an R2 key. It asks this function, with its own
//  session, for a short-lived address to PUT one file to; the file
//  goes straight from the phone to R2 (no egress fees, nothing passes
//  through Supabase), and only the resulting address is saved in the
//  database.
//
//  Two buckets:
//    R2_BUCKET            media people keep (posts, plans) — public via
//                         R2_PUBLIC_URL (a custom domain on the bucket)
//    R2_EPHEMERAL_BUCKET  view-once messages — PRIVATE, never public,
//                         and a lifecycle rule on the bucket deletes
//                         every object after 1 day. No backups.
//
//  POST (JWT on)
//    { key, contentType, size? }                 → { uploadUrl, publicUrl }
//        key must start with the caller's own user id.
//    { purpose: 'ephemeral', contentType, size } → { uploadUrl, key }
//        key is chosen here: <uid>/<random>.<ext> in the ephemeral bucket.
//    { purpose: 'view', id }                     → { url, kind }
//        the recipient of a view-once message, once: marks it opened in
//        the database (view_once_open in RUN_ME.sql) and returns a GET
//        address that lives 60 seconds.
//    { purpose: 'burn', id }                     → { ok }
//        after the viewer closes it: the object is deleted from R2 now,
//        not in a day.
//
//  Secrets (Supabase → Edge Functions → Secrets, never in the app):
//    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//    R2_BUCKET, R2_EPHEMERAL_BUCKET, R2_PUBLIC_URL
//
//  Deploy:  supabase functions deploy r2-presign
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://therealmoments.com';
const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Vary': 'Origin',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ACCOUNT = Deno.env.get('R2_ACCOUNT_ID') || '';
const AK = Deno.env.get('R2_ACCESS_KEY_ID') || '';
const SK = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
const BUCKET = Deno.env.get('R2_BUCKET') || '';
const EPHEMERAL = Deno.env.get('R2_EPHEMERAL_BUCKET') || '';
const PUBLIC_URL = (Deno.env.get('R2_PUBLIC_URL') || '').replace(/\/$/, '');
const HOST = ACCOUNT + '.r2.cloudflarestorage.com';

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/webm': 'webm',
};
const MAX_BYTES = 200 * 1024 * 1024;
const UUID = /^[0-9a-f-]{36}$/i;

// ── AWS Signature V4, query-string form (what R2 speaks) ─────────────
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const hmac = async (key: ArrayBuffer | Uint8Array, s: string) => {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(s));
};
const uri = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function presign(method: 'PUT' | 'GET' | 'DELETE', bucket: string, key: string, expires: number) {
  const now = new Date();
  const amz = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amz.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const path = '/' + bucket + '/' + key.split('/').map(uri).join('/');
  const q: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${AK}/${scope}`,
    'X-Amz-Date': amz,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const qs = Object.keys(q).sort().map((k) => uri(k) + '=' + uri(q[k])).join('&');
  const canonical = [method, path, qs, `host:${HOST}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, await sha256(canonical)].join('\n');
  let k: ArrayBuffer = await hmac(enc.encode('AWS4' + SK), day);
  k = await hmac(k, 'auto'); k = await hmac(k, 's3'); k = await hmac(k, 'aws4_request');
  const sig = hex(await hmac(k, toSign));
  return `https://${HOST}${path}?${qs}&X-Amz-Signature=${sig}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!ACCOUNT || !AK || !SK || !BUCKET) return json(503, { error: 'not_configured' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await db.auth.getUser(jwt);
  const me = who && who.user && who.user.id;
  if (!me) return json(401, { error: 'signed_out' });
  /* the same client, acting as the caller — so the database's own rules
     (view_once_open) decide who may open what, not this function */
  const asMe = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false }, global: { headers: { Authorization: 'Bearer ' + jwt } },
  });

  let b: any = {};
  try { b = await req.json(); } catch { return json(400, { error: 'body' }); }
  const type = String(b.contentType || '');
  const size = Number(b.size || 0);

  if (b.purpose === 'view' || b.purpose === 'burn') {
    if (!EPHEMERAL) return json(503, { error: 'not_configured' });
    const id = String(b.id || '');
    if (!UUID.test(id)) return json(400, { error: 'id' });
    if (b.purpose === 'view') {
      const { data, error } = await asMe.rpc('view_once_open', { p_id: id });
      if (error || !data || !data.ok) return json(403, { error: (data && data.reason) || 'gone' });
      return json(200, { url: await presign('GET', EPHEMERAL, data.object_key, 60), kind: data.kind });
    }
    const { data, error } = await asMe.rpc('view_once_burn', { p_id: id });
    if (error || !data || !data.ok) return json(200, { ok: true });   // already gone is fine
    if (data.object_key) await fetch(await presign('DELETE', EPHEMERAL, data.object_key, 60), { method: 'DELETE' }).catch(() => {});
    return json(200, { ok: true });
  }

  if (!TYPES[type]) return json(400, { error: 'type' });
  if (size && size > MAX_BYTES) return json(413, { error: 'too_big' });

  if (b.purpose === 'ephemeral') {
    if (!EPHEMERAL) return json(503, { error: 'not_configured' });
    const key = me + '/' + crypto.randomUUID() + '.' + TYPES[type];
    return json(200, { uploadUrl: await presign('PUT', EPHEMERAL, key, 600), key });
  }

  const key = String(b.key || '');
  if (!key.startsWith(me + '/') || key.includes('..') || key.length > 300) return json(403, { error: 'key' });
  return json(200, { uploadUrl: await presign('PUT', BUCKET, key, 600), publicUrl: PUBLIC_URL ? PUBLIC_URL + '/' + key : null });
});
