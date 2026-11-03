/* ─── SMART ARRIVAL RADAR · the small parts ───────────────────────────
   Ayser, November 2026: walking to your table, the phone tells you how
   close you are — by sound and touch, warmer as you get nearer. Here: the
   switch (on by default, one tap off), distance, the sounds (made by the
   browser, nothing downloaded), and the routes (OpenStreetMap's free
   router; there is no free metro router for Cairo, so no metro times). */
const KEY = 'mm.radar';
const listeners = new Set();
export const radarOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } };
export const setRadarOn = (on) => {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
  listeners.forEach((f) => { try { f(!!on); } catch (e) {} });
};
export const onRadarChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

export const metersBetween = (a, b) => {
  if (!a || !b) return null;
  const R = 6371000, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

/* how often the heartbeat comes: 300 m slow → 100 m medium → under 30 m it arrives */
export const pulseEvery = (m) => (m == null || m > 300 ? null : m <= 30 ? 0 : Math.round(500 + (m / 300) * 1300));

let ctx = null;
const audio = () => {
  try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch (e) { return null; }
};
const tone = (freq, at, dur, gain = 0.12, type = 'sine') => {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + at);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g); g.connect(c.destination);
  o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.05);
};
/* a phone only lets a page buzz after the person tapped it once */
const buzz = (p) => { try { const ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p); } catch (e) {} };

/* the warm chime for "300 m away" */
export const chime = () => { tone(659, 0, 0.5); tone(988, 0.12, 0.7, 0.09); buzz([60, 80, 60]); };
/* one soft sonar ping and a heartbeat */
export const ping = () => { tone(880, 0, 0.35, 0.07, 'sine'); buzz([35, 90, 25]); };
/* you are there */
export const arrivalChord = () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 1.1, 0.08)); buzz([80, 60, 80, 60, 160]); };
/* the browser only lets a page make sound after a tap: call this from one */
export const unlockAudio = () => { audio(); };

/* drive and walk, from OpenStreetMap's public router: minutes and a line to draw */
const ROUTER = { drive: 'https://routing.openstreetmap.de/routed-car/route/v1/driving/', walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/' };
export async function routeTo(from, to, mode) {
  if (!from || !to || !ROUTER[mode]) return null;
  try {
    const url = ROUTER[mode] + from[1] + ',' + from[0] + ';' + to[1] + ',' + to[0] + '?overview=simplified&geometries=geojson';
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const rt = j && j.routes && j.routes[0];
    if (!rt) return null;
    return { minutes: Math.max(1, Math.round(rt.duration / 60)), meters: Math.round(rt.distance), line: (rt.geometry && rt.geometry.coordinates || []).map(([lng, lat]) => [lat, lng]) };
  } catch (e) { return null; }
}

/* the system notification, only if the person already allowed notifications */
export const notify = (title, body) => {
  try {
    if (typeof window.Notification === 'undefined' || window.Notification.permission !== 'granted') return false;
    const n = new window.Notification(title, { body, tag: 'mm-radar', renotify: true, silent: true });
    n.onclick = () => { try { window.focus(); window.dispatchEvent(new CustomEvent('mm-open-radar')); } catch (e) {} n.close(); };
    return true;
  } catch (e) { return false; }
};
