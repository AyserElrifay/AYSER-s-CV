import { supabase } from '../lib/supabase';

/* Habits together (supabase/RUN_ME.sql, "HABITS TOGETHER"): a habit,
   a six-letter code, a streak each. The day is this phone's own date. */
export const today = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
};

export const myHabits = () => rpc('my_habits', { p_today: today() }).then((r) => r || []);
export const createHabit = (name, emoji) => rpc('habit_create', { p_name: name, p_emoji: emoji });
export const joinHabit = (code) => rpc('habit_join', { p_code: code });
export const checkHabit = (id, on) => rpc('habit_check', { p_habit: id, p_day: today(), p_on: !!on });
export const leaveHabit = (id) => rpc('habit_leave', { p_habit: id });
