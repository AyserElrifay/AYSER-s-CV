/* The Studio is not part of the app.

   It used to sit in the profile menu. Even gated to the owner's account
   that is the wrong place for it: it puts an admin console one tap from
   a normal person's settings, and it tells everyone the console exists.

   Now the only way in is a link that carries ?studio=1 — kept somewhere
   only Ayser has it. The owner check still runs on top, so the link on
   its own opens nothing for anybody else. The parameter is stripped
   from the address bar the moment it's read, so it never ends up in a
   screenshot, a share sheet or a browser history someone else scrolls. */

const PARAM = 'studio';

export function studioRequested() {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    return !!new URLSearchParams(window.location.search).get(PARAM);
  } catch (e) { return false; }
}

export function stripStudioParam() {
  try {
    if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAM)) return;
    url.searchParams.delete(PARAM);
    window.history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
  } catch (e) { /* older browser: leaving the param is harmless */ }
}
