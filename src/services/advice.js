import { supabase } from '../lib/supabase';

/* Bardi's advice on one Studio item — see supabase/functions/studio-advice.
   kind: 'host' (ref = the applicant's id) | 'venue' (venue id) |
   'report' (content report id). Advice only: every decision stays a
   button a person presses. Kept on the server, so asking twice is free
   unless `refresh` is set. */
export async function askAdvice(kind, ref, { lang, refresh } = {}) {
  const { data, error } = await supabase.functions.invoke('studio-advice', { body: { kind, ref, lang: lang || 'en', refresh: !!refresh } });
  if (error) {
    let code = null;
    try { code = (await error.context.json()).error; } catch (e) {}
    return { ok: false, error: code || 'failed' };
  }
  return data || { ok: false, error: 'failed' };
}
