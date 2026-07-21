# Bardi ↔ Moments integration

There is **no standalone Bardi API server** — the Bardi web app runs entirely
in the browser. To give Moments a real, callable "Bardi endpoint," deploy the
Supabase Edge Function in [`bardi-chat/index.ts`](bardi-chat/index.ts). It pairs
Bardi's actual persona with an AI provider, so Moments can chat with the real
Bardi from inside its own UI.

## Deploy (in the Moments repo, which already uses Supabase)

```bash
# copy the function into the Moments repo:
#   supabase/functions/bardi-chat/index.ts
supabase functions deploy bardi-chat --no-verify-jwt

# optional but recommended — private, higher quality (Claude):
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# without this secret it falls back to Pollinations (free, keyless,
# but user messages go to that third party).
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

## Privacy note

- With `ANTHROPIC_API_KEY` set, requests go only to Anthropic.
- Without it, requests go to Pollinations (third-party, keyless free tier).
- Either way, send only what the user chose to share in that chat. Do not pipe
  other users' posts or private data into this endpoint.
