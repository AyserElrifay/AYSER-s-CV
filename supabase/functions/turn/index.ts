// ═══════════════════════════════════════════════════════════════════
//  turn — a relay address for one call, so calls connect on mobile data
//
//  Two phones on mobile data (or a strict wifi) can't reach each other
//  directly; the call sits on "Connecting…" forever. A TURN relay
//  carries the call between them. This asks Cloudflare's TURN service
//  for credentials that live one day, for a signed-in person only, and
//  hands back the ICE servers. The Cloudflare key never reaches the app.
//
//  POST (JWT on) → { iceServers: [...] }
//
//  Secrets (set by .github/workflows/setup-backend.yml from repo secrets):
//    CF_TURN_KEY_ID, CF_TURN_API_TOKEN, ALLOWED_ORIGIN
//
//  Deploy:  supabase functions deploy turn
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

const KEY_ID = Deno.env.get('CF_TURN_KEY_ID') || '';
const TOKEN = Deno.env.get('CF_TURN_API_TOKEN') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!KEY_ID || !TOKEN) return json(503, { error: 'not_configured' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await db.auth.getUser(jwt);
  if (!who || !who.user) return json(401, { error: 'signed_out' });

  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${KEY_ID}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 86400 }),
  }).catch(() => null);
  if (!r || !r.ok) return json(502, { error: 'turn' });
  const body = await r.json().catch(() => ({}));
  const list = Array.isArray(body.iceServers) ? body.iceServers : body.iceServers ? [body.iceServers] : [];
  if (!list.length) return json(502, { error: 'turn' });
  return json(200, { iceServers: list });
});
