// ═══════════════════════════════════════════════════════════════════
//  ls-checkout — a Lemon Squeezy checkout for Moments Basic or VIP
//
//  The app sends its session and which tier: { tier: 'basic' | 'vip' }
//  (nothing else). The checkout is created here, with the store's
//  secret key, for that tier's monthly variant, and the
//  person's id goes inside it as custom data — so when Lemon Squeezy's
//  signed webhook (ls-webhook) comes back, it says exactly whose Plus
//  it is. The price lives on the variant in Lemon Squeezy, never in the
//  app. Somebody already subscribed gets their customer portal instead
//  of a second subscription; somebody on Basic who asks for VIP (or the
//  other way round) has their one subscription moved to the other
//  variant — Lemon Squeezy prorates it — never a second one.
//
//  POST { tier } (with the user's session)
//    →  { checkoutUrl } | { portalUrl } | { changed: true }
//  503 { error: 'not_configured' } until the secrets below exist.
//
//  Secrets (Supabase → Edge Functions → Secrets, never in the app):
//    LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID,
//    LEMONSQUEEZY_VARIANT_ID (Basic, 99 EGP), LEMONSQUEEZY_VIP_VARIANT_ID (VIP, 199 EGP)
//  Deploy: supabase functions deploy ls-checkout
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const KEY = Deno.env.get('LEMONSQUEEZY_API_KEY');
  const STORE = Deno.env.get('LEMONSQUEEZY_STORE_ID');
  let tier = 'basic';
  try { const b = await req.json(); if (b && b.tier === 'vip') tier = 'vip'; } catch { /* no body: Basic */ }
  const VARIANT = Deno.env.get(tier === 'vip' ? 'LEMONSQUEEZY_VIP_VARIANT_ID' : 'LEMONSQUEEZY_VARIANT_ID');
  if (!KEY || !STORE || !VARIANT || !Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET')) return json(503, { error: 'not_configured' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await db.auth.getUser(jwt);
  const user = who && who.user;
  if (!user) return json(401, { error: 'signed_out' });

  // already paying: the same tier is managed in the portal; the other tier moves the one subscription
  const { data: sub } = await db.from('plus_subscriptions').select('status, portal_url, subscription_id, tier').eq('user_id', user.id).maybeSingle();
  if (sub && ['active', 'on_trial', 'past_due'].includes(sub.status)) {
    if ((sub.tier || 'basic') === tier) return sub.portal_url ? json(200, { portalUrl: sub.portal_url }) : json(409, { error: 'already' });
    const ch = await fetch('https://api.lemonsqueezy.com/v1/subscriptions/' + encodeURIComponent(sub.subscription_id), {
      method: 'PATCH',
      headers: { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': 'Bearer ' + KEY },
      body: JSON.stringify({ data: { type: 'subscriptions', id: String(sub.subscription_id), attributes: { variant_id: Number(VARIANT) } } }),
    });
    // the webhook (subscription_updated) is what switches the tier on
    return ch.ok ? json(200, { changed: true }) : json(502, { error: 'gateway', status: ch.status });
  }

  const r = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': 'Bearer ' + KEY },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: { email: user.email || undefined, custom: { user_id: user.id, tier } },
          product_options: { redirect_url: ORIGIN + '/?plus=thanks' },
        },
        relationships: {
          store: { data: { type: 'stores', id: String(STORE) } },
          variant: { data: { type: 'variants', id: String(VARIANT) } },
        },
      },
    }),
  });
  if (!r.ok) return json(502, { error: 'gateway', status: r.status });
  const out = await r.json();
  const url = out && out.data && out.data.attributes && out.data.attributes.url;
  if (!url) return json(502, { error: 'gateway' });
  return json(200, { checkoutUrl: url });
});
