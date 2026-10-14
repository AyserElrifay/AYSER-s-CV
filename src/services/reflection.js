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
export const myJourney = async () => { const r = await call('my_journey'); return Array.isArray(r) ? r : []; };
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

/* a month in your words — counted on the phone from your own answers */
export function monthSummary(rows, now = new Date()) {
  const y = now.getFullYear(); const m = now.getMonth();
  const inMonth = rows.filter((r) => { const d = new Date(r.day); return d.getFullYear() === y && d.getMonth() === m; });
  const days = new Set(rows.map((r) => String(r.day).slice(0, 10)));
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    if (days.has(k)) streak += 1; else if (i > 0) break;
  }
  const moods = inMonth.map((r) => r.mood).filter(Boolean);
  const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const STOP = new Set('the a an and or of to in on at for with my me i is it was this that we you so but be are am our your just very really من في على و يا انا أنا ده دي اللي مع عن كان كانت هو هي'.split(' '));
  const count = new Map();
  inMonth.forEach((r) => String(r.body || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).forEach((w) => {
    if (w.length < 3 || STOP.has(w)) return;
    count.set(w, (count.get(w) || 0) + 1);
  }));
  const words = [...count.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  return { count: inMonth.length, streak, mood: avg ? MOODS[Math.max(0, Math.min(4, Math.round(avg) - 1))] : null, words };
}
