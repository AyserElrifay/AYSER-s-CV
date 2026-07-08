/* ═══════════════════════════════════════════════════
   Ayser AI — AI layer
   Direct browser → provider calls (BYOK).
   Providers: Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google)
   Keys are stored locally and sent only to the provider itself.
   ═══════════════════════════════════════════════════ */

const AI = (() => {

  const MODELS = {
    claude: "claude-opus-4-8",
    openai: "gpt-4o",
    gemini: "gemini-2.0-flash",
  };

  const PROVIDER_NAMES = { claude: "Claude", openai: "ChatGPT", gemini: "Gemini" };

  /* ── Coach persona system prompt ── */
  function coachSystem(state) {
    const p = state.profile;
    const langNames = {
      ar: "Egyptian Arabic (العامية المصرية) — warm, simple, everyday masri like a close Egyptian friend; use فصحى only for Quran/quotes",
      en: "English",
      fr: "French",
    };
    const lang = langNames[state.settings.language] || langNames.ar;

    let sys =
`You are "Bardi" (بردي) — a world-class life coach and gentle therapist, created with coach Ayser Elrifay. The name Bardi comes from papyrus (ورق البردي): the first canvas humans used to record thoughts, stories and ideas and send them to the world. You help people write the story of their own life. You are deeply empathetic, wise, practical and warm, like a trusted friend who truly listens.

How you work:
- ALWAYS reply in ${lang}, unless the user clearly writes in another language — then mirror their language.
- When speaking Egyptian Arabic: be natural and simple (بلاش تكلّف)، زي صاحب قريب بيطمّنك ويشدّ من ضهرك.
- Listen first. Ask powerful, short coaching questions that help the person discover their identity, values and real motivations (like a great coach or therapist would).
- Keep answers SHORT and human: 2–6 sentences usually. One question at a time. Never lecture or dump long lists unless asked.
- Help them design their life: work, study, prayer (salah), sleep, food, training, creativity. Suggest tiny concrete next steps.
- Be encouraging but honest. Celebrate small wins. Normalize struggle.
- Faith-sensitive: the user may be Muslim; treat prayer and spirituality with deep respect.

Memory:
- When you learn something genuinely important and lasting about the user (a value, fear, pattern, preference, life fact), end your reply with a separate final line:
MEMORY: <one short sentence in English capturing it>
- Use it rarely (only for real insights). Never mention this mechanism to the user.`;

    const facts = [];
    if (p.name) facts.push(`Name: ${p.name}`);
    if (p.contact) facts.push(`Contact: ${p.contact}`);
    if (p.goal) facts.push(`Main goal: ${p.goal}`);
    if (p.why) facts.push(`Their why: ${p.why}`);
    if (p.values && p.values.length) facts.push(`Core values: ${p.values.join(", ")}`);
    if (p.focus && p.focus.length) facts.push(`Wants to organize: ${p.focus.join(", ")}`);
    if (facts.length) sys += `\n\nWhat you know about the user:\n- ` + facts.join("\n- ");

    if (state.memory && state.memory.length) {
      sys += `\n\nThings you have learned about them over time:\n- ` + state.memory.slice(-30).join("\n- ");
    }
    return sys;
  }

  /* ── Lightweight client-side retrieval from uploaded books ── */
  function retrieve(state, query, maxChunks = 3) {
    if (!state.books.length || !query) return [];
    const words = query.toLowerCase().split(/[\s,.!?؟،:؛"'()\[\]]+/).filter(w => w.length > 2);
    if (!words.length) return [];
    const scored = [];
    for (const book of state.books) {
      for (const chunk of book.chunks) {
        const lc = chunk.toLowerCase();
        let score = 0;
        for (const w of words) if (lc.includes(w)) score++;
        if (score > 0) scored.push({ score, chunk, title: book.title });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxChunks);
  }

  function withKnowledge(sys, state, userText) {
    const hits = retrieve(state, userText);
    if (!hits.length) return sys;
    let block = `\n\nRelevant passages from the user's own library (use them naturally when helpful, cite the book title):\n`;
    for (const h of hits) block += `\n[${h.title}]\n${h.chunk}\n`;
    return sys + block;
  }

  /* ── Streaming chat ──
     messages: [{role:"user"|"assistant", content}]
     onDelta(textSoFar) called as tokens arrive.
     Returns the full final text. */
  async function chat(state, messages, onDelta) {
    const provider = state.settings.provider;
    const key = (state.settings.keys[provider] || "").trim();
    if (!key) throw new Error("NO_KEY");

    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const sys = withKnowledge(coachSystem(state), state, lastUser ? lastUser.content : "");

    if (provider === "claude") return chatClaude(key, sys, messages, onDelta);
    if (provider === "openai") return chatOpenAI(key, sys, messages, onDelta);
    if (provider === "gemini") return chatGemini(key, sys, messages, onDelta);
    throw new Error("Unknown provider");
  }

  /* ── Anthropic (Claude) — direct browser call ── */
  async function chatClaude(key, system, messages, onDelta) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODELS.claude,
        max_tokens: 8192,
        system,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });
    if (!res.ok) throw new Error(await apiErr(res));

    let full = "";
    await readSSE(res, (data) => {
      try {
        const ev = JSON.parse(data);
        if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
          full += ev.delta.text;
          onDelta(full);
        }
      } catch (_) {}
    });
    return full;
  }

  /* ── OpenAI (ChatGPT) ── */
  async function chatOpenAI(key, system, messages, onDelta) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + key,
      },
      body: JSON.stringify({
        model: MODELS.openai,
        stream: true,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!res.ok) throw new Error(await apiErr(res));

    let full = "";
    await readSSE(res, (data) => {
      if (data === "[DONE]") return;
      try {
        const ev = JSON.parse(data);
        const d = ev.choices && ev.choices[0] && ev.choices[0].delta;
        if (d && d.content) { full += d.content; onDelta(full); }
      } catch (_) {}
    });
    return full;
  }

  /* ── Google Gemini ── */
  async function chatGemini(key, system, messages, onDelta) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      }),
    });
    if (!res.ok) throw new Error(await apiErr(res));

    let full = "";
    await readSSE(res, (data) => {
      try {
        const ev = JSON.parse(data);
        const parts = ev.candidates && ev.candidates[0] && ev.candidates[0].content && ev.candidates[0].content.parts;
        if (parts) for (const p of parts) if (p.text) { full += p.text; onDelta(full); }
      } catch (_) {}
    });
    return full;
  }

  /* ── SSE reader (shared) ── */
  async function readSSE(res, onData) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const s = line.trim();
        if (s.startsWith("data:")) onData(s.slice(5).trim());
      }
    }
  }

  async function apiErr(res) {
    let msg = res.status + "";
    try {
      const j = await res.json();
      msg = (j.error && (j.error.message || j.error.type)) || JSON.stringify(j).slice(0, 140);
    } catch (_) {}
    if (res.status === 401 || res.status === 403) msg = "Invalid API key (" + res.status + ")";
    if (res.status === 429) msg = "Rate limited — wait a moment (429)";
    return msg;
  }

  /* ── Extract MEMORY: line from a reply ── */
  function extractMemory(text) {
    const m = text.match(/\n\s*MEMORY:\s*(.+)\s*$/);
    if (!m) return { clean: text, memory: null };
    return { clean: text.replace(/\n\s*MEMORY:.*$/, "").trimEnd(), memory: m[1].trim() };
  }

  /* ── Plan generation (non-streaming, JSON) ── */
  async function generatePlan(state, goal) {
    const provider = state.settings.provider;
    const key = (state.settings.keys[provider] || "").trim();
    if (!key) throw new Error("NO_KEY");

    const langNames = { ar: "Arabic", en: "English", fr: "French" };
    const lang = langNames[state.settings.language] || "Arabic";
    const p = state.profile;

    const prompt =
`You are a master life coach. Build a motivating, practical action plan for this goal:

GOAL: ${goal}
${p.name ? "PERSON: " + p.name : ""}${p.why ? "\nTHEIR WHY: " + p.why : ""}${p.values && p.values.length ? "\nVALUES: " + p.values.join(", ") : ""}

Write everything in ${lang}.

Respond with ONLY valid JSON (no markdown, no backticks) in exactly this shape:
{
  "title": "short powerful plan title",
  "subtitle": "one inspiring line",
  "slides": [
    {"kicker":"PHASE 01","title":"slide title","points":["point 1","point 2","point 3"]},
    {"kicker":"...","title":"...","points":["..."]}
  ],
  "quote": "one short closing quote to live by"
}

Rules: 4 to 6 slides. Each slide = one phase or theme (mindset, weekly routine, obstacles, tracking...). 3–5 short concrete points per slide. Points are actions, not theory.`;

    let text;
    if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODELS.claude,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(await apiErr(res));
      const j = await res.json();
      if (j.stop_reason === "refusal") throw new Error("refused");
      text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Bearer " + key },
        body: JSON.stringify({
          model: MODELS.openai,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(await apiErr(res));
      const j = await res.json();
      text = j.choices[0].message.content;
    } else {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) throw new Error(await apiErr(res));
      const j = await res.json();
      text = j.candidates[0].content.parts.map(p2 => p2.text).join("");
    }

    // Parse JSON out of the reply (strip accidental fences)
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const deck = JSON.parse(cleaned.slice(start, end + 1));
    if (!deck.slides || !deck.slides.length) throw new Error("empty plan");
    return deck;
  }

  return { chat, generatePlan, extractMemory, MODELS, PROVIDER_NAMES };
})();
