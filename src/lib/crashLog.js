/* ─── WHAT ACTUALLY WENT WRONG ────────────────────────────────────────
   A screen that says "that bit didn't open" is the right thing to show
   a person. It is useless to whoever has to fix it. The error React
   caught was written to the console in development and thrown away
   everywhere else, which means a crash on a real phone left nothing
   behind at all — and the only way to work out the cause was to guess,
   which is how the last round of this went.

   So every failure is kept. Message, stack, screen, time, in a capped
   ring in local storage: enough to fix something, small enough that it
   can never grow into a problem, and never sent anywhere.

   None of it is ever shown to an ordinary user. The screen they see
   is exactly what it was. The detail appears only for the owner
   account, because the person who can act on "TypeError: undefined is
   not an object (evaluating 'x.name')" is the one building the app. */

const KEY = 'mm_crashes_v1';
const MAX = 12;

/* Only the owner sees the detail. Set from the auth layer, off until
   somebody says otherwise, so a stranger can never trip into it. */
let diagnostics = false;
export function setDiagnostics(on) { diagnostics = !!on; }
export function diagnosticsOn() { return diagnostics; }

function read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function write(arr) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX))); } catch (e) {}
}

/* Record one. `where` says which part of the app — 'Chats', 'upload',
   'send' — because the same message means different things in
   different places. Returns the one-line summary it stored, so a
   caller can show it without formatting it a second time. */
export function note(where, err, extra) {
  const msg = (err && (err.message || err.error_description || err.error)) || String(err || 'unknown');
  const entry = {
    at: new Date().toISOString(),
    where: String(where || '?'),
    msg: String(msg).slice(0, 300),
    stack: String((err && err.stack) || '').split('\n').slice(0, 6).join('\n').slice(0, 700),
    code: (err && (err.code || err.statusCode || err.status)) || null,
    extra: extra ? String(extra).slice(0, 200) : null,
  };
  const arr = read();
  arr.unshift(entry);
  write(arr);
  if (typeof console !== 'undefined' && console.warn) console.warn('[' + entry.where + '] ' + entry.msg);
  return entry;
}

export function recent() { return read(); }
export function clearCrashes() { write([]); }

/* One line per failure, for reading or copying out. */
export function asText() {
  return read().map((e) =>
    e.at.replace('T', ' ').slice(0, 19) + '  [' + e.where + '] ' + e.msg +
    (e.code ? ' (code ' + e.code + ')' : '') +
    (e.extra ? '\n    ' + e.extra : '') +
    (e.stack ? '\n    ' + e.stack.split('\n').join('\n    ') : '')
  ).join('\n\n') || 'Nothing has failed since this was last cleared.';
}

/* Errors that never reach a React boundary — a rejected upload nobody
   awaited, a script error — leave no trace otherwise. Installed once,
   at startup. */
let installed = false;
export function installCrashLog() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    if (!e) return;
    note('window', e.error || new Error(e.message || 'script error'), e.filename ? e.filename + ':' + e.lineno : null);
  });
  window.addEventListener('unhandledrejection', (e) => {
    note('promise', (e && e.reason) || new Error('unhandled rejection'));
  });
}
