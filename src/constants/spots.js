/* ─── OUT IN CAIRO: REAL PLACES TO MEET ──────────────────────────────
   Ayser: "هنبتدي مؤقتًا بنفس الأماكن". Real, well-known places in
   Cairo — cafés, restaurants, desserts, things to do, sport, wellness —
   by name and the area they are in. That is all that is stored here,
   because it is all that is known for sure:

   · no pin coordinates: a guessed pin is a lie on a map. Directions
     open the phone's maps app searching the place's own name and area,
     which finds the real door;
   · no photos copied off the internet: those belong to the places.
     A place that joins Moments as a partner adds its own;
   · no descriptions copied from anywhere: one plain line of what it is.

   When a place joins, it moves out of this list and into the real
   partner pages. */

export const SPOT_KINDS = [
  { id: 'cafe', emoji: '☕' },
  { id: 'restaurant', emoji: '🍽️' },
  { id: 'dessert', emoji: '🍰' },
  { id: 'fun', emoji: '🎳' },
  { id: 'sports', emoji: '🎾' },
  { id: 'wellness', emoji: '🧘' },
];

/* what: a key in i18n (sp_w_*) — the kind of place, in a few words */
export const SPOTS = [
  // ☕ cafés
  { id: 'soul_lounge', kind: 'cafe', name: 'Soul Lounge', area: 'Korba, Heliopolis', what: 'cafe' },
  { id: 'twenty_grams_g8', kind: 'cafe', name: '20 Grams', area: 'G8, New Cairo', what: 'coffee' },
  { id: 'dancing_goat_nox', kind: 'cafe', name: 'Dancing Goat', area: 'The Nox, New Cairo', what: 'coffee' },
  { id: 'dancing_goat_mivida', kind: 'cafe', name: 'Dancing Goat', area: 'Mivida, New Cairo', what: 'coffee' },
  { id: 'dancing_goat_ivory', kind: 'cafe', name: 'Dancing Goat', area: 'Ivory, Sheikh Zayed', what: 'coffee' },
  { id: 'room_art_space', kind: 'cafe', name: 'Room Art Space', area: 'The Spot, New Cairo', what: 'art' },
  { id: 'seven_fortunes', kind: 'cafe', name: 'Seven Fortunes', area: 'The Drive, New Cairo', what: 'coffee' },
  { id: 'koffee_kulture', kind: 'cafe', name: 'Koffee Kulture', area: 'U Venues, New Cairo', what: 'coffee' },
  { id: 'huff_park_mall', kind: 'cafe', name: 'Huff', area: 'Park Mall, New Cairo', what: 'cafe' },
  // 🍽️ restaurants
  { id: 'esca_heliopolis', kind: 'restaurant', name: 'Esca', area: 'Heliopolis', what: 'restaurant' },
  { id: 'sachi_heliopolis', kind: 'restaurant', name: 'Sachi', area: 'Heliopolis', what: 'restaurant' },
  { id: 'teds_madinaty', kind: 'restaurant', name: "Ted's Pizzeria", area: 'Madinaty', what: 'pizza' },
  { id: 'teds_city_centre', kind: 'restaurant', name: "Ted's Pizzeria", area: 'City Centre Almaza, Heliopolis', what: 'pizza' },
  // 🍰 desserts
  { id: 'bouchee_korba', kind: 'dessert', name: 'Bouchée', area: 'Korba, Heliopolis', what: 'dessert' },
  { id: 'taiyaki_madinaty', kind: 'dessert', name: 'Taiyaki', area: 'All Seasons Park, Madinaty', what: 'taiyaki' },
  { id: 'kbs_g8', kind: 'dessert', name: "KB's Cake Studio", area: 'G8, New Cairo', what: 'cake' },
  // 🎳 things to do
  { id: 'monoplay_almaza', kind: 'fun', name: 'Monoplay', area: 'Almaza, Heliopolis', what: 'boardgames' },
  { id: 'playhaus_maadi', kind: 'fun', name: 'The Playhaus', area: 'Maadi', what: 'boardgames' },
  { id: 'bunker_golden_square', kind: 'fun', name: 'Bunker', area: 'One Golden Square, New Cairo', what: 'bowling' },
  { id: 'ground_control_d5', kind: 'fun', name: 'Ground Control', area: 'District 5, New Cairo', what: 'bowling' },
  { id: 'autovrooom_obour', kind: 'fun', name: 'Autovrooom', area: 'Avenue Mall, Obour', what: 'karting' },
  { id: 'autovrooom_new_cairo', kind: 'fun', name: 'Autovrooom', area: 'New Cairo', what: 'karting' },
  { id: 'rowin_dokki', kind: 'fun', name: 'Rowin', area: 'Dokki, on the Nile', what: 'rowing' },
  // 🎾 sport
  { id: 'padel_point_narges', kind: 'sports', name: 'Padel Point', area: 'Narges, New Cairo', what: 'padel' },
  { id: 'repadel_sunrise', kind: 'sports', name: 'Repadel', area: 'Sunrise, New Cairo', what: 'padel' },
  // 🧘 wellness
  { id: 'sukun_element5', kind: 'wellness', name: 'Sukun Studios', area: 'Element 5, New Cairo', what: 'yoga' },
  { id: 'sukun_west', kind: 'wellness', name: 'Sukun Studios', area: 'Sheikh Zayed', what: 'yoga' },
];

/* the phone's maps app, searching the place's own name — it finds the real door */
export const directionsUrl = (s) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.name + ', ' + s.area + ', Cairo, Egypt');
