# Moments — server-side pieces to finish wiring

The app is fully built. Two small server-side functions turn on the last
paid/heavy features. Both hold **secret keys** and must live on the
server (Supabase Edge Functions), never in the app.

Deploy with the Supabase CLI: `supabase functions deploy <name>`.

---

## 1) `create-checkout` — payments (Paymob / Moyasar / PayTabs / Paddle)

**Called by** `src/services/payments.js → startCheckout()`

**Request body**
```json
{ "provider": "paymob", "amount": 500, "currency": "EGP", "kind": "boost", "refId": "<uuid>", "description": "Moments Boost" }
```

**Must return**
```json
{ "checkoutUrl": "https://accept.paymob.com/api/acceptance/iframes/..." }
```

**What it does** (example, Paymob):
1. Auth request → get token (uses `PAYMOB_API_KEY` secret).
2. Order registration for `amount`.
3. Payment key request → build the iframe/checkout URL.
4. Return `checkoutUrl`.

Add a second function `payment-webhook` that Paymob calls on success →
flip the matching `payments` row to `status='paid'` and the `boosts` row
to `status='active'` (use the **service role** key here).

Secrets: `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC`
(equivalents for Moyasar/PayTabs/Paddle when you add them).

---

## 2) `r2-presign` — Cloudflare R2 video/photo uploads (zero egress)

**Called by** `src/lib/storage.js → uploadMediaSmart()`

**Request body**
```json
{ "key": "<userId>/<timestamp>.mp4", "contentType": "video/mp4" }
```

**Must return**
```json
{ "uploadUrl": "https://<accountid>.r2.cloudflarestorage.com/...signed...", "publicUrl": "https://media.yourdomain.com/<key>" }
```

**What it does:** uses the R2 S3 API to create a presigned PUT url
(AWS SigV4) with `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` /
`R2_ACCOUNT_ID` / `R2_BUCKET`. The app PUTs the file straight to R2.

Then set `EXPO_PUBLIC_R2_PUBLIC_URL` (your bucket's public domain) so the
app builds public URLs. Until this exists, uploads fall back to Supabase
Storage automatically — nothing breaks.

### Transcoding to 720p / 480p
The camera already caps capture at 720p. For **uploaded** long videos,
add **Cloudflare Stream** (recommended) or an ffmpeg Worker triggered on
R2 upload to output HLS at 720p + 480p. Store the playback URL on the
post. This is the only piece that needs a media pipeline; everything
else already works.
