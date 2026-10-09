/* ─── OPEN A CHAT FROM ANYWHERE ───────────────────────────────────────
   "Chat" on a plan you are going to opens that plan's group chat. The
   request waits here until the Chats tab takes it — mounted already, or
   a moment from now — the same pattern as src/lib/mapBus.js. */
let pending = null;
const subs = new Set();
export function openChat(chat) {
  if (!chat || !chat.id) return;
  pending = chat;
  subs.forEach((fn) => { try { fn(); } catch (e) {} });
}
export function takeChat() { const c = pending; pending = null; return c; }
export function onOpenChat(fn) { subs.add(fn); return () => subs.delete(fn); }
