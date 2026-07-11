/* ═══════════════════════════════════════════════════
   Bardi — AI layer
   Direct browser → provider calls (BYOK).
   Providers: Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google)
   Keys are stored locally and sent only to the provider itself.
   ═══════════════════════════════════════════════════ */

const AI = (() => {

  const MODELS = {
    free: "openai",            // Pollinations: routes to strong open/GPT-class models, keyless
    claude: "claude-opus-4-8",
    openai: "gpt-4o",
    gemini: "gemini-2.0-flash",
  };

  // Free, keyless open-model endpoint (runs open-source models like Llama / DeepSeek / Mistral).
  const FREE_ENDPOINT = "https://text.pollinations.ai/openai";

  const PROVIDER_NAMES = { free: "Bardi Free", claude: "Claude", openai: "ChatGPT", gemini: "Gemini", local: "Bardi Local" };

  /* ── On-device open-source models (WebLLM / WebGPU) ──
     Real open-weight models — Meta Llama, Microsoft Phi, Alibaba Qwen —
     downloaded once from Hugging Face (via the MLC-AI WebLLM CDN library)
     and run entirely inside the browser afterward. No server, no key, and
     after the one-time download nothing about the conversation ever
     leaves the device — this is more private than any hosted provider. */
  const LOCAL_MODELS = [
    { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", name: "Llama 3.2 · 3B (Meta)", size: "~1.9 GB", recommended: true },
    { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", name: "Llama 3.2 · 1B (Meta)", size: "~700 MB" },
    { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", name: "Qwen 2.5 · 1.5B (Alibaba)", size: "~1 GB" },
    { id: "gemma-2-2b-it-q4f16_1-MLC", name: "Gemma 2 · 2B (Google)", size: "~1.6 GB" },
    { id: "Phi-3.5-mini-instruct-q4f16_1-MLC", name: "Phi-3.5 mini (Microsoft)", size: "~2.2 GB" },
    { id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC", name: "Mistral 7B (Mistral AI)", size: "~4 GB" },
  ];
  const WEBLLM_CDN = "https://esm.run/@mlc-ai/web-llm";

  /* Simple device-aware pick — favors a small model on modest devices,
     the recommended mid-size one otherwise. Not literal model-merging
     (that needs a real training pipeline) — this is what actually
     ships: one "Bardi" experience that quietly picks a good open model. */
  function recommendedLocalModel() {
    const mem = (typeof navigator !== "undefined" && navigator.deviceMemory) || 8;
    if (mem <= 4) return LOCAL_MODELS.find(m => m.id === "Llama-3.2-1B-Instruct-q4f16_1-MLC");
    return LOCAL_MODELS.find(m => m.recommended) || LOCAL_MODELS[0];
  }

  let localEngine = null;
  let localEngineModelId = null;
  let localEngineLoading = null; // in-flight load promise, so concurrent calls share it

  function localSupported() {
    return typeof navigator !== "undefined" && !!navigator.gpu;
  }

  function localStatus() {
    return { ready: !!localEngine, modelId: localEngineModelId };
  }

  /* Loads (or reuses) the WebLLM engine for the given model, reporting
     download/compile progress via onProgress({text, progress}). */
  async function ensureLocalEngine(modelId, onProgress) {
    if (!localSupported()) throw new Error("WEBGPU_UNSUPPORTED");
    if (localEngine && localEngineModelId === modelId) return localEngine;
    if (localEngineLoading && localEngineModelId === modelId) return localEngineLoading;

    localEngineModelId = modelId;
    localEngineLoading = (async () => {
      const webllm = await import(/* webpackIgnore: true */ WEBLLM_CDN);
      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report) => {
          if (onProgress) onProgress({ text: report.text || "", progress: report.progress || 0 });
        },
      });
      localEngine = engine;
      return engine;
    })();

    try {
      return await localEngineLoading;
    } catch (e) {
      localEngine = null;
      localEngineModelId = null;
      throw e;
    } finally {
      localEngineLoading = null;
    }
  }

  /* ── Coach persona system prompt ── */
  function coachSystem(state) {
    const p = state.profile;
    const langNames = {
      ar: "Egyptian Arabic (العامية المصرية) — warm, simple, everyday masri like a close Egyptian friend; use فصحى only for Quran/quotes",
      en: "English",
      fr: "French",
      de: "German",
      es: "Spanish",
    };
    const lang = langNames[state.settings.language] || langNames.ar;

    let sys =
`You are "Bardi" (بردي) — a world-class life coach and gentle therapist, created with coach Ayser Elrifay. The name Bardi comes from papyrus (ورق البردي): the first canvas humans used to record thoughts, stories and ideas and send them to the world. You help people write the story of their own life. You are deeply empathetic, wise, practical and warm, like a trusted friend who truly listens.

How you work:
- ALWAYS reply in ${lang}, unless the user clearly writes in another language — then mirror their language.
- When speaking Egyptian Arabic: be natural and simple (بلاش تكلّف)، زي صاحب قريب بيطمّنك ويشدّ من ضهرك.
- Keep answers SHORT and human: 2–6 sentences usually. One question at a time. Never lecture or dump long lists unless asked.
- Be encouraging but honest. Celebrate small wins. Normalize struggle.

Ask before you advise (this matters a lot):
- Don't jump to advice on the first message. A real coach asks 2–4 grounding questions first: what's the situation, exactly? how do they feel about it? what have they already tried? what does "better" look like to them? Only after you understand the specific person, moment, and feeling do you offer a concrete suggestion — generic advice to a stranger is worthless; specific advice to someone you understand is gold.
- Keep questions short and one at a time, never a checklist. Let the conversation breathe like a real one would.

Emotional intelligence:
- Name and reflect the feeling before problem-solving it ("that sounds exhausting" before "here's what to do"). People need to feel understood before they can hear a suggestion.
- Notice what's underneath the words — stress often hides as irritation, fear often hides as procrastination. Gently name what you notice, as a question, not a diagnosis.
- Regulate before you strategize: for real distress, first offer a small grounding step (a breath, naming the feeling, a moment of quiet) — then, once they're steadier, help them think.

Social intelligence — be a practically useful friend, not just a listener:
- When someone mentions a real-world situation (a proposal/engagement, a job interview, a wedding, a big meeting, moving house), think like a friend who'd actually help: budget considerations, what to wear, logistics, timing, a thoughtful gift idea, who to ask for help. Offer 1–2 concrete, practical suggestions, not a generic list.
- If a specific nearby place would genuinely help them (a shop, a tailor, a florist, a venue), you may suggest they search for it and end your reply with a separate final line so the app can offer a one-tap map search:
MAP: <short, general search query, e.g. "menswear tailor" or "flower shop"> — never a specific address, never fabricate a business name.
- Only use MAP when it's genuinely useful in the moment; don't force it into every reply.

Life organization — universal wisdom, told without naming any religion:
- Draw on timeless principles of a well-ordered, meaningful life: structured daily rhythm, a few minutes of real quiet/reflection each day, gratitude, patience, honesty, generosity, strong family and community ties, treating your body and time as things worth caring for, regulating anger and impulse, keeping promises.
- Speak of these in universal, secular language that fits anyone regardless of faith or culture — e.g. suggest "a few minutes of quiet reflection" or "your own practice, whatever that looks like for you," not a specific religious ritual. Never assume or state someone's religion, and never describe a practice (prayer times, fasting, rituals) as if it applies to everyone.
- Exception: if the user tells you their own faith or practice (e.g. they mention salah, church, meditation, shabbat), meet them there specifically and respect it fully — you're adapting to what they've told you about themselves, not assuming it.

Calendar — when someone mentions a real appointment, meeting, or event with a rough date/time, offer to save it (never save silently). End your reply with a separate final line:
EVENT: <short title> | <YYYY-MM-DD> | <HH:MM or "">  | <one short note or "">
- Only emit this when they've given you an actual date or clear enough time ("tomorrow at 6", "next Thursday morning"); resolve relative dates using today's date: ${new Date().toISOString().slice(0, 10)}. If the time is unclear, leave the HH:MM field empty rather than guessing.
- Use it only when it's clearly useful; don't manufacture an event from vague chatter.

Honest discussion — you can disagree, kindly:
- You're a real conversation partner, not a yes-machine. When you see it differently, say so — but always start from what's right or understandable in their view ("فاهم ليه شايفها كده، وفيه جزء حقيقي في كلامك...") before offering the other side. Disagree with the idea, never with the person.
- If they state something factually wrong, correct it gently and without embarrassing them — frame it as new information, not as their mistake ("في نقطة هنا ممكن تكون اتغيرت..." / "المعلومة الأدق إن..."). Never mock, never say "غلط" bluntly, never make anyone feel stupid for asking or believing something.
- Admit not knowing, plainly and without shame, instead of inventing an answer. Not knowing and finding out together beats a confident wrong answer every time.
${state.settings.webSearch !== false ? `
Web lookup — when you genuinely don't know:
- If they ask a factual question you're unsure about, or about something recent that may have changed since your knowledge, do NOT guess. Reply with only a very short natural line (e.g. "ثواني، خليني أتأكدلك 🔎") and end with a separate final line:
SEARCH: <a short, focused search query in the best language for the topic>
- The app will fetch encyclopedia results and hand them back to you; then answer warmly and naturally from them, weaving the facts in like a knowledgeable friend — mention "بصيت في ويكيبيديا" casually only if it fits. If the results don't actually answer it, say honestly that you couldn't confirm.
- Use SEARCH only for real factual gaps (people, places, events, dates, definitions, how-things-work) — never for feelings, personal advice, or things you already know well. At most one SEARCH per question.` : ""}

How you think (reason before you answer):
- Before replying, think it through internally: what is the person really asking beneath the words? what do you already know about them? what would genuinely help vs. just sound nice? Consider a couple of angles, then give the one clear, grounded response — never show this internal reasoning, only the final warm answer.
- Understand deeply, don't pattern-match. Connect what they say now to their goal, values and past messages. If something doesn't add up, gently ask instead of assuming.
- Be honest and specific over generic. A real, slightly harder truth delivered kindly beats an empty reassurance.

Memory — you learn about the person over time, on your own, without being told to:
- When you learn something genuinely important and lasting about the user (a value, fear, pattern, preference, life fact), end your reply with a separate final line:
MEMORY: <one short sentence in English capturing it>
- Use it rarely (only for real insights). Never mention this mechanism to the user.

Output format: if you emit MEMORY / EVENT / MAP / SEARCH lines, each goes on its own final line, in that order if more than one applies, after your normal warm reply — never inside the reply text itself, and never mention these tags exist to the user.`;

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
    if (state.videos && state.videos.length) {
      sys += `\n\nVideos/skills they're studying (you can reference or encourage progress on these, but you cannot watch them):\n- ` +
        state.videos.slice(-15).map(v => v.title + (v.notes ? ` (${v.notes})` : "")).join("\n- ");
    }
    if (state.events && state.events.length) {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = state.events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
      if (upcoming.length) {
        sys += `\n\nUpcoming things on their calendar (reference naturally if relevant, e.g. checking in before something stressful):\n- ` +
          upcoming.map(e => `${e.title} — ${e.date}${e.time ? " " + e.time : ""}`).join("\n- ");
      }
    }
    if (state.journal && state.journal.length) {
      const recent = state.journal.slice(-5);
      sys += `\n\nRecent private journal entries they chose to share with you (use gently, only if relevant — never quote them back verbatim):\n- ` +
        recent.map(j => (j.mood ? `[${j.mood}] ` : "") + j.text.slice(0, 200)).join("\n- ");
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
  async function chat(state, messages, onDelta, onProgress) {
    const provider = state.settings.provider;
    const key = (state.settings.keys[provider] || "").trim();
    const needsNoKey = provider === "free" || provider === "local";

    // Demo mode (trial build only): if a keyless endpoint is unreachable in a
    // sandboxed preview, fall back to canned Egyptian coaching so the UI still talks.
    if (!needsNoKey && !key) {
      if (typeof window !== "undefined" && window.BARDI_DEMO) return demoReply(state, messages, onDelta);
      throw new Error("NO_KEY");
    }

    const lastUser = [...messages].reverse().find(m => m.role === "user");
    const sys = withKnowledge(coachSystem(state), state, lastUser ? lastUser.content : "");

    if (provider === "local") {
      try {
        return await chatLocal(state, sys, messages, onDelta, onProgress);
      } catch (e) {
        // Preview sandboxes can't reach the model CDN or lack WebGPU — degrade to demo.
        if (typeof window !== "undefined" && window.BARDI_DEMO) return demoReply(state, messages, onDelta);
        throw e;
      }
    }
    if (provider === "free") {
      try {
        return await chatFree(sys, messages, onDelta);
      } catch (e) {
        // Preview sandboxes block external calls — degrade to demo so it still responds.
        if (typeof window !== "undefined" && window.BARDI_DEMO) return demoReply(state, messages, onDelta);
        throw e;
      }
    }
    if (provider === "claude") return chatClaude(key, sys, messages, onDelta);
    if (provider === "openai") return chatOpenAI(key, sys, messages, onDelta);
    if (provider === "gemini") return chatGemini(key, sys, messages, onDelta);
    throw new Error("Unknown provider");
  }

  /* ── On-device open-source model chat (WebLLM, streaming) ── */
  async function chatLocal(state, system, messages, onDelta, onProgress) {
    const modelId = state.settings.localModel || LOCAL_MODELS[0].id;
    let engine;
    try {
      engine = await ensureLocalEngine(modelId, onProgress);
    } catch (e) {
      if (e.message === "WEBGPU_UNSUPPORTED") throw new Error("WEBGPU_UNSUPPORTED");
      throw new Error("Couldn't load the local model: " + (e.message || e));
    }

    const stream = await engine.chat.completions.create({
      stream: true,
      messages: [{ role: "system", content: system }, ...messages.map(m => ({ role: m.role, content: m.content }))],
    });

    let full = "";
    for await (const chunk of stream) {
      const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
      if (delta) { full += delta; onDelta(full); }
    }
    return full;
  }

  /* ── Free open-model provider (keyless, streaming, OpenAI-compatible) ── */
  async function chatFree(system, messages, onDelta) {
    const res = await fetch(FREE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELS.free,
        stream: true,
        messages: [{ role: "system", content: system }, ...messages.map(m => ({ role: m.role, content: m.content }))],
      }),
    });
    if (!res.ok) throw new Error(await apiErr(res));

    let full = "";
    await readSSE(res, (data) => {
      if (data === "[DONE]") return;
      try {
        const ev = JSON.parse(data);
        const d = ev.choices && ev.choices[0] && (ev.choices[0].delta || ev.choices[0].message);
        if (d && d.content) { full += d.content; onDelta(full); }
      } catch (_) {}
    });
    return full;
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
        messages: [{ role: "system", content: system }, ...messages.map(m => ({ role: m.role, content: m.content }))],
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

  /* ── One-shot text completion (no persona, no history) — used by Studio
     for scene/shot-prompt writing help. Reuses whichever provider/key the
     user already configured; never streams, just returns the final text. */
  async function completeText(state, prompt, onProgress) {
    const provider = state.settings.provider;
    const key = (state.settings.keys[provider] || "").trim();
    const needsNoKey = provider === "free" || provider === "local";
    if (!needsNoKey && !key) throw new Error("NO_KEY");

    const sys = "You are a concise, skilled creative writing assistant.";
    const messages = [{ role: "user", content: prompt }];
    const noop = () => {};
    if (provider === "local") return chatLocal(state, sys, messages, noop, onProgress);
    if (provider === "free") return chatFree(sys, messages, noop);
    if (provider === "claude") return chatClaude(key, sys, messages, noop);
    if (provider === "openai") return chatOpenAI(key, sys, messages, noop);
    if (provider === "gemini") return chatGemini(key, sys, messages, noop);
    throw new Error("Unknown provider");
  }

  /* ── Extract trailing MEMORY: / EVENT: / MAP: / SEARCH: lines from a reply ── */
  function extractMemory(text) {
    let clean = text;
    let memory = null, event = null, map = null, search = null;

    const mSearch = clean.match(/\n?\s*SEARCH:\s*(.+?)\s*$/m);
    if (mSearch) { search = mSearch[1].trim(); clean = clean.slice(0, mSearch.index).trimEnd(); }

    const mMem = clean.match(/\n\s*MEMORY:\s*(.+?)\s*$/m);
    if (mMem) { memory = mMem[1].trim(); clean = clean.slice(0, mMem.index).trimEnd(); }

    const mMap = clean.match(/\n\s*MAP:\s*(.+?)\s*$/m);
    if (mMap) { map = mMap[1].trim(); clean = clean.slice(0, mMap.index).trimEnd(); }

    const mEvt = clean.match(/\n\s*EVENT:\s*(.+?)\s*$/m);
    if (mEvt) {
      const parts = mEvt[1].split("|").map(s => s.trim());
      const [title, date, time, note] = parts;
      if (title && /^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
        event = { title, date, time: (time && /^\d{2}:\d{2}$/.test(time)) ? time : "", note: note || "" };
      }
      clean = clean.slice(0, mEvt.index).trimEnd();
    }

    return { clean, memory, event, map, search };
  }

  /* ── Web lookup (Wikipedia only, CORS-friendly, keyless) ──
     Privacy: only the short search query is sent to Wikipedia — never the
     conversation, profile, or anything else. The app shows a visible
     "searching…" line in the chat whenever this runs, and it can be
     turned off entirely in Settings. */
  async function webSearch(query, lang) {
    const wikis = [];
    if (lang && lang !== "en") wikis.push(lang);
    wikis.push("en");

    for (const w of wikis) {
      try {
        const url = `https://${w}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&prop=extracts&exintro=1&explaintext=1&exchars=900&format=json&origin=*`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const j = await res.json();
        const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
        if (!pages.length) continue;
        pages.sort((a, b) => (a.index || 99) - (b.index || 99));
        const parts = pages
          .filter(p => p.extract && p.extract.trim())
          .map(p => `## ${p.title}\n${p.extract.trim()}`);
        if (parts.length) return { source: `${w}.wikipedia.org`, text: parts.join("\n\n") };
      } catch (_) { /* try the next wiki */ }
    }
    return null;
  }

  /* ── Plan generation (non-streaming, JSON) ── */
  async function generatePlan(state, goal) {
    const provider = state.settings.provider;
    const key = (state.settings.keys[provider] || "").trim();
    if (provider !== "free" && provider !== "local" && !key) throw new Error("NO_KEY");

    const langNames = { ar: "Arabic", en: "English", fr: "French", de: "German", es: "Spanish" };
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
    if (provider === "local") {
      const modelId = state.settings.localModel || LOCAL_MODELS[0].id;
      const engine = await ensureLocalEngine(modelId, null);
      const res = await engine.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      text = (res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || "";
    } else if (provider === "free") {
      const res = await fetch(FREE_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: MODELS.free,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(await apiErr(res));
      const j = await res.json();
      text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
    } else if (provider === "claude") {
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

  /* ── Demo responder (trial only) — warm Egyptian coaching, no network ── */
  async function demoReply(state, messages, onDelta) {
    const lang = state.settings.language || "ar";
    const name = (state.profile.name || "").trim();
    const lastUser = ([...messages].reverse().find(m => m.role === "user") || {}).content || "";
    const low = lastUser.toLowerCase();

    const pick = (obj) => {
      const has = (arr) => arr.some(w => low.includes(w));
      if (has(["نظم","يوم","خطط","وقت","plan","day","organ","jour"])) return obj.plan;
      if (has(["ضغط","توتر","قلق","تعب","زهق","stress","anxious","tired","stressé"])) return obj.stress;
      if (has(["هدف","حلم","goal","dream","objectif"])) return obj.goal;
      if (has(["نفسي","هويتي","مين","who am i","identit","اعرف نفسي"])) return obj.identity;
      return obj.default;
    };

    const R = {
      ar: {
        plan: `تمام يا${name ? " " + name : ""} 🌿 خلينا نبسّطها. بلاش تفكر في اليوم كله مرة واحدة — قوللي بس: إيه *أهم* حاجة واحدة لو عملتها النهارده هتحس إن يومك مشي صح؟ ابدأ بيها، والباقي هنرتّبه سوا.`,
        stress: `حاسس بيك، والإحساس ده طبيعي جدًا وإنت مش لوحدك فيه. خُد نفس عميق كده معايا 🌬️. قوللي — الضغط ده جاي من حاجة واحدة معيّنة، ولا كتير متكوّمين فوق بعض؟ أول ما نسمّيهم بيخفّوا.`,
        goal: `الهدف ده جميل ✨ بس خليني أسألك سؤال مهم: *ليه* الهدف ده بالذات؟ إيه اللي هيتغيّر في حياتك لو وصلتله؟ الإجابة دي هي وقودك لما الحماس يقل.`,
        identity: `سؤال جامد إنك بتدوّر على ده 🙏. طيب نبدأ من هنا: افتكر لحظة حسّيت فيها إنك "ده أنا بجد" — إمتى كانت؟ وإيه اللي كنت بتعمله؟ اللحظات دي بتقول عليك أكتر من أي كلام.`,
        default: `أنا معاك وسامعك 🌿. احكيلي أكتر — إيه اللي حاسس بيه دلوقتي بالظبط؟ مفيش إجابة غلط، أنا هنا عشان أفهمك مش أحكم عليك.`,
      },
      en: {
        plan: `Alright${name ? " " + name : ""} 🌿 let's keep it simple. Don't try to plan the whole day at once — just tell me: what's the *one* thing that, if you did it today, would make the day feel right? Start there.`,
        stress: `I hear you, and what you're feeling is completely human. Take one deep breath with me 🌬️. Tell me — is this pressure coming from one specific thing, or a pile of things stacked together? Naming them makes them lighter.`,
        goal: `Beautiful goal ✨ — but let me ask the real question: *why* this goal? What changes in your life when you reach it? That answer is your fuel when motivation dips.`,
        identity: `I love that you're asking this 🙏. Let's start here: think of a moment you felt truly like yourself. When was it, and what were you doing? Those moments say more about you than any label.`,
        default: `I'm here and I'm listening 🌿. Tell me more — what are you feeling right now, exactly? There's no wrong answer; I'm here to understand you, not judge you.`,
      },
      fr: {
        plan: `D'accord${name ? " " + name : ""} 🌿 restons simples. N'essaie pas de planifier toute la journée d'un coup — dis-moi juste : quelle est la *seule* chose qui, si tu la faisais aujourd'hui, rendrait ta journée réussie ? Commence par là.`,
        stress: `Je te comprends, et ce que tu ressens est tout à fait humain. Respire profondément avec moi 🌬️. Dis-moi — cette pression vient-elle d'une chose précise, ou de plusieurs empilées ? Les nommer les allège.`,
        goal: `Bel objectif ✨ — mais la vraie question : *pourquoi* celui-ci ? Qu'est-ce qui change dans ta vie quand tu l'atteins ? Cette réponse sera ton carburant.`,
        identity: `J'aime que tu te poses cette question 🙏. Commençons ici : pense à un moment où tu t'es senti pleinement toi-même. Quand était-ce, et que faisais-tu ?`,
        default: `Je suis là et je t'écoute 🌿. Dis-m'en plus — que ressens-tu exactement maintenant ? Il n'y a pas de mauvaise réponse.`,
      },
    };

    const full = pick(R[lang] || R.ar);
    // stream it word by word for a live feel
    let out = "";
    const parts = full.split(/(\s+)/);
    for (const p of parts) {
      out += p;
      onDelta(out);
      await new Promise(r => setTimeout(r, 22));
    }
    return out;
  }

  /* ── Preload a local model from Settings (before any chat message) ── */
  async function loadLocalModel(modelId, onProgress) {
    return ensureLocalEngine(modelId, (report) => {
      if (onProgress) onProgress(Math.round((report.progress || 0) * 100));
    });
  }

  return { chat, generatePlan, completeText, extractMemory, webSearch, MODELS, PROVIDER_NAMES, LOCAL_MODELS, localSupported, localStatus, loadLocalModel, recommendedLocalModel };
})();
