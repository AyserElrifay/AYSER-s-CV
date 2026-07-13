// Supabase Edge Function: create-checkout
// Creates a real payment checkout with the gateway's SECRET keys (kept
// here on the server, never in the app) and returns a checkout URL.
// Deploy:  supabase functions deploy create-checkout
// Secrets: supabase secrets set PAYMOB_API_KEY=... PAYMOB_INTEGRATION_ID=... PAYMOB_IFRAME_ID=...
//
// Called by src/services/payments.js → startCheckout()
// Body: { provider, amount, currency, kind, refId, description }
// Returns: { checkoutUrl }

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function paymobCheckout(amount: number, currency: string, refId: string, description: string) {
  const API_KEY = Deno.env.get("PAYMOB_API_KEY")!;
  const INTEGRATION_ID = Deno.env.get("PAYMOB_INTEGRATION_ID")!;
  const IFRAME_ID = Deno.env.get("PAYMOB_IFRAME_ID")!;
  const cents = Math.round(amount * 100);

  // 1) auth
  const auth = await fetch("https://accept.paymob.com/api/auth/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: API_KEY }),
  }).then((r) => r.json());
  const token = auth.token;

  // 2) order (merchant_order_id = our payment/boost ref, read back in the webhook)
  const order = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: token,
      delivery_needed: false,
      amount_cents: cents,
      currency,
      merchant_order_id: refId || `moments-${Date.now()}`,
      items: [{ name: description || "Moments", amount_cents: cents, quantity: 1 }],
    }),
  }).then((r) => r.json());

  // 3) payment key
  const pk = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: token,
      amount_cents: cents,
      expiration: 3600,
      order_id: order.id,
      currency,
      integration_id: Number(INTEGRATION_ID),
      billing_data: {
        first_name: "Moments", last_name: "User", email: "user@moments.app",
        phone_number: "+201000000000", country: "EG", city: "Cairo",
        street: "NA", building: "NA", floor: "NA", apartment: "NA",
      },
    }),
  }).then((r) => r.json());

  return `https://accept.paymob.com/api/acceptance/iframes/${IFRAME_ID}?payment_token=${pk.token}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { provider, amount, currency = "EGP", refId, description } = await req.json();
    let checkoutUrl: string;

    switch (provider) {
      case "paymob":
        checkoutUrl = await paymobCheckout(amount, currency, refId, description);
        break;
      // TODO: add moyasar / paytabs / paddle the same way (each has a
      // "create payment → hosted page" call; secrets already documented).
      default:
        return new Response(JSON.stringify({ error: `provider ${provider} not configured` }), {
          status: 400, headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ checkoutUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
