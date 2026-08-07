import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── KEEPING THE CONVERSATION ────────────────────────────────────────
   Bardi's chat lived in React state and nowhere else, so closing the
   sheet threw the whole conversation away — you came back to an empty
   screen every single time. A conversation you cannot leave and return
   to is not a conversation, it is a series of first messages.

   It is kept in two places on purpose:

   ON THE DEVICE, always. That works with no connection, with no table,
   and the instant you reopen the sheet — the thread is on screen before
   anything has been asked of a server.

   ON THE ACCOUNT, when the database has somewhere to put it. Then the
   same conversation is there on a laptop as on a phone. If that table
   does not exist yet, nothing breaks and nothing is said: the local copy
   is the conversation.                                                */

const KEY = 'mm_bardi_chat';
const CAP = 120;                 // messages kept; older ones fall off the top

const keyFor = (userId) => KEY + ':' + (userId || 'guest');

const readLocal = (userId) => {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const rows = raw ? JSON.parse(raw) : null;
    return Array.isArray(rows) ? rows : [];
  } catch (e) { return []; }
};

const writeLocal = (userId, messages) => {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(messages.slice(-CAP))); } catch (e) {}
};

/* What to show the moment the sheet opens. Local first because it is
   instant; the account's copy replaces it only if it is genuinely
   further along, so a slow round trip can never rewind what you are
   already reading. */
export async function loadChat(userId) {
  const local = readLocal(userId);
  if (!SUPABASE_READY || !userId) return local;
  try {
    const { data, error } = await supabase
      .from('bardi_chats')
      .select('messages')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return local;
    const remote = Array.isArray(data.messages) ? data.messages : [];
    if (remote.length > local.length) { writeLocal(userId, remote); return remote; }
    return local;
  } catch (e) { return local; }
}

export function saveChat(userId, messages) {
  const rows = (messages || []).slice(-CAP);
  writeLocal(userId, rows);
  if (!SUPABASE_READY || !userId) return;
  // best effort, and never in the way of the conversation
  supabase
    .from('bardi_chats')
    .upsert({ user_id: userId, messages: rows, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .then(() => {}, () => {});
}

export async function clearChat(userId) {
  try { localStorage.removeItem(keyFor(userId)); } catch (e) {}
  if (!SUPABASE_READY || !userId) return;
  try { await supabase.from('bardi_chats').delete().eq('user_id', userId); } catch (e) {}
}
