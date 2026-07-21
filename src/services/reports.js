import { supabase } from '../lib/supabase';

/* Reports & takedowns — the legal shield. Every report is a real row in
   content_reports, so infringing or abusive content can be flagged and
   removed. This is what keeps the app owner protected under DMCA-style
   safe harbour: users report, you act. */

export const REPORT_REASONS = [
  { code: 'copyright', label: '© Copyright / I own this', hint: 'This uses my music, video or work without permission' },
  { code: 'abuse', label: '🚫 Abuse or harassment', hint: 'Bullying, threats or hate' },
  { code: 'sexual', label: '🔞 Sexual or explicit', hint: 'Nudity or sexual content' },
  { code: 'violence', label: '⚠️ Violence or danger', hint: 'Violent or dangerous content' },
  { code: 'spam', label: '📣 Spam or scam', hint: 'Fake, misleading or spammy' },
  { code: 'other', label: '✋ Something else', hint: 'Tell us what’s wrong' },
];

/* File a report. contentType: 'track' | 'post' | 'comment' | 'story' |
   'user'. Returns the inserted row. Throws readable errors so the UI can
   nudge the user to run the SQL if the table isn't there yet. */
export async function reportContent({ reporterId, contentType, contentId, reason, detail }) {
  const { data, error } = await supabase
    .from('content_reports')
    .insert({
      reporter_id: reporterId || null,
      content_type: contentType,
      content_id: String(contentId),
      reason: reason || 'other',
      detail: (detail || '').trim() || null,
    })
    .select()
    .single();
  if (error) {
    if (/does not exist|schema cache|content_reports/i.test(error.message || '')) {
      throw new Error('One step left: run supabase/RUN_ME.sql to turn on reporting.');
    }
    throw error;
  }
  return data;
}

/* ── Owner Studio: read & action the report queue ─────────────────── */
export async function fetchReports(status) {
  let q = supabase.from('content_reports').select('*, reporter:profiles!content_reports_reporter_id_fkey(name, handle)').order('created_at', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
export async function setReportStatus(id, status) {
  const { error } = await supabase.from('content_reports').update({ status }).eq('id', id);
  if (error) throw error;
  return true;
}
