// ═══════════════════════════════════════════════════════════════════
//  owner-billing — the Studio's two Lemon Squeezy actions (owner only)
//
//  POST { action: 'discount', code }   a % promo code already saved with
//        owner_promo_save is made in Lemon Squeezy too, so the checkout
//        accepts it. Once, on the first payment (100% = a free month).
//  POST { action: 'cancel', user }     the member's subscription stops
//        renewing (Lemon Squeezy keeps it until the paid period ends).
//
//  Refunds are not made from here: money goes back from the Lemon
//  Squeezy dashboard, where the order and the amount are in front of you.
//
//  Who may: the caller's own session must pass is_app_owner() — the
//  same check every owner function in RUN_ME.sql makes.
//  Secrets: LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID (already set for
//  ls-checkout). 503 { error: 'not_configured' } until they are.
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
const LS = 'https://api.lemonsqueezy.com/v1/';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const URL_ = Deno.env.get('SUPABASE_URL')!;
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  // the owner check runs as the caller, exactly as in the app
  const asCaller = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: 'Bearer ' + jwt } }, auth: { persistSession: false } });
  const { data: owner } = await asCaller.rpc('is_app_owner');
  if (owner !== true) return json(403, { error: 'not_owner' });

  const KEY = Deno.env.get('LEMONSQUEEZY_API_KEY');
  const STORE = Deno.env.get('LEMONSQUEEZY_STORE_ID');
  if (!KEY || !STORE) return json(503, { error: 'not_configured' });
  const head = { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': 'Bearer ' + KEY };
  const db = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* empty */ }

  if (b.action === 'discount') {
    const code = String(b.code || '').toUpperCase();
    const { data: c } = await db.from('promo_codes').select('*').eq('code', code).maybeSingle();
    if (!c || c.kind !== 'percent') return json(404, { error: 'code' });
    if (c.ls_discount_id) return json(200, { ok: true, id: c.ls_discount_id });
    const attributes: Record<string, unknown> = {
      name: 'Moments · ' + code, code, amount: c.pct, amount_type: 'percent', duration: 'once',
      is_limited_redemptions: !!c.max_uses, max_redemptions: c.max_uses || 0,
    };
    if (c.expires_at) attributes.expires_at = c.expires_at;
    const r = await fetch(LS + 'discounts', {
      method: 'POST', headers: head,
      body: JSON.stringify({ data: { type: 'discounts', attributes, relationships: { store: { data: { type: 'stores', id: String(STORE) } } } } }),
    });
    if (!r.ok) return json(502, { error: 'gateway', status: r.status, detail: (await r.text()).slice(0, 300) });
    const out = await r.json();
    const id = out && out.data && out.data.id;
    await db.from('promo_codes').update({ ls_discount_id: String(id) }).eq('code', code);
    return json(200, { ok: true, id });
  }

  if (b.action === 'cancel') {
    const { data: s } = await db.from('plus_subscriptions').select('subscription_id, status').eq('user_id', String(b.user || '')).maybeSingle();
    if (!s) return json(404, { error: 'no_subscription' });
    const r = await fetch(LS + 'subscriptions/' + encodeURIComponent(s.subscription_id), { method: 'DELETE', headers: head });
    // the webhook (subscription_cancelled) records it; nothing else to write here
    return r.ok ? json(200, { ok: true }) : json(502, { error: 'gateway', status: r.status });
  }

  return json(400, { error: 'action' });
});
