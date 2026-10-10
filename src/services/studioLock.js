import { supabase } from '../lib/supabase';

/* ─── THE STUDIO'S SECOND STEP ────────────────────────────────────────
   Supabase's own multi-factor sign-in, so the result is signed into the
   session token and checked by the database on every Studio action
   (studio_fresh in RUN_ME.sql — a second step in the last 30 minutes).
   Two kinds, and having both is wise:
     · a passkey — Face ID / Touch ID / a fingerprint on this phone;
     · a code from an authenticator app (Google Authenticator, 1Password…),
       which still works when the phone with the passkey is lost. */

export async function lockFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return { passkeys: [], codes: [], stale: [] };
  const all = data.all || [];
  return {
    passkeys: all.filter((f) => f.factor_type === 'webauthn' && f.status === 'verified'),
    codes: all.filter((f) => f.factor_type === 'totp' && f.status === 'verified'),
    stale: all.filter((f) => f.status !== 'verified'),
  };
}

/* half-finished set-ups block a new one with the same name: cleared first */
async function clearStale() {
  const { stale } = await lockFactors();
  for (const f of stale) { try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch (e) {} }
}

export const passkeySupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential;

export async function addPasskey() {
  await clearStale();
  const r = await supabase.auth.mfa.webauthn.register({ friendlyName: 'Moments Studio · ' + new Date().toISOString().slice(0, 16) });
  if (r.error) throw r.error;
  return r.data;
}

export async function unlockWithPasskey(factorId) {
  const r = await supabase.auth.mfa.webauthn.authenticate({ factorId });
  if (r.error) throw r.error;
  return r.data;
}

/* The QR arrives as raw SVG text after "data:image/svg+xml;utf-8,",
   quotes and all — which an image on the web cannot draw. Re-wrapped as
   base64, it is an ordinary picture. */
const asImage = (qr) => {
  if (!qr || !/^data:image\/svg\+xml/.test(qr) || /;base64,/.test(qr)) return qr || null;
  let svg = qr.slice(qr.indexOf(',') + 1);
  try { svg = decodeURIComponent(svg); } catch (e) {}
  try { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); } catch (e) { return qr; }
};

/* { id, qr, secret } — the QR is an image the authenticator app scans */
export async function startCode() {
  await clearStale();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Moments Studio ' + Date.now() });
  if (error) throw error;
  return { id: data.id, qr: asImage(data.totp && data.totp.qr_code), secret: data.totp && data.totp.secret };
}

export async function unlockWithCode(factorId, code) {
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: String(code || '').replace(/\D/g, '') });
  if (error) throw error;
  return data;
}

/* what went wrong, in words */
export const lockError = (e) => {
  const m = String((e && (e.message || e.code)) || '').toLowerCase();
  if (/notallowed|cancel|abort|timed out/.test(m)) return 'Cancelled — try again.';
  if (/webauthn|not enabled|disabled|unsupported|mfa_webauthn/.test(m)) return 'Face ID / fingerprint is not switched on for this project yet — use a code for now.';
  if (/invalid|code|expired/.test(m)) return 'That code did not work — codes change every 30 seconds.';
  return 'Did not work — try again.';
};
