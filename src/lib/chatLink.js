/* ─── A GROUP CHAT'S INVITE LINK ──────────────────────────────────────
   …/?chat=<token> is read once as the app starts and kept until the
   person is signed in — somebody new makes an account first — then the
   app shows what they were invited to and asks before joining
   (JoinChatSheet). The address bar is cleaned straight away. */
const KEY = 'mm.chat.link';
const TOKEN = /^[a-f0-9]{16}$/i;

(function readOnce() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const q = new URLSearchParams(window.location.search);
    const tok = q.get('chat');
    if (!tok) return;
    if (TOKEN.test(tok)) localStorage.setItem(KEY, tok);
    q.delete('chat');
    const rest = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
  } catch (e) { /* no storage: the link simply does nothing */ }
}());

export function pendingChatLink() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
export function clearChatLink() { try { localStorage.removeItem(KEY); } catch (e) {} }
