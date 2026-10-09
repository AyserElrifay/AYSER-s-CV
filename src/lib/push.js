import { Platform } from 'react-native';
import { supabase, SUPABASE_READY } from './supabase';
import { SUPABASE_URL } from './supabaseConfig';
import { isIos, b64ToBytes, readOpenTarget } from './pushCore';

export { isIos, b64ToBytes, readOpenTarget };

/* ─── ON THE PHONE, EVEN WITH THE APP CLOSED ──────────────────────────
   Web push: the browser subscribes with the public key the `push`
   function hands out (supabase/functions/push), the subscription is
   kept by push_subscribe(), and public/sw.js shows what arrives.

   Asked for once, at a moment it obviously helps — after you said
   you are coming to something — and never on first open. On an iPhone
   the browser only allows it once Moments is on the Home Screen, and
   the screen says exactly that instead of a button that does nothing. */

const FN = (SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/push';
const ASKED = 'moments.pushAsked';

const web = () => Platform.OS === 'web' && typeof window !== 'undefined' && typeof navigator !== 'undefined';

const standalone = () => {
  try { return !!(window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)); }
  catch (e) { return false; }
};

/* 'ok' | 'ios_install' (iPhone, not on the Home Screen yet) | 'no' */
export function pushSupport() {
  if (!web() || !SUPABASE_READY) return 'no';
  if (isIos() && !standalone()) return 'ios_install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no';
  return 'ok';
}

/* 'on' | 'off' | 'denied' | 'ios_install' | 'no' */
export async function pushState() {
  const s = pushSupport();
  if (s !== 'ok') return s;
  if (window.Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub && window.Notification.permission === 'granted' ? 'on' : 'off';
  } catch (e) { return 'off'; }
}

const bytesToB64 = (buf) => {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/* { ok } or { ok:false, reason: 'denied'|'not_ready'|'ios_install'|'no'|'server' } */
export async function enablePush(lang) {
  const s = pushSupport();
  if (s !== 'ok') return { ok: false, reason: s };
  markAsked();
  const perm = await window.Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  try {
    const res = await fetch(FN, { method: 'GET' });
    const j = res.ok ? await res.json() : null;
    if (!j || !j.publicKey) return { ok: false, reason: 'not_ready' };
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(j.publicKey) });
    const { data, error } = await supabase.rpc('push_subscribe', {
      p_endpoint: sub.endpoint,
      p_p256dh: bytesToB64(sub.getKey('p256dh')),
      p_auth: bytesToB64(sub.getKey('auth')),
      p_lang: lang || 'en',
    });
    if (error || !data || !data.ok) return { ok: false, reason: 'server' };
    return { ok: true };
  } catch (e) { return { ok: false, reason: 'not_ready' }; }
}

export async function disablePush() {
  if (pushSupport() !== 'ok') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await supabase.rpc('push_unsubscribe', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
  } catch (e) {}
}

/* the one-time ask after a join */
export function wasAsked() { try { return localStorage.getItem(ASKED) === '1'; } catch (e) { return true; } }
export function markAsked() { try { localStorage.setItem(ASKED, '1'); } catch (e) {} }

/* ── tapping a notification ── public/sw.js opens ?tab=… or
   ?notifications=1, or tells an already-open app the same thing. */
export function takeLaunchTarget() {
  if (!web()) return null;
  const t = readOpenTarget(window.location.href);
  if (t) {
    try { window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[?&](notifications|tab)=[^&]*/g, '').replace(/^&/, '?') + window.location.hash); } catch (e) {}
  }
  return t;
}
export function onPushOpen(fn) {
  if (!web() || !('serviceWorker' in navigator)) return () => {};
  const h = (e) => { const d = e.data || {}; if (d.type === 'open') { const t = readOpenTarget(d.url); if (t) fn(t); } };
  navigator.serviceWorker.addEventListener('message', h);
  return () => navigator.serviceWorker.removeEventListener('message', h);
}
