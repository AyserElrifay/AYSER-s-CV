// ═══════════════════════════════════════════════════════════════════
//  paymob-webhook — Paymob tells us a payment happened
//
//  The ONLY way a booking becomes 'paid' online. Paymob signs every
//  "transaction processed" callback with the account's HMAC secret; the
//  signature is recomputed here from the fields Paymob lists, in its
//  order, and anything that does not match is refused. Then
//  mark_booking_paid (callable only with the service role) checks that
//  the amount and currency are exactly the booking's.
//
//  Paymob dashboard → Developers → Payment integrations → your card
//  integration → "Transaction processed callback":
//     https://<project>.supabase.co/functions/v1/paymob-webhook
//  Deploy with --no-verify-jwt (Paymob has no Supabase session).
// ═══════════════════════════════════════════════════════════════════
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Paymob's documented order for the transaction HMAC
const FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id',
  'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id',
  'owner', 'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
];
const pick = (o: any, path: string) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);

async function hmacHex(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const SECRET = Deno.env.get('PAYMOB_HMAC');
  if (!SECRET) return new Response('not configured', { status: 503 });

  const given = (new URL(req.url).searchParams.get('hmac') || '').toLowerCase();
  let body: any = null;
  try { body = await req.json(); } catch { return new Response('body', { status: 400 }); }
  const obj = body && body.obj;
  if (!obj || body.type !== 'TRANSACTION') return new Response('ignored', { status: 200 });

  const text = FIELDS.map((f) => { const v = pick(obj, f); return v == null ? '' : String(v); }).join('');
  if (!given || !same(await hmacHex(SECRET, text), given)) return new Response('signature', { status: 401 });

  // only a finished, successful, untouched payment counts
  if (obj.success !== true || obj.pending === true || obj.is_voided === true || obj.is_refunded === true) {
    return new Response('not a payment', { status: 200 });
  }
  const code = String(pick(obj, 'order.merchant_order_id') || '');
  if (!/^M[MP]-[A-Z0-9]{6}$/.test(code)) return new Response('order', { status: 200 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  // MM- is a booking, MP- is Moments Plus
  const { data } = await db.rpc(code.startsWith('MP-') ? 'mark_plus_paid' : 'mark_booking_paid', {
    p_code: code, p_txn: String(obj.id), p_amount_cents: Number(obj.amount_cents), p_currency: String(obj.currency || ''),
  });
  if (!data || !data.ok) console.error('not marked', code, data && data.reason);
  return new Response('ok', { status: 200 });
});
