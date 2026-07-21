import { supabase } from '../lib/supabase';

/* User feedback → the owner's Studio inbox. Real rows, owner-only reads. */

export const FEEDBACK_KINDS = [
  { code: 'idea', label: '💡 Idea' },
  { code: 'bug', label: '🐞 Bug' },
  { code: 'love', label: '❤️ Love it' },
  { code: 'other', label: '✋ Other' },
];

export async function sendFeedback(userId, kind, body) {
  const { error } = await supabase.from('feedback').insert({ user_id: userId || null, kind: kind || 'idea', body: (body || '').trim() });
  if (error) {
    if (/does not exist|schema cache|feedback/i.test(error.message || '')) throw new Error('Run RUN_ME.sql once to turn on feedback.');
    throw error;
  }
  return true;
}

export async function fetchFeedback() {
  const { data, error } = await supabase
    .from('feedback')
    .select('*, user:profiles!feedback_user_id_fkey(name, handle, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function markFeedbackSeen(id) {
  try { await supabase.from('feedback').update({ status: 'seen' }).eq('id', id); } catch (e) {}
}

/* Lightweight live stats for the Studio — real counts, never invented. */
export async function fetchStudioStats() {
  const count = async (table, filter) => {
    try {
      let q = supabase.from(table).select('id', { count: 'exact', head: true });
      if (filter) q = filter(q);
      const { count: c } = await q;
      return c || 0;
    } catch (e) { return 0; }
  };
  const [users, posts, tracks, openReports, newFeedback] = await Promise.all([
    count('profiles'),
    count('posts'),
    count('tracks'),
    count('content_reports', (q) => q.eq('status', 'open')),
    count('feedback', (q) => q.eq('status', 'new')),
  ]);
  return { users, posts, tracks, openReports, newFeedback };
}
