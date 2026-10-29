import { supabase, SUPABASE_READY } from '../lib/supabase';
import { withDeadline } from '../lib/deadline';

/* ─── REFLECTION · ONE QUESTION A DAY ─────────────────────────────────
   Everything here is decided by the database (RUN_ME.sql "THE FEED ·
   REFLECTION, AND FEW TEXT POSTS"): the day's question, who may see
   whose answers (only after answering), who may suggest a question and
   the Studio's approval. The app asks and shows. */

const call = async (name, args) => {
  if (!SUPABASE_READY) return null;
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    return error ? null : data;
  } catch (e) { return null; }
};
const act = async (name, args) => {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc(name, args || {}));
    if (error) return { ok: false, reason: /fetch|network/i.test(error.message || '') ? 'offline' : 'server' };
    return data || { ok: false, reason: 'empty' };
  } catch (e) { return { ok: false, reason: 'offline' }; }
};

export const reflectionToday = () => call('reflection_today');
export const reflect = (body, mood) => act('reflect', { p_body: body, p_mood: mood || null });
export const myPromptAccess = () => call('my_prompt_access');
export const submitPrompt = (body) => act('submit_prompt', { p_body: body });
export const myTextLeft = () => call('my_text_left');

/* the Studio's side — refused by the database for anybody else */
export const ownerPrompts = () => call('owner_prompts');
export const ownerSchedulePrompt = (day, body) => act('owner_schedule_prompt', { p_day: day, p_body: body });
export const ownerDecidePrompt = (id, approve, day) => act('owner_decide_prompt', { p_id: id, p_approve: !!approve, p_day: day || null });

/* the question when the database cannot be asked (offline, or before
   it is set up): the same pool the server rotates through, so it is
   never a different question for long */
const POOL = [
  'What is one small thing that made you smile today?',
  'Share a quiet moment you lived this week.',
  'Who made your day a little better, and how?',
  'What did you see outside today that you liked?',
  'What is something you are looking forward to?',
];
export const fallbackPrompt = () => {
  const d = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 864e5);
  return { body: POOL[((d % POOL.length) + POOL.length) % POOL.length], by: null };
};

export const MOODS = ['😔', '😐', '🙂', '😊', '🤩'];
