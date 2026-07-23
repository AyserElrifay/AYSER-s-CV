import { supabase, SUPABASE_READY } from '../lib/supabase';
import { loadBardiBrain, addBardiMemory } from './bardiOwner';

/* ─── Bardi — Ayser's AI, living inside Moments ───────────────────────
   Bardi has no separate server: it runs as a Supabase Edge Function
   ('bardi-chat') deployed on THIS project, so we just invoke it. The
   function takes a chat history + optional profile/language and returns
   a single reply. With ANTHROPIC_API_KEY set it's sharper; without one
   it still answers free via Pollinations. Everything here is real — if
   the function isn't deployed yet, we say so honestly instead of faking
   an answer. */

export const BARDI_READY = SUPABASE_READY;

const LANG_NAME = {
  ar: 'Arabic', en: 'English', fr: 'French', es: 'Spanish', tr: 'Turkish',
  pt: 'Portuguese', ro: 'Romanian', it: 'Italian', nl: 'Dutch', ru: 'Russian',
  zh: 'Chinese', ko: 'Korean', ja: 'Japanese',
};

function bardiSystem(language, profile, brain) {
  const lang = LANG_NAME[language] || "the user's language";
  let p = `You are Bardi, a warm, sharp personal assistant living inside Moments — a social app by Ayser.
You help people understand themselves, grow, plan trips and start projects.
Be concise, kind and practical. Ask one question at a time when you need more. Always reply in ${lang}.`;
  if (profile && (profile.name || profile.bio)) {
    p += `\nYou're talking to ${profile.name || 'someone'}${profile.bio ? ` (bio: ${profile.bio})` : ''}.`;
  }
  // owner-authored steering + knowledge ("books"), and this user's memory
  if (brain && brain.instructions) {
    p += `\n\nOwner guidance (follow this):\n${String(brain.instructions).slice(0, 4000)}`;
  }
  if (brain && brain.knowledge && brain.knowledge.length) {
    const kb = brain.knowledge.slice(0, 8).map((k) => `• ${k.title}: ${String(k.content || '').slice(0, 1200)}`).join('\n');
    p += `\n\nKnowledge you can draw on:\n${kb}`;
  }
  if (brain && brain.memory && brain.memory.length) {
    p += `\n\nWhat you remember about this person (from your past chats with them):\n- ` + brain.memory.slice(0, 20).join('\n- ');
  }
  return p;
}

/* fetch with a hard timeout — a hung request must never leave Bardi
   "thinking" forever; it should fail fast so the next provider is tried. */
async function fetchT(url, options, ms) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (e) {} }, ms || 16000);
  try {
    return await fetch(url, { ...(options || {}), signal: ctrl ? ctrl.signal : undefined });
  } finally { clearTimeout(timer); }
}

// A reply is "real" only if it isn't an error page / rate-limit blurb.
function cleanReply(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 2) return null;
  if (/^\s*(\{?\s*"?error|error:|not\s*found|rate.?limit|too many|unauthor|<!doctype|<html|payment required)/i.test(t)) return null;
  return t;
}

async function pollinationsGET(prompt, sys, model) {
  const url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt)
    + '?model=' + encodeURIComponent(model) + '&referrer=moments.app&system=' + encodeURIComponent(sys);
  const r = await fetchT(url, {}, 16000);
  if (!r.ok) return null;
  return cleanReply(await r.text());
}

async function pollinationsPOST(hist, sys, model) {
  const r = await fetchT('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model, referrer: 'moments.app',
      messages: [{ role: 'system', content: sys }, ...hist.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))],
    }),
  }, 18000);
  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  return cleanReply(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
}

/* Fallback that talks to Bardi straight from the browser — free, needs no
   Edge Function deploy. Uses Pollinations (CORS-open) so Bardi is alive the
   moment the app loads. Real AI, not a canned reply.

   Pollinations' free tier is flaky and rate-limits hard, so we're resilient:
   try several models, GET first (short prompts, no preflight) then POST,
   each with a timeout — so one throttled model never sinks the whole thing. */
