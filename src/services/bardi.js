import { supabase, SUPABASE_READY } from '../lib/supabase';

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

function bardiSystem(language, profile) {
  const lang = LANG_NAME[language] || "the user's language";
  let p = `You are Bardi, a warm, sharp personal assistant living inside Moments — a social app by Ayser.
You help people understand themselves, grow, plan trips and start projects.
Be concise, kind and practical. Ask one question at a time when you need more. Always reply in ${lang}.`;
  if (profile && (profile.name || profile.bio)) {
    p += `\nYou're talking to ${profile.name || 'someone'}${profile.bio ? ` (bio: ${profile.bio})` : ''}.`;
  }
  return p;
}

/* Fallback that talks to Bardi straight from the browser — free, needs no
   Edge Function deploy. Uses Pollinations (CORS-open) so Bardi is alive the
   moment the app loads. Real AI, not a canned reply. */
async function askBardiDirect(messages, opts) {
  const sys = bardiSystem(opts.language || 'en', opts.profile);
  const hist = (messages || []).slice(-8);

  // 1) GET endpoint — simplest, no CORS preflight, most reliable in a browser.
  try {
    const convo = hist.map((m) => (m.role === 'assistant' ? 'Bardi' : 'User') + ': ' + String(m.content || '')).join('\n');
    const prompt = convo + '\nBardi:';
    const url = 'https://text.pollinations.ai/' + encodeURIComponent(prompt)
      + '?model=openai&referrer=moments&system=' + encodeURIComponent(sys);
    const r = await fetch(url);
    if (r.ok) {
      const text = (await r.text()).trim();
      if (text && !/^\s*(error|not found|<)/i.test(text)) return text;
    }
  } catch (e) { /* try POST */ }

  // 2) POST OpenAI-style endpoint as a backup.
  try {
    const res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'openai', referrer: 'moments',
        messages: [{ role: 'system', content: sys }, ...hist.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const reply = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
      if (reply) return reply;
    }
  } catch (e) { /* fall through */ }

  throw new Error('bardi-unavailable');
}

/* Send the conversation to Bardi and get its reply.
   messages: [{ role:'user'|'assistant', content:string }]
   opts: { language?: 'ar'|'en'|…, profile?: { name, bio } }

   Prefers Ayser's deployed bardi-chat Edge Function (his real Bardi); if
   it isn't deployed yet, falls back to talking to Bardi directly from the
   browser so it always works. */
export async function askBardi(messages, opts = {}) {
  const body = {
    messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
    language: opts.language || 'en',
  };
  if (opts.profile) body.profile = opts.profile;

  // 1) the deployed Edge Function, when available
  if (SUPABASE_READY) {
    try {
      const { data, error } = await supabase.functions.invoke('bardi-chat', { body });
      const reply = !error && data && (data.reply || data.message || data.content);
      if (reply) return reply;
    } catch (e) { /* not deployed yet → fall through */ }
  }
  // 2) live fallback, straight from the browser
  return askBardiDirect(messages, opts);
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
