// Bardi — the Moments assistant, as a Supabase Edge Function.
//
// This is a ready-to-deploy default that honours the contract Ayser set:
//   POST  { messages:[{role,content}], language?, profile?{name,bio} }
//   →     { reply: string }
//
// It works FREE out of the box via Pollinations, and gets sharper when an
// ANTHROPIC_API_KEY secret is set. Replace this file with the exact code
// from the bardi repo (integrations/moments/bardi-chat) whenever you like —
// the request/response shape is identical, so the app needs no changes.
//
// Deploy:  supabase functions deploy bardi-chat --no-verify-jwt
// Sharper: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANG_NAME: Record<string, string> = {
  ar: "Arabic", en: "English", fr: "French", es: "Spanish", tr: "Turkish",
  pt: "Portuguese", ro: "Romanian", it: "Italian", nl: "Dutch", ru: "Russian",
  zh: "Chinese", ko: "Korean", ja: "Japanese",
};

function systemPrompt(language: string, profile: any): string {
  const lang = LANG_NAME[language] || "the user's language";
  let p = `You are Bardi, a warm, sharp personal assistant living inside Moments — a social app.
You help people understand themselves, grow, plan trips, and start projects.
Be concise, kind and practical. Ask one question at a time when you need more.
Always reply in ${lang}.`;
  if (profile && (profile.name || profile.bio)) {
    p += `\nYou're talking to ${profile.name || "someone"}${profile.bio ? ` (bio: ${profile.bio})` : ""}.`;
  }
  return p;
}

async function viaAnthropic(key: string, sys: string, messages: any[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 800,
      system: sys,
      messages: messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })),
    }),
  });
  if (!res.ok) throw new Error("anthropic " + res.status);
  const data = await res.json();
  return (data?.content?.[0]?.text || "").trim();
}

async function viaPollinations(sys: string, messages: any[]): Promise<string> {
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: [{ role: "system", content: sys }, ...messages.map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }))],
    }),
  });
  if (!res.ok) throw new Error("pollinations " + res.status);
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { messages = [], language = "en", profile = null } = await req.json();
    const sys = systemPrompt(language, profile);
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    let reply = "";
    if (key) {
      try { reply = await viaAnthropic(key, sys, messages); } catch (_e) { reply = ""; }
    }
    if (!reply) reply = await viaPollinations(sys, messages);
    return new Response(JSON.stringify({ reply }), { headers: { ...CORS, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...CORS, "content-type": "application/json" } });
  }
});
