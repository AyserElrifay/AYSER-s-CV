// ═══════════════════════════════════════════════════════════════════
//  ls-webhook — Lemon Squeezy tells us about a Plus subscription
//
//  The ONLY way Plus is switched on or off by Lemon Squeezy. Every call
//  is signed: X-Signature is the HMAC-SHA256 (hex) of the raw body with
//  the webhook's signing secret, recomputed here and compared in
//  constant time; anything else is refused before the body is read as
//  JSON. Whose subscription it is comes from the custom data that
//  ls-checkout put into the checkout — never from the email.
//
//  Events handled (Lemon Squeezy → Settings → Webhooks, URL
//     https://<project>.supabase.co/functions/v1/ls-webhook ):
//    subscription_created · subscription_updated · subscription_cancelled
//    subscription_resumed · subscription_expired · subscription_paused
//    subscription_unpaused · subscription_payment_success · subscription_payment_failed
//  Each one carries the whole subscription, so every event is applied
//  the same way: its status, its renewal date, its end date
//  (ls_apply in RUN_ME.sql decides what that means for Plus).
//
//  Which tier it is comes from what was bought, as Lemon Squeezy's signed
//  event says it: the variant LEMONSQUEEZY_VIP_VARIANT_ID, or a product
//  or variant whose name says "VIP", is VIP; anything else is Basic. The
//  checkout link's custom data only says WHO — never which tier — so
//  nobody can buy Basic and be given VIP. A plan change in the customer
//  portal moves the tier too.
//
//  Secret: LEMONSQUEEZY_WEBHOOK_SECRET.  Deploy with --no-verify-jwt.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

async function hmacHex(secret: string, body: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, body);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const SECRET = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET');
  if (!SECRET) return new Response('not configured', { status: 503 });

  const raw = new Uint8Array(await req.arrayBuffer());
  const given = (req.headers.get('x-signature') || '').toLowerCase();
  if (!given || !same(await hmacHex(SECRET, raw), given)) return new Response('signature', { status: 401 });

  let ev: any;
  try { ev = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('json', { status: 400 }); }
  const name = String((ev.meta && ev.meta.event_name) || '');
  if (!name.startsWith('subscription_')) return new Response('ignored', { status: 200 });

  const d = ev.data || {};
  const a = d.attributes || {};
  // a payment event's data is the invoice; the subscription is named inside it
  const isInvoice = d.type === 'subscription-invoices';
  const subscriptionId = String(isInvoice ? a.subscription_id : d.id || '');
  const userId = ev.meta && ev.meta.custom_data && ev.meta.custom_data.user_id;
  if (!userId || !subscriptionId) return new Response('no user', { status: 200 });   // not one of ours: acknowledge, do nothing

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // an invoice says little about the subscription itself: read it fresh from Lemon Squeezy
  let s = a;
  if (isInvoice) {
    const KEY = Deno.env.get('LEMONSQUEEZY_API_KEY');
    if (!KEY) return new Response('ok', { status: 200 });
    const r = await fetch('https://api.lemonsqueezy.com/v1/subscriptions/' + encodeURIComponent(subscriptionId), {
      headers: { 'Accept': 'application/vnd.api+json', 'Authorization': 'Bearer ' + KEY },
    });
    if (!r.ok) return new Response('retry', { status: 500 });               // Lemon Squeezy will send it again
    s = ((await r.json()).data || {}).attributes || {};
  }

  const { data, error } = await db.rpc('ls_apply', { p: {
    user_id: String(userId),
    subscription_id: subscriptionId,
    customer_id: s.customer_id != null ? String(s.customer_id) : null,
    variant_id: s.variant_id != null ? String(s.variant_id) : null,
    tier: (s.variant_id != null && String(s.variant_id) === String(Deno.env.get('LEMONSQUEEZY_VIP_VARIANT_ID') || '-'))
      || /\bvip\b/i.test(String(s.product_name || '') + ' ' + String(s.variant_name || '')) ? 'vip' : 'basic',
    status: s.status || null,
    renews_at: s.renews_at || null,
    ends_at: s.ends_at || null,
    portal_url: (s.urls && s.urls.customer_portal) || null,
    event_at: s.updated_at || null,
  } });
  if (error) return new Response('retry', { status: 500 });
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
