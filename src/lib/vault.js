/* ─── THE PHONE'S OWN SHELF (IndexedDB) ───────────────────────────────
   Ayser, November 2026: "WhatsApp-style, local-first". What is heavy and
   only yours stays on this phone: the full photos and drawings of your
   Moments Book (the server keeps a small copy), and the conversations you
   have opened (the server is asked only for what is new).

   One database, one store of key → value (a Blob or plain data). It is
   wiped on sign out (AuthContext), so the next person on this phone sees
   nothing of yours. Where IndexedDB is missing (some private windows)
   every call quietly does nothing and the app reads from the server as
   before. */
const DB = 'moments-vault';
const STORE = 'kv';
let opening = null;

function db() {
  const idb = typeof window !== 'undefined' ? window.indexedDB : undefined;
  if (!idb) return Promise.resolve(null);
  if (!opening) {
    opening = new Promise((resolve) => {
      try {
        const req = idb.open(DB, 1);
        req.onupgradeneeded = () => { try { req.result.createObjectStore(STORE); } catch (e) {} };
        req.onsuccess = () => {
          const d = req.result;
          // signing out deletes this database: step aside so it happens now, not after a reload
          d.onversionchange = () => { try { d.close(); } catch (e) {} opening = null; urls.clear(); };
          resolve(d);
        };
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  return opening;
}

function run(mode, fn) {
  return db().then((d) => new Promise((resolve) => {
    if (!d) return resolve(null);
    try {
      const tx = d.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req && 'result' in req ? req.result : true);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch (e) { resolve(null); }
  }));
}

export const vaultGet = (key) => run('readonly', (s) => s.get(key)).then((v) => (v === undefined ? null : v));
export const vaultSet = (key, value) => run('readwrite', (s) => s.put(value, key));
export const vaultDel = (key) => run('readwrite', (s) => s.delete(key));

/* the full-size copy of a Book photo or drawing, if this phone has it, as an address an <Image> can show */
const urls = new Map();
export async function localCopy(serverUrl) {
  if (!serverUrl) return null;
  if (urls.has(serverUrl)) return urls.get(serverUrl);
  const blob = await vaultGet('book:' + serverUrl);
  if (!blob || typeof blob === 'string') return null;
  const u = URL.createObjectURL(blob);
  urls.set(serverUrl, u);
  return u;
}
export const keepLocalCopy = (serverUrl, blob) => (serverUrl && blob ? vaultSet('book:' + serverUrl, blob) : null);

/* a conversation as this phone last saw it: { at, rows } */
export const chatGet = (threadId) => vaultGet('chat:' + threadId);
export const chatSet = (threadId, rows) => vaultSet('chat:' + threadId, { at: Date.now(), rows: (rows || []).slice(-400) });
