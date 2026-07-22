import { Platform } from 'react-native';

/* ─── Bardi Local — Ayser's OWN model, running on the user's device ───
   This is Bardi as its own model under Ayser's control: a real open-weight
   model (Ayser's choice) running ENTIRELY inside the browser via WebLLM
   (WebGPU). No Claude, no third-party API, no key — after a one-time
   download nothing about the conversation ever leaves the device.

   It's "Ayser's model" in every sense that matters:
     · his chosen open weights (Llama / Qwen / Gemma …),
     · his Bardi persona baked into the system prompt,
     · fully swappable for his OWN fine-tuned weights (Bardi-3B) the moment
       they're published — just point BARDI_MODEL to the custom MLC model
       (see CUSTOM_BARDI_MODEL below). No other code changes needed.

   Web-only: WebGPU + the WebLLM runtime exist in the browser, not in
   React Native native. On native this module reports "unsupported" and
   the app falls back to the cloud Bardi. */

// The open models Bardi can run on-device today (MLC-quantised, from the
// WebLLM model registry). Device-aware pick below chooses a good default.
export const BARDI_LOCAL_MODELS = [
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 · 3B', size: '~1.9 GB', recommended: true },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 · 1B', size: '~0.7 GB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 · 1.5B', size: '~1.0 GB' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 · 2B', size: '~1.6 GB' },
];

/* ── When Bardi-3B (Ayser's own fine-tuned weights) is published in MLC
   format on Hugging Face, fill this in and it becomes the brain — WebLLM
   loads a custom model from its URL via appConfig. Until then it's null
   and Bardi runs on the open model picked below. ──
   Example:
     { id: 'Bardi-3B-q4f16_1-MLC',
       url: 'https://huggingface.co/ayser/Bardi-3B-q4f16_1-MLC/resolve/main/',
       libUrl: 'https://huggingface.co/ayser/Bardi-3B-q4f16_1-MLC/resolve/main/Bardi-3B.wasm' } */
export const CUSTOM_BARDI_MODEL = null;

const WEBLLM_CDN = 'https://esm.run/@mlc-ai/web-llm';

// Metro (Expo web's bundler) rewrites a normal dynamic import() and would
// try to resolve this external URL at build time. Building the import via
// the Function constructor hides it from the bundler so it stays a real,
// runtime browser import.
const importESM = (url) => new Function('u', 'return import(u)')(url);

export function bardiLocalSupported() {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.gpu;
}

export function pickBardiModel() {
  const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 8;
  if (mem <= 4) return BARDI_LOCAL_MODELS.find((m) => m.id.includes('1B')) || BARDI_LOCAL_MODELS[0];
  return BARDI_LOCAL_MODELS.find((m) => m.recommended) || BARDI_LOCAL_MODELS[0];
}

const LANG_NAMES = {
  ar: 'Egyptian Arabic (العامية المصرية) — warm, simple, everyday masri like a close Egyptian friend; use فصحى only for Quran/quotes',
  en: 'English', fr: 'French', de: 'German', es: 'Spanish',
};

/* The Bardi persona — the same brain the Bardi web app uses, tuned a bit
   tighter for a small on-device model (short prompt = more room to think). */
function bardiSystem(language, profile) {
  const lang = LANG_NAMES[language] || LANG_NAMES.ar;
  let sys = `You are "Bardi" (بردي) — a warm, wise life coach and gentle therapist created with coach Ayser Elrifay. The name comes from papyrus (ورق البردي): the first canvas people used to write their thoughts. You help people write the story of their own life.

- ALWAYS reply in ${lang}, unless the user clearly writes another language — then mirror it. In Egyptian Arabic be natural and simple, زي صاحب قريب بيطمّنك.
- Keep answers SHORT and human: 2–6 sentences. One question at a time. No long lists unless asked.
- Ask before you advise: on the first messages, ask 1–2 grounding questions (what's the situation, how do they feel, what have they tried) before giving specific advice.
- Name the feeling before fixing it ("that sounds heavy" before "here's what to do"). For real distress, offer a small grounding step first.
- Be honest and kind — you can gently disagree. Celebrate small wins. Light Egyptian humor, بذوق, only when the mood allows.
- Reply with your message only, nothing else.`;
  if (profile && (profile.name || profile.bio)) {
    sys += `\n\nYou're talking to ${profile.name || 'someone'}${profile.bio ? ` (${profile.bio})` : ''}.`;
  }
  return sys;
}

let engine = null;
let engineModelId = null;
let loading = null;

export function bardiEngineReady() {
  return { ready: !!engine, modelId: engineModelId };
}

/* Load (or reuse) the on-device engine, reporting download/compile
   progress via onProgress({ text, progress }). The model is cached by the
   browser after the first download, so later loads are instant/offline. */
export async function ensureBardiEngine(onProgress) {
  if (!bardiLocalSupported()) throw new Error('WEBGPU_UNSUPPORTED');
  const model = CUSTOM_BARDI_MODEL || pickBardiModel();
  const modelId = model.id;
  if (engine && engineModelId === modelId) return engine;
  if (loading && engineModelId === modelId) return loading;

  engineModelId = modelId;
  loading = (async () => {
    const webllm = await importESM(WEBLLM_CDN);
    const opts = {
      initProgressCallback: (r) => { if (onProgress) onProgress({ text: r.text || '', progress: r.progress || 0 }); },
    };
    // A custom Bardi-3B model is loaded via an explicit appConfig entry.
    if (CUSTOM_BARDI_MODEL && CUSTOM_BARDI_MODEL.url) {
      opts.appConfig = {
        model_list: [{ model: CUSTOM_BARDI_MODEL.url, model_id: modelId, model_lib: CUSTOM_BARDI_MODEL.libUrl }],
      };
    }
    const eng = await webllm.CreateMLCEngine(modelId, opts);
    engine = eng;
    return eng;
  })();

  try { return await loading; }
  catch (e) { engine = null; engineModelId = null; throw e; }
  finally { loading = null; }
}

/* Chat with Bardi entirely on-device. Streams tokens via onToken(fullText)
   so the reply appears as it's written — important, since a small on-device
   model is slower than a datacenter. Returns the final text. */
export async function askBardiLocal(messages, opts = {}, onToken) {
  const eng = await ensureBardiEngine(opts.onProgress);
  const sys = bardiSystem(opts.language || 'ar', opts.profile);
  const hist = (messages || []).slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || ''),
  }));
  const chat = [{ role: 'system', content: sys }, ...hist];

  const stream = await eng.chat.completions.create({
    messages: chat, stream: true, temperature: 0.7, max_tokens: 800,
  });
  let full = '';
  for await (const chunk of stream) {
    const delta = (chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || '';
    if (delta) { full += delta; onToken && onToken(full); }
  }
  return full.trim();
}
