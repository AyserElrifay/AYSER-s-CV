import { useMemo } from 'react';

/* ─────────────────────────────────────────────────────────────────────
   useBump — the "Bump" proximity brain.

   Given the live list of visible people, it finds every pair that is
   geographically VERY close (within `radiusM` metres) and returns those
   pairs so the map can draw a "spark / link / bump" between them. This is
   the Bump-style real-time-connection cue: when two people are near each
   other, the map literally connects them.
   ───────────────────────────────────────────────────────────────────── */

const EARTH_R = 6371000; // metres
const toRad = (d) => (d * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* Returns { pairs, midpoint(pair) }.
   pairs: [{ id, a, b, metres, strength }] — strength 0..1 (1 = touching). */
export function useBump(people, radiusM = 120) {
  return useMemo(() => {
    const pairs = [];
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const a = people[i];
        const b = people[j];
        if (!a.coords || !b.coords) continue;
        const metres = haversine(a.coords, b.coords);
        if (metres <= radiusM) {
          pairs.push({
            id: a.id + '~' + b.id,
            a, b, metres,
            strength: 1 - metres / radiusM, // closer = stronger spark
          });
        }
      }
    }
    return { pairs };
  }, [people, radiusM]);
}

export function midpoint(a, b) {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
  };
}
