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

/* Send the conversation to Bardi and get its reply.
   messages: [{ role:'user'|'assistant', content:string }]
   opts: { language?: 'ar'|'en'|…, profile?: { name, bio } } */
export async function askBardi(messages, opts = {}) {
  if (!SUPABASE_READY) {
    throw new Error('Bardi needs the app connected to Supabase first.');
  }
  const body = {
    messages: (messages || []).map((m) => ({ role: m.role, content: m.content })),
    language: opts.language || 'en',
  };
  if (opts.profile) body.profile = opts.profile;

  const { data, error } = await supabase.functions.invoke('bardi-chat', { body });
  if (error) {
    // The Edge Function isn't deployed / reachable yet — be honest.
    throw new Error('bardi-unavailable');
  }
  const reply = (data && (data.reply || data.message || data.content)) || '';
  if (!reply) throw new Error('bardi-empty');
  return reply;
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
