import { Platform } from 'react-native';

/* ─── PLACES NEAR A SPOT, WITHOUT THE WHOLE LIST ──────────────────────
   places.json is written by the build (scripts/inject-html.mjs): just
   [id, name, emoji, lat, lng] for every place on the map. Fetched once,
   the first time somebody posts a moment from an outing, and kept. */
let cache = null;
const load = () => {
  if (cache) return cache;
  if (Platform.OS !== 'web' || typeof fetch === 'undefined') return Promise.resolve([]);
  let base = '/';
  try { if (typeof document !== 'undefined' && document.baseURI) base = String(document.baseURI).replace(/[^/]*$/, ''); } catch (e) {}
  cache = fetch(base + 'places.json').then((r) => (r.ok ? r.json() : [])).catch(() => { cache = null; return []; });
  return cache;
};
const rad = (x) => (x * Math.PI) / 180;
const km = (a, b) => {
  const dLat = rad(b.lat - a.lat); const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
/* [{ id, name, emoji, lat, lng, km }] nearest first, within `radius` km */
export async function placesNear(at, radius = 5, n = 5) {
  if (!at || at.lat == null) return [];
  const all = await load();
  return all.map(([id, name, emoji, lat, lng]) => ({ id, name, emoji, lat, lng, km: km(at, { lat, lng }) }))
    .filter((p) => p.km <= radius).sort((a, b) => a.km - b.km).slice(0, n);
}
