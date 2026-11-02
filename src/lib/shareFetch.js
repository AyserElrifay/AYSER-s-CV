/* ─── ONE QUESTION, ONE ANSWER ────────────────────────────────────────
   Ayser, November 2026: "بيرلود حجات فوق بعض". Switching tabs asked the
   server the same thing again and again — your profile six times in one
   tour of the tabs, the settings three times — and each answer redrew the
   screen under you. Now the same question asked while one is on its way
   waits for that one, and an answer stays good for a few seconds. A write
   forgets the key (forget). */
const store = new Map();   // key → { at, promise, value, ok }

export function share(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit) {
    if (hit.promise) return hit.promise;                     // already on its way
    if (hit.ok && now - hit.at < ttlMs) return Promise.resolve(hit.value);
  }
  const promise = Promise.resolve().then(fn).then(
    (value) => { store.set(key, { at: Date.now(), value, ok: true }); return value; },
    (e) => { store.delete(key); throw e; },
  );
  store.set(key, { at: now, promise });
  return promise;
}

export function forget(prefix) {
  for (const k of Array.from(store.keys())) if (k === prefix || k.startsWith(prefix)) store.delete(k);
}
