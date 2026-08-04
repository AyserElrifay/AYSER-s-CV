/* ─── WHICH CONVERSATIONS ARE NEW TO YOU ──────────────────────────────
   A chat list is only readable at a glance if it can tell you where
   something is waiting. Ours couldn't: the unread count was hardcoded
   to zero, so every row looked identical whether somebody had just
   written to you or you'd been ignoring each other for a week.

   Making that real needs one fact — when did you last look at this
   conversation — and that fact belongs to this phone, not to the
   database. Nobody else needs to know when you read something, and a
   read receipt is a promise we haven't made anyone. So it lives in
   local storage: opening a thread stamps it, and a thread whose newest
   message arrived after that stamp, from the other person, is new.

   The "from the other person" half matters. Your own last message is
   never news to you, and a list that lit up for your own words would be
   worse than one that never lit up at all. */

const KEY = 'mm_seen_threads_v1';
const MAX = 300;   // plenty; a phone that has seen 300 threads can forget the oldest

function read() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch (e) { return {}; }
}

function write(o) {
  try {
    if (typeof localStorage === 'undefined') return;
    const keys = Object.keys(o);
    if (keys.length > MAX) {
      // drop the oldest stamps, keep the recent ones
      keys.sort((a, b) => o[b] - o[a]);
      const trimmed = {};
      keys.slice(0, MAX).forEach((k) => { trimmed[k] = o[k]; });
      o = trimmed;
    }
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch (e) {}
}

/* You just looked at it. */
export function markThreadSeen(threadId) {
  if (!threadId) return;
  const o = read();
  o[threadId] = Date.now();
  write(o);
}

export function lastSeen(threadId) {
  if (!threadId) return 0;
  const v = read()[threadId];
  return typeof v === 'number' ? v : 0;
}

/* Is there something here you haven't looked at? Needs the newest
   message's time and who wrote it. Unknowable → false, because a row
   that cries wolf is worse than a quiet one.

   A thread you have never opened counts as new only if the last word
   was theirs — otherwise starting a chat would mark your own greeting
   unread the moment you sent it. */
export function isUnread(threadId, lastAt, lastFromUserId, myId) {
  if (!threadId || !lastAt) return false;
  if (!lastFromUserId || !myId) return false;
  if (lastFromUserId === myId) return false;          // your own words
  const at = new Date(lastAt).getTime();
  if (!isFinite(at)) return false;
  return at > lastSeen(threadId);
}
