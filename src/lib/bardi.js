/* ─── BARDI, THE INVISIBLE FACILITATOR ────────────────────────────────
   Ayser: "a standalone, open-ended chatbot contradicts our offline-first
   and anti-scrolling philosophy … Bardi should only appear as
   contextual, minimalist prompts inside existing flows". And: keep it
   simple, no chatter, few questions, fast.

   So Bardi is not a screen any more. It is three small things:

     · THE GAME MASTER — a conversation that has gone quiet gets one
       line offering a quick game (this file decides when);
     · THE CULTURE CONCIERGE — the two-question care check the first
       time you message a stranger (VibeCheckSheet, enforced by the
       database);
     · THE SILENT MATCHMAKER — once in a while, one notification when
       a few people near you are into the same thing right now, with an
       offer to make it a hangout (bardi_match() in RUN_ME.sql).

   Pure, so it can be checked without a phone:

       node scripts/check-bardi.mjs
*/

export const QUIET_MIN = 4;            // minutes of silence before Bardi says anything
export const STALE_DAYS = 3;           // after this the chat is not "quiet", it is over
export const SNOOZE_HOURS = 24;        // dismissed once, gone for a day

/* Should the Game Master offer a game in this conversation now?
   Only when both people have spoken (it is a conversation, not a
   one-sided request), the last message is a few minutes old but the
   chat is still recent, no game is already open, and it was not
   dismissed in the last day. */
export function shouldNudge({ msgs, meId, now = Date.now(), dismissedAt = 0, gameOpen = false }) {
  if (gameOpen) return false;
  const list = (msgs || []).filter((m) => m && m.createdAt);
  if (list.length < 2) return false;
  const mine = list.some((m) => m.from === 'me' || (meId && m.userId === meId));
  const theirs = list.some((m) => m.from !== 'me' && (!meId || m.userId !== meId));
  if (!mine || !theirs) return false;
  const last = Math.max(...list.map((m) => new Date(m.createdAt).getTime()).filter(Number.isFinite));
  if (!Number.isFinite(last)) return false;
  const quiet = now - last;
  if (quiet < QUIET_MIN * 60000 || quiet > STALE_DAYS * 86400000) return false;
  if (dismissedAt && now - dismissedAt < SNOOZE_HOURS * 3600000) return false;
  return true;
}

/* Which game: the same one for the same conversation, so it does not
   flicker between offers, and both games get offered across chats. */
export function nudgeGame(threadKey) {
  let h = 0; for (const ch of String(threadKey || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % 2 === 0 ? 'tod' : 'wyr';
}

/* The matchmaker's notification body is "count|hobby"; the phone writes
   the sentence in the reader's language and picks the kind of hangout
   the hobby sounds like. */
export function readMatch(body) {
  const [n, ...rest] = String(body || '').split('|');
  const what = rest.join('|').trim();
  const count = parseInt(n, 10);
  if (!what || !Number.isFinite(count) || count < 2) return null;
  const w = what.toLowerCase();
  const kind = /run|jog|marathon|جري|běh|jooks/.test(w) ? 'run'
    : /walk|hik|trek|مشي|procház|matk/.test(w) ? 'walk'
    : /coffee|café|cafe|قهوة|káv|kohv/.test(w) ? 'coffee'
    : /football|soccer|sport|كورة|fotbal|jalgpall/.test(w) ? 'sport'
    : 'focus';
  return { count, what, kind };
}
