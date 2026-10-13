// ═══════════════════════════════════════════════════════════════════
//  create-checkout — pay for a Moments booking through Paymob
//
//  The app sends ONE thing: which booking. The amount, the currency and
//  the reference come from the database (booking_for_payment in
//  RUN_ME.sql), never from the phone — a price sent by the app could be
//  any price. The booking must be the caller's own, still 'pending' and
//  younger than 30 minutes (its seats are held that long).
//
//  The booking code (MM-XXXXXX) is Paymob's merchant_order_id, and the
//  signed webhook (paymob-webhook) reads it back to mark the booking
//  paid. Nothing here marks anything paid.
//
//  POST { bookingId }  with the user's session  →  { checkoutUrl }
//  503 { error: 'not_configured' } until the secrets below exist.
//
//  Secrets (Supabase → Edge Functions → Secrets, never in the app):
//    PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID, PAYMOB_HMAC
//  Deploy: supabase functions deploy create-checkout
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
const UUID = /^[0-9a-f-]{36}$/i;

async function paymob(path: string, body: unknown) {
  const r = await fetch('https://accept.paymob.com/api/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('paymob ' + path + ' ' + r.status);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const API_KEY = Deno.env.get('PAYMOB_API_KEY');
  const INTEGRATION_ID = Deno.env.get('PAYMOB_INTEGRATION_ID');
  const IFRAME_ID = Deno.env.get('PAYMOB_IFRAME_ID');
  if (!API_KEY || !INTEGRATION_ID || !IFRAME_ID || !Deno.env.get('PAYMOB_HMAC')) return json(503, { error: 'not_configured' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await db.auth.getUser(jwt);
  const user = who && who.user;
  if (!user) return json(401, { error: 'signed_out' });

  let bookingId = '';
  try { bookingId = String((await req.json()).bookingId || ''); } catch { /* fall through */ }
  if (!UUID.test(bookingId)) return json(400, { error: 'booking' });

  const { data: b } = await db.rpc('booking_for_payment', { p_id: bookingId, p_user: user.id });
  if (!b || !b.ok) return json(409, { error: 'not_payable' });

  try {
    const cents = Math.round(Number(b.total) * 100);
    const auth = await paymob('auth/tokens', { api_key: API_KEY });
    const order = await paymob('ecommerce/orders', {
      auth_token: auth.token, delivery_needed: false, amount_cents: cents, currency: b.currency,
      merchant_order_id: b.code,
      items: [{ name: String(b.title).slice(0, 50), amount_cents: cents, quantity: 1 }],
    });
    const att = await db.rpc('attach_payment_order', { p_id: bookingId, p_user: user.id, p_provider: 'paymob', p_order: String(order.id) });
    if (!att.data || !att.data.ok) return json(409, { error: 'not_payable' });
    // Paymob insists on billing fields; only the email is real, the rest is its placeholder "NA"
    const pk = await paymob('acceptance/payment_keys', {
      auth_token: auth.token, amount_cents: cents, expiration: 1800, order_id: order.id, currency: b.currency,
      integration_id: Number(INTEGRATION_ID),
      billing_data: {
        first_name: 'Moments', last_name: 'Guest', email: b.email || 'NA', phone_number: 'NA',
        country: 'NA', city: 'NA', street: 'NA', building: 'NA', floor: 'NA', apartment: 'NA',
      },
    });
    return json(200, { checkoutUrl: `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${pk.token}` });
  } catch (e) {
    console.error('checkout failed', String(e).slice(0, 200));
    return json(502, { error: 'gateway' });
  }
});