async function askBardiDirect(messages, opts) {
  const sys = bardiSystem(opts.language || 'en', opts.profile, opts.brain);
  const hist = (messages || []).slice(-8);
  const convo = hist.map((m) => (m.role === 'assistant' ? 'Bardi' : 'User') + ': ' + String(m.content || '')).join('\n') + '\nBardi:';
  // keep GET only when the URL stays sane; long chats go POST-only (a huge
  // URL trips 414 "URI too long" — a real cause of silent failures).
  const getOk = convo.length < 1200;
  const MODELS = ['openai', 'mistral', 'openai-fast', 'llama'];

  let lastErr = null;
  for (const model of MODELS) {
    if (getOk) {
      try { const g = await pollinationsGET(convo, sys, model); if (g) return g; } catch (e) { lastErr = e; }
    }
    try { const p = await pollinationsPOST(hist, sys, model); if (p) return p; } catch (e) { lastErr = e; }
  }
  throw (lastErr || new Error('bardi-unavailable'));
}

/* Send the conversation to Bardi and get its reply.
   messages: [{ role:'user'|'assistant', content:string }]
   opts: { language?: 'ar'|'en'|…, profile?: { name, bio } }

   Prefers Ayser's deployed bardi-chat Edge Function (his real Bardi); if
   it isn't deployed yet, falls back to talking to Bardi directly from the
   browser so it always works. */
export async function askBardi(messages, opts = {}) {
  // Pull the owner's steering + knowledge ("books") and this user's
  // memory, so Bardi is shaped by the owner portal and remembers the
  // person — passed to the model so the endpoint stays a pure
  // pass-through (no server-side reads of anyone's data).
  const remember = opts.remember !== false; // user can turn Bardi's memory off
  let brain = opts.brain;
  if (!brain && SUPABASE_READY) {
    try { brain = await loadBardiBrain(opts.userId, remember); } catch (e) { brain = null; }
  }
  const optsB = { ...opts, brain };

  const body = {
    messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
    language: opts.language || 'en',
  };
  if (opts.profile) body.profile = opts.profile;
  if (brain && brain.instructions) body.instructions = brain.instructions;
  if (brain && brain.knowledge && brain.knowledge.length) body.knowledge = brain.knowledge;
  if (brain && brain.memory && brain.memory.length) body.memory = brain.memory;

  let reply = null;
  // 1) the deployed Edge Function, when available. Race it against a
  //    timeout so a cold/hung function never freezes Bardi — we just
  //    fall through to the live browser fallback instead.
  if (SUPABASE_READY) {
    try {
      const invoke = supabase.functions.invoke('bardi-chat', { body });
      const timeout = new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), 12000));
      const res = await Promise.race([invoke, timeout]);
      if (res && !res.__timeout) {
        const { data, error } = res;
        const r = !error && data && (data.reply || data.message || data.content);
        if (r) reply = r;
      }
    } catch (e) { /* not deployed / errored → fall through */ }
  }
  // 2) live fallback, straight from the browser
  if (!reply) reply = await askBardiDirect(messages, optsB);

  // learn from this chat (the user's OWN conversation with Bardi, consented):
  // remember durable first-person facts — only when memory is left on.
  if (reply && opts.userId && remember) rememberFromChat(opts.userId, messages);
  return reply;
}

/* Lightweight, no-extra-AI memory: when the user states a durable fact
   about themselves ("I'm a…", "my goal is…", "أنا…", "هدفي…"), keep it so
   Bardi recalls it next time. Only the user's own words, only obvious
   self-facts — never stored silently from anyone else's chats. */
const MEMORY_CUES = /\b(i am|i'm|my name is|my goal|i want to|i work|i study|i love|i hate|i feel)\b|أنا |اسمي |هدفي |بحب |بكره |بشتغل |بدرس |نفسي /i;
function rememberFromChat(userId, messages) {
  try {
    const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');
    const text = lastUser && String(lastUser.content || '').trim();
    if (text && text.length >= 8 && text.length <= 300 && MEMORY_CUES.test(text)) {
      addBardiMemory(userId, text);
    }
  } catch (e) { /* non-blocking */ }
}

/* Quick-start intents that give Bardi a helpful, concrete first prompt —
   self-understanding, travel plans, projects: the things Ayser wants it to
   help people with. */
export const BARDI_STARTERS = [
  { id: 'self', emoji: '🪞', title: 'Understand myself', prompt: 'Ask me 3 short questions to help me understand myself better, then give me one insight.' },
  { id: 'travel', emoji: '✈️', title: 'Plan a trip', prompt: 'Help me plan a trip. Ask me where, how many days and my budget, then build a day-by-day plan.' },
  { id: 'project', emoji: '🚀', title: 'Start a project', prompt: 'I want to start a project. Help me turn my idea into a clear first-week plan with concrete steps.' },
  { id: 'grow', emoji: '🌱', title: 'Grow a habit', prompt: 'Help me build one small daily habit that improves my life. Keep it realistic and specific.' },
];
