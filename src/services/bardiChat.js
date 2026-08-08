import { supabase, SUPABASE_READY } from '../lib/supabase';

/* ─── KEEPING THE CONVERSATIONS ───────────────────────────────────────
   Bardi's chat lived in React state and nowhere else, so closing the
   sheet threw the whole conversation away — you came back to an empty
   screen every single time. A conversation you cannot leave and return
   to is not a conversation, it is a series of first messages.

   Now there are conversationS. Starting a new one puts the old one
   away rather than destroying it, so "what did Bardi say about that
   trip last week" has an answer. Each is titled by its own first line,
   because a list of "Chat 1, Chat 2" is a list of nothing.

   Kept in two places on purpose:

   ON THE DEVICE, always. That works with no connection, with no table,
   and the instant you reopen — the thread is on screen before anything
   has been asked of a server.

   ON THE ACCOUNT, when the database has somewhere to put it. Then the
   same conversations are there on a laptop as on a phone. If that table
   does not exist yet, nothing breaks and nothing is said: the local
   copy is the record.                                                 */

const KEY = 'mm_bardi_chats';
const CAP_MESSAGES = 200;      // per conversation
const CAP_CHATS = 30;          // conversations kept

const keyFor = (userId) => KEY + ':' + (userId || 'guest');

/* A conversation is { id, title, messages, at }. */
const titleOf = (messages) => {
  const first = (messages || []).find((m) => m.role === 'user' && String(m.content || '').trim());
  const text = first ? String(first.content).trim().replace(/\s+/g, ' ') : '';
  return text ? text.slice(0, 48) : 'New chat';
};

const readLocal = (userId) => {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const rows = raw ? JSON.parse(raw) : null;
    if (Array.isArray(rows)) {
      // the old shape was a bare message list — carry it over as one chat
      if (rows.length && rows[0] && rows[0].role) {
        return [{ id: 'legacy', title: titleOf(rows), messages: rows, at: Date.now() }];
      }
      return rows.filter((c) => c && Array.isArray(c.messages));
    }
    return [];
  } catch (e) { return []; }
};

const writeLocal = (userId, chats) => {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(chats.slice(0, CAP_CHATS))); } catch (e) {}
};

/* Everything, newest first. Local answers instantly; the account's copy
   replaces it only when it is genuinely further along, so a slow round
   trip can never rewind what is already on screen. */
export async function loadChats(userId) {
  const local = readLocal(userId);
  if (!SUPABASE_READY || !userId) return local;
  try {
    const { data, error } = await supabase
      .from('bardi_chats')
      .select('messages')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return local;
    const raw = data.messages;
    const remote = Array.isArray(raw)
      ? (raw.length && raw[0] && raw[0].role
        ? [{ id: 'legacy', title: titleOf(raw), messages: raw, at: Date.now() }]
        : raw.filter((c) => c && Array.isArray(c.messages)))
      : [];
    const count = (list) => list.reduce((n, c) => n + c.messages.length, 0);
    if (count(remote) > count(local)) { writeLocal(userId, remote); return remote; }
    return local;
  } catch (e) { return local; }
}

export function saveChats(userId, chats) {
  const rows = (chats || [])
    .filter((c) => c && c.messages && c.messages.length)
    .map((c) => ({ ...c, title: c.title || titleOf(c.messages), messages: c.messages.slice(-CAP_MESSAGES) }))
    .slice(0, CAP_CHATS);
  writeLocal(userId, rows);
  if (!SUPABASE_READY || !userId) return;
  // best effort, and never in the way of the conversation
  supabase
    .from('bardi_chats')
    .upsert({ user_id: userId, messages: rows, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .then(() => {}, () => {});
}

export function newChat() {
  return { id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6), title: 'New chat', messages: [], at: Date.now() };
}

export const chatTitle = titleOf;

export async function clearAllChats(userId) {
  try { localStorage.removeItem(keyFor(userId)); } catch (e) {}
  if (!SUPABASE_READY || !userId) return;
  try { await supabase.from('bardi_chats').delete().eq('user_id', userId); } catch (e) {}
}
