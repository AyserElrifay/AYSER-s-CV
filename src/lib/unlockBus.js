/* ─── WHEN SOMETHING HAS TO BE EARNED ─────────────────────────────────
   The database refuses two things to somebody brand new — messaging a
   stranger and hosting something big — until they pass the care check
   or have joined one small hangout (RUN_ME.sql, GO OUT NOW). Wherever
   the refusal comes back, it is announced here once, and the one
   listener in the tab shell opens the check. Ten call sites do not
   each need to know about it. */
const subs = new Set();
export const isNeedUnlock = (e) => /need_unlock/.test(String((e && (e.message || e.reason)) || e || ''));
export function requestUnlock(why) { subs.forEach((fn) => { try { fn(why); } catch (e) {} }); }
export function onUnlockRequest(fn) { subs.add(fn); return () => subs.delete(fn); }
