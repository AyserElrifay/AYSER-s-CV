/* ─── THE "I FORGOT MY PASSWORD" LINK HAS TO LAND SOMEWHERE ──────────
   Ayser: "لو حد نسي الباسورد ده حوار".

   He is right, and the reason was one line of configuration. The app
   asked Supabase to send a reset email, Supabase sent it, the person
   tapped the link, the browser came back to the app carrying the
   recovery token in the address — and the app threw it away, because
   the client was created with `detectSessionInUrl: false`.

   So the link worked, the email worked, and the person arrived back at
   the same login screen with the same password they had already
   forgotten. Every single time. There was no way through at all.

   This reads the token out of the address itself, before anything else
   has a chance to run, and holds on to it. Three reasons to do it here
   rather than by flipping that flag:

     · ORDER. React mounts, Supabase parses, the splash draws — all in
       an order nobody controls. Reading the address at import time
       happens before any of that, so the token cannot be missed.
     · THE ADDRESS BAR. A recovery token in the URL is a password in
       the URL. It is stripped immediately, so it is never in a
       screenshot, never in the back history, and never replayed by a
       refresh. Nothing about this is visible to the person.
     · NOTHING ELSE CHANGES. Sign-in, sign-up and the phone code keep
       the behaviour they already had.

   An expired or already-used link comes back as an error instead of a
   token, and that is carried through too — "this link has expired" is
   a thing somebody can act on; a login screen that silently reappears
   is not.

       node scripts/check-recovery.mjs
*/

/* What came back in the address, read once, at import. */
function readUrl() {
  if (typeof window === 'undefined' || !window.location) return null;
  const { hash, search } = window.location;

  /* Supabase puts the result in the fragment (implicit flow). The query
     string is checked too, because an error can arrive either way. */
  const frag = new URLSearchParams((hash || '').replace(/^#/, ''));
  const query = new URLSearchParams(search || '');
  const get = (k) => frag.get(k) || query.get(k);

  const type = get('type');
  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  const errorCode = get('error_code') || get('error');
  const errorText = get('error_description');

  const isRecovery = type === 'recovery';
  /* An error only belongs to us if it arrived with a recovery link.
     Supabase does not always echo the type back on a failure, so a
     bare otp_expired on a page nobody else is listening to is ours. */
  const expired = !!errorCode && (isRecovery || /expired|invalid/i.test(errorCode + ' ' + (errorText || '')));

  if (!isRecovery && !expired) return null;
  return {
    accessToken: accessToken || null,
    refreshToken: refreshToken || null,
    error: expired ? (errorText || '').replace(/\+/g, ' ') || errorCode : null,
  };
}

/* The token must not stay in the address: it is a credential, and a
   refresh would otherwise replay a link that has already been spent.
   replaceState keeps it out of the back history as well. */
function stripUrl() {
  if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
  try {
    window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[?&](error|error_code|error_description|type|code)=[^&]*/g, '').replace(/^&/, '?'));
  } catch (e) { /* an address we cannot rewrite is still an address that works */ }
}

const found = readUrl();
if (found) stripUrl();

let state = found;

/* True while somebody is coming back from a reset link and has not yet
   chosen a new password. The gate in App.js reads this. */
export function isRecovering() { return !!state; }

/* The message to show if the link was expired or already used. */
export function recoveryError() { return state ? state.error : null; }

/* The pair that turns the link into a signed-in session, so the new
   password can be saved. Null when the link was an error. */
export function recoveryTokens() {
  if (!state || !state.accessToken) return null;
  return { access_token: state.accessToken, refresh_token: state.refreshToken || '' };
}

/* Called once the new password is saved, or when the person gives up
   and goes back to the login screen. */
export function clearRecovery() { state = null; }

/* For the checks: the parser, with no browser involved. */
export function parseRecovery(href) {
  const at = href.indexOf('#');
  const qs = href.indexOf('?');
  const hash = at === -1 ? '' : href.slice(at + 1);
  const search = qs === -1 ? '' : href.slice(qs + 1, at === -1 ? undefined : at);
  const frag = new URLSearchParams(hash);
  const query = new URLSearchParams(search);
  const get = (k) => frag.get(k) || query.get(k);
  const type = get('type');
  const errorCode = get('error_code') || get('error');
  const errorText = get('error_description');
  const isRecovery = type === 'recovery';
  const expired = !!errorCode && (isRecovery || /expired|invalid/i.test(errorCode + ' ' + (errorText || '')));
  if (!isRecovery && !expired) return null;
  return {
    accessToken: get('access_token') || null,
    refreshToken: get('refresh_token') || null,
    error: expired ? (errorText || '').replace(/\+/g, ' ') || errorCode : null,
  };
}
