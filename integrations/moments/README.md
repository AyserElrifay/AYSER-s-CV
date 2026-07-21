# Bardi ↔ Moments integration

**Max-privacy build.** There is **no standalone Bardi API server** — the Bardi
web app runs entirely in the browser. To give Moments a real, callable "Bardi
endpoint," deploy the Supabase Edge Function in
[`bardi-chat/index.ts`](bardi-chat/index.ts). It pairs Bardi's actual persona
with Claude, so Moments can chat with the real Bardi from inside its own UI —
with the same privacy posture as talking to Bardi directly with your own key.

## What "max privacy" means here

- **Claude only, by default — no silent third-party fallback.** If the
  `ANTHROPIC_API_KEY` secret isn't set, the endpoint refuses the request with
  a clear error instead of quietly routing messages to a free third-party
  gateway. A fallback exists but requires an explicit opt-in
  (`ALLOW_FREE_FALLBACK=true`) — nobody's conversation leaves Anthropic by
  accident.
- **Locked-down CORS.** The endpoint only accepts requests from the origin you
  set in `ALLOWED_ORIGIN` (the Moments web app's own domain) — not a wildcard
  `*` that any website could call.
- **Zero retention.** The function does not log, store, or persist any
  message content anywhere — not to Supabase logs, not to a table. Pure
  pass-through: request in, Claude reply out. Errors only ever describe what
  failed (a status code), never the conversation itself.
- **Basic rate limiting** on the endpoint to blunt abuse, on top of whatever
  limits your Supabase project already enforces.

## Deploy (in the Moments repo, which already uses Supabase)

```bash
# copy the function into the Moments repo:
#   supabase/functions/bardi-chat/index.ts
supabase functions deploy bardi-chat --no-verify-jwt

# required for the endpoint to work at all:
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# required to lock CORS to your actual Moments domain:
supabase secrets set ALLOWED_ORIGIN=https://ayserelrifay.github.io

# NOT recommended for real users — only if you explicitly want a free,
# keyless fallback and accept that messages then go to a third party:
# supabase secrets set ALLOW_FREE_FALLBACK=true
```

## Call it from Moments

```
POST https://<project-ref>.functions.supabase.co/bardi-chat
{
  "messages": [{ "role": "user", "content": "أنا حاسس إني مشتت" }],
  "language": "ar",
  "profile":  { "name": "Ayser", "bio": "..." },   // optional
  "memory":   ["prefers short replies"]             // optional
}
→ { "reply": "…Bardi's answer…" }
```

The endpoint returns a full reply (not streamed) for simplicity. Personality,
tone, emotional/social intelligence, universal-wisdom framing and light humor
are all baked into the persona — it is the same brain the Bardi web app uses.

## Privacy checklist before going live

- [ ] `ANTHROPIC_API_KEY` set (endpoint refuses to run without it or an
      explicit fallback opt-in)
- [ ] `ALLOWED_ORIGIN` set to the real Moments domain
- [ ] `ALLOW_FREE_FALLBACK` left unset (default: off)
- [ ] Only pass what the user chose to share in *that* chat — never pipe
      other users' posts, DMs, or private profile data into this endpoint
      without their explicit, per-action consent
- [ ] Review your Supabase project's function log retention settings — this
      function itself logs nothing, but confirm no platform-level request
      logging captures bodies either
