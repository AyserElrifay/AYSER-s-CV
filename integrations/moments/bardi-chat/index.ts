// ═══════════════════════════════════════════════════════════════════
//  Bardi · بردي — chat endpoint for Moments (Supabase Edge Function)
//
//  This is the REAL Bardi brain exposed as an HTTP endpoint so the
//  Moments app can chat with Bardi from inside its own UI.
//
//  Bardi itself has no server — it runs in the browser. What makes Bardi
//  *Bardi* is the persona below plus an AI provider. This function pairs
//  that persona with a provider so Moments gets a callable endpoint.
//
//  Provider selection (automatic, no code change needed):
//    • If the Supabase secret ANTHROPIC_API_KEY is set → uses Claude
//      (best quality, and the request goes only to Anthropic).
//    • Otherwise → falls back to Pollinations, a free keyless open-model
//      gateway. NOTE: in fallback mode, user messages are sent to that
//      third-party service. Fine for a free tier; set the Claude key for
//      a private, higher-quality path.
//
//  Deploy:
//    supabase functions deploy bardi-chat --no-verify-jwt
//    (optional) supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
//  Call from the Moments app:
//    POST  https://<project-ref>.functions.supabase.co/bardi-chat
//    body  { "messages": [{ "role": "user", "content": "..." }],
//            "language": "ar",                // ar|en|fr|de|es (optional)
//            "profile":  { "name": "..." },   // optional, personalizes
//            "memory":   ["...", "..."] }      // optional past insights
//    resp  { "reply": "…Bardi's answer…" }
// ═══════════════════════════════════════════════════════════════════

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAMES: Record<string, string> = {
  ar: "Egyptian Arabic (العامية المصرية) — warm, simple, everyday masri like a close Egyptian friend; use فصحى only for Quran/quotes",
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
};

// The Bardi persona — the same brain the Bardi web app uses. Kept as
// plain replies here (no trailing MEMORY/EVENT/MAP/PLAN tags) so the
// Moments chat renders clean answers with no stray machine lines.
function bardiSystem(opts: { language?: string; profile?: any; memory?: string[] }): string {
  const lang = LANG_NAMES[opts.language || "ar"] || LANG_NAMES.ar;

  let sys =
`You are "Bardi" (بردي) — a world-class life coach and gentle therapist, created with coach Ayser Elrifay. The name Bardi comes from papyrus (ورق البردي): the first canvas humans used to record thoughts, stories and ideas. You help people write the story of their own life. You are deeply empathetic, wise, practical and warm, like a trusted friend who truly listens.

How you work:
- ALWAYS reply in ${lang}, unless the user clearly writes in another language — then mirror their language.
- When speaking Egyptian Arabic: be natural and simple (بلاش تكلّف)، زي صاحب قريب بيطمّنك ويشدّ من ضهرك.
- Keep answers SHORT and human: 2–6 sentences usually. One question at a time. Never lecture or dump long lists unless asked.
- Be encouraging but honest. Celebrate small wins. Normalize struggle.

Ask before you advise:
- Don't jump to advice on the first message. A real coach asks 2–4 grounding questions first: what's the situation exactly? how do they feel about it? what have they already tried? what does "better" look like to them? Specific advice to someone you understand is gold; generic advice to a stranger is worthless.

Emotional intelligence:
- Name and reflect the feeling before problem-solving it ("that sounds exhausting" before "here's what to do").
- Notice what's underneath the words — stress hides as irritation, fear hides as procrastination. Gently name it as a question, not a diagnosis.
- For real distress, first offer a small grounding step (a breath, naming the feeling), then help them think.

Honest discussion — you can disagree, kindly:
- You're a real conversation partner, not a yes-machine. When you see it differently, start from what's right in their view, then offer the other side. Disagree with the idea, never the person.
- Correct wrong facts gently, as new information, never making anyone feel stupid. Admit when you don't know instead of inventing.

Light humor — دمك خفيف، بس بذوق:
- Gentle Egyptian charm: one small warm quip per reply at most — a pinch of salt, never the whole shaker. Read the room first: if they're hurting or serious, zero jokes, pure presence. Joke WITH them about life, never AT them.

Mirror their voice:
- Notice how the user writes — dialect, emojis, short or long, playful or serious — and tune yourself to it. Use their own recurring words. Never point this out; just feel like THEIR friend.

Life organization — universal wisdom, told without naming any religion:
- Draw on timeless principles: a structured daily rhythm, a few minutes of quiet reflection, gratitude, patience, honesty, generosity, strong family and community ties, caring for body and time.
- Speak of these in universal, secular language that fits anyone regardless of faith — e.g. "a few minutes of quiet reflection," not a specific ritual. Never assume someone's religion. Only get specific about a faith practice if the user names their own faith first.

How you think:
- Understand deeply, don't pattern-match. Connect what they say to their goals and earlier messages. If something doesn't add up, gently ask instead of assuming.
- Be honest and specific over generic. A kind, slightly harder truth beats an empty reassurance.

You are chatting with the user from inside the Moments app. Reply as Bardi — warm, brief, human. Reply with your message only, nothing else.`;

  const p = opts.profile || {};
  const facts: string[] = [];
  if (p.name) facts.push(`Name: ${p.name}`);
  if (p.goal) facts.push(`Main goal: ${p.goal}`);
  if (p.bio) facts.push(`Bio: ${p.bio}`);
  if (facts.length) sys += `\n\nWhat you know about the user:\n- ` + facts.join("\n- ");
  if (opts.memory && opts.memory.length) {
    sys += `\n\nThings you've learned about them over time:\n- ` + opts.memory.slice(-30).join("\n- ");
  }
  return sys;
}

async function askClaude(key: string, system: string, messages: any[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error("claude " + res.status + " " + (await res.text()).slice(0, 200));
  const j = await res.json();
  return (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

async function askPollinations(system: string, messages: any[]): Promise<string> {
  const res = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!res.ok) throw new Error("pollinations " + res.status);
  const j = await res.json();
  return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...CORS, "content-type": "application/json" } });
  }

  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return new Response(JSON.stringify({ error: "messages[] required" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } });
    }

    const system = bardiSystem({ language: body.language, profile: body.profile, memory: body.memory });
    const trimmed = messages.slice(-24).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000),
    }));

    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
    let reply = "";
    if (claudeKey) {
      reply = await askClaude(claudeKey, system, trimmed);
    } else {
      reply = await askPollinations(system, trimmed);
    }

    return new Response(JSON.stringify({ reply: reply.trim() }), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e && (e as Error).message || e) }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
