// ═══════════════════════════════════════════════════════════════════
//  bardi-listen — a voice note in, its words out (Whisper)
//
//  For the brain dump: somebody says their day instead of typing it.
//  The audio goes to Groq's hosted Whisper, the text comes back, and
//  NOTHING is kept — not the audio, not the text, not a log line with
//  either. The phone does the rest (src/lib/brainDump.js).
//
//  POST  multipart/form-data  file=<audio>  [language=ar|en|…]
//        → { text }
//  Needs the Supabase secret GROQ_API_KEY (already used by bardi-chat).
//  Without it: 503 { error: 'not_configured' }, and the app says voice
//  is not on yet and offers typing.
//
//  Deploy:  supabase functions deploy bardi-listen
//  (JWT on: only signed-in people can send audio.)
// ═══════════════════════════════════════════════════════════════════
const KEY = Deno.env.get('GROQ_API_KEY') || '';
const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://therealmoments.com';
const MAX_BYTES = 8 * 1024 * 1024;          // ~4 minutes of speech; a brain dump is a minute

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Vary': 'Origin',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/* a real, signed-in Moments account — the public app key alone is not
   one — and at most 10 voice notes a minute each, 100 a day */
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
async function whoIs(req: Request): Promise<string | null> {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt || !SUPABASE_URL) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { authorization: 'Bearer ' + jwt, apikey: ANON } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && typeof u.id === 'string' ? u.id : null;
  } catch { return null; }
}
const seen = new Map<string, { m: number; mc: number; d: number; dc: number }>();
function tooMuch(uid: string) {
  const now = Date.now(); const day = Math.floor(now / 86_400_000);
  let s = seen.get(uid);
  if (!s) { s = { m: now, mc: 0, d: day, dc: 0 }; seen.set(uid, s); }
  if (now - s.m > 60_000) { s.m = now; s.mc = 0; }
  if (s.d !== day) { s.d = day; s.dc = 0; }
  s.mc++; s.dc++;
  if (seen.size > 5000) seen.clear();
  return s.mc > 10 || s.dc > 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const uid = await whoIs(req);
  if (!uid) return json(401, { error: 'signed_out' });
  if (tooMuch(uid)) return json(429, { error: 'slow_down' });
  if (!KEY) return json(503, { error: 'not_configured' });

  let form: FormData;
  try { form = await req.formData(); } catch { return json(400, { error: 'form' }); }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return json(400, { error: 'no_audio' });
  if (file.size > MAX_BYTES) return json(413, { error: 'too_long' });
  const lang = String(form.get('language') || '').slice(0, 2);

  const out = new FormData();
  out.append('file', file, file.name || 'note.webm');
  out.append('model', 'whisper-large-v3-turbo');
  out.append('response_format', 'json');
  if (/^[a-z]{2}$/.test(lang)) out.append('language', lang);

  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + KEY }, body: out,
  });
  if (!r.ok) return json(502, { error: 'busy' });
  const j = await r.json().catch(() => ({}));
  return json(200, { text: String((j as any).text || '').trim().slice(0, 2000) });
});
