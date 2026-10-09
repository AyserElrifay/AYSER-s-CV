import { supabase, SUPABASE_READY } from '../lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabaseConfig';
import { withDeadline } from '../lib/deadline';

/* What the server is told about your brain dump: one word for the kind
   of thing you are doing now, only when it is the kind that is better
   done next to somebody — and nothing at all otherwise. */
export async function setFocus(status, minutes = 120) {
  if (!SUPABASE_READY) return { ok: false, reason: 'offline' };
  try {
    const { data, error } = await withDeadline(supabase.rpc('bardi_set_focus', { p_status: status || null, p_minutes: minutes }));
    if (error) return { ok: false, reason: 'server' };
    return data || { ok: false };
  } catch (e) { return { ok: false, reason: 'offline' }; }
}

/* A voice note → its words, via supabase/functions/bardi-listen
   (Whisper). Nothing is kept on the way. { text } or { error }. */
export async function transcribe(blob, lang) {
  if (!SUPABASE_READY) return { error: 'offline' };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) return { error: 'signed_out' };
    const form = new FormData();
    const ext = /mp4|m4a|aac/.test(blob.type || '') ? 'm4a' : /ogg/.test(blob.type || '') ? 'ogg' : 'webm';
    form.append('file', blob, 'note.' + ext);
    if (lang) form.append('language', lang);
    const res = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/bardi-listen', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON_KEY }, body: form,
    });
    if (res.status === 503 || res.status === 404) return { error: 'not_ready' };
    if (!res.ok) return { error: 'server' };
    const j = await res.json();
    return { text: String((j && j.text) || '') };
  } catch (e) { return { error: 'offline' }; }
}
