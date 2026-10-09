// ═══════════════════════════════════════════════════════════════════
//  push — Moments on the phone, even with the app closed (Web Push)
//
//  GET   → { publicKey }  the VAPID public key the browser subscribes
//          with. Public by design; the private half never leaves here.
//  POST  ← the database, from the push_on_notification trigger, with
//          { id } of a notification and the x-push-hook header. The
//          hook is a random value the database made for itself
//          (app_secrets); it is checked with push_hook_ok() rather than
//          kept in two places.
//
//  What goes to the phone is deliberately thin: the kind, the other
//  person's first name, and — only for a plan or a Bardi match — the
//  plan's own title. Never a message's words or a comment's text: a
//  lock screen is read by whoever is holding the phone. The service
//  worker writes the sentence, in the reader's language.
//
//  Secrets (set by .github/workflows/setup-backend.yml, never by hand):
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, ALLOWED_ORIGIN
//  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
//  Deploy:  supabase functions deploy push --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'https://ayserelrifay.github.io/AYSER-s-CV/';
const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://ayserelrifay.github.io';

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Vary': 'Origin',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// the plan's own title rides along; nothing a person wrote to somebody does
const TITLED = new Set(['plan_soon', 'bardi_match', 'green_invite']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method === 'GET') {
    if (!PUBLIC) return json(503, { error: 'not_configured' });
    return json(200, { publicKey: PUBLIC });
  }
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!PUBLIC || !PRIVATE) return json(503, { error: 'not_configured' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const hook = req.headers.get('x-push-hook') || '';
  const { data: ok } = await db.rpc('push_hook_ok', { p: hook });
  if (ok !== true) return json(401, { error: 'hook' });

  let id = '';
  try { id = String((await req.json()).id || ''); } catch { /* fall through */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: 'id' });

  const { data: n } = await db.from('notifications')
    .select('id, user_id, kind, body, actor:profiles!notifications_actor_id_fkey(name)')
    .eq('id', id).maybeSingle();
  if (!n) return json(404, { error: 'gone' });

  const { data: subs } = await db.from('push_subscriptions').select('endpoint, p256dh, auth, lang').eq('user_id', n.user_id);
  if (!subs || !subs.length) return json(200, { sent: 0 });

  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  const actor = String((n as any).actor?.name || '').split(' ')[0].slice(0, 40);
  let title = '';
  if (TITLED.has(n.kind) && n.body) {
    const parts = String(n.body).split('|');
    title = (parts.length > 1 ? parts.slice(1).join('|') : n.kind === 'green_invite' ? String(n.body) : '').slice(0, 80);
  }

  let sent = 0;
  for (const s of subs) {
    const payload = JSON.stringify({ id: n.id, kind: n.kind, actor, title, lang: s.lang || 'en', body: n.kind === 'bardi_match' ? n.body : '' });
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: n.kind === 'plan_soon' ? 3600 : 6 * 3600, urgency: n.kind === 'message' || n.kind === 'call' || n.kind === 'plan_soon' ? 'high' : 'normal' },
      );
      sent++;
    } catch (e) {
      const code = (e as any)?.statusCode;
      // the phone unsubscribed or the browser forgot it: let it go
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }
  return json(200, { sent });
});
