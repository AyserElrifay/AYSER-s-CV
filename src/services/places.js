/* ── REAL PLACES · OpenStreetMap (Overpass API) ────────────────────
   Genuinely real venues around the user's GPS — restaurants, cafés,
   bars, fast food, bakeries. Free, worldwide, no API key, no scraping.
   This is how we put real places on the map. Waffarha / Talabat have no
   public feed we can pull client-side, so the honest bridge is: real
   place data from OSM + an affiliate "order/deal" action on tap. */

const OVERPASS = 'https://overpass-api.de/api/interpreter';

const EMOJI = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', pub: '🍺', fast_food: '🍔',
  bakery: '🥐', ice_cream: '🍦', food_court: '🍱',
};

const LABEL = {
  restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', pub: 'Pub',
  fast_food: 'Fast food', bakery: 'Bakery', ice_cream: 'Ice cream', food_court: 'Food court',
};

/* Fetch real venues within `radius` metres of a coordinate. */
export async function fetchNearbyPlaces({ latitude, longitude }, radius = 1600) {
  const q = `[out:json][timeout:20];
    (
      node["amenity"~"restaurant|cafe|bar|pub|fast_food|ice_cream|food_court"](around:${radius},${latitude},${longitude});
      node["shop"="bakery"](around:${radius},${latitude},${longitude});
    );
    out body 60;`;
  try {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.elements || [])
      .filter((e) => e.tags && e.tags.name && e.lat && e.lon)
      .slice(0, 50)
      .map((e) => {
        const kind = e.tags.amenity || (e.tags.shop === 'bakery' ? 'bakery' : 'restaurant');
        return {
          id: 'osm_' + e.id,
          name: e.tags.name,
          lat: e.lat,
          lng: e.lon,
          kind,
          emoji: EMOJI[kind] || '📍',
          category: LABEL[kind] || 'Place',
          cuisine: e.tags.cuisine ? e.tags.cuisine.replace(/_/g, ' ').split(';')[0] : null,
          address: [e.tags['addr:street'], e.tags['addr:city']].filter(Boolean).join(', ') || null,
        };
      });
  } catch (e) {
    return []; // offline / rate-limited → map just shows fewer pins, never crashes
  }
}
