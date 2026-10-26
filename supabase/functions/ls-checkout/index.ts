// ═══════════════════════════════════════════════════════════════════
//  ls-checkout — a Lemon Squeezy checkout for Moments Plus (monthly)
//
//  The app sends nothing but its session. The checkout is created here,
//  with the store's secret key, for the one monthly variant, and the
//  person's id goes inside it as custom data — so when Lemon Squeezy's
//  signed webhook (ls-webhook) comes back, it says exactly whose Plus
//  it is. The price lives on the variant in Lemon Squeezy, never in the
//  app. Somebody already subscribed gets their customer portal instead
//  of a second subscription.
//
//  POST (with the user's session)  →  { checkoutUrl } | { portalUrl }
//  503 { error: 'not_configured' } until the secrets below exist.
//
//  Secrets (Supabase → Edge Functions → Secrets, never in the app):
//    LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID
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
  const VARIANT = Deno.env.get('LEMONSQUEEZY_VARIANT_ID');
  if (!KEY || !STORE || !VARIANT || !Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET')) return json(503, { error: 'not_configured' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await db.auth.getUser(jwt);
  const user = who && who.user;
  if (!user) return json(401, { error: 'signed_out' });

  // already paying: manage it, don't buy it twice
  const { data: sub } = await db.from('plus_subscriptions').select('status, portal_url').eq('user_id', user.id).maybeSingle();
  if (sub && ['active', 'on_trial', 'past_due'].includes(sub.status) && sub.portal_url) return json(200, { portalUrl: sub.portal_url });

  const r = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: { 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': 'Bearer ' + KEY },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: { email: user.email || undefined, custom: { user_id: user.id } },
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
