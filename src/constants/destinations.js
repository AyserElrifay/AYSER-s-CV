/* ── CURATED DESTINATIONS · real places, real coordinates ──────────
   Hand-picked adventure & culture spots across Egypt, Romania, Spain
   and France. Every pin sits at the place's true GPS position; tapping
   one opens the guide sheet (description, community reviews, Uber,
   directions). */

export const DESTINATIONS = [
  // ── 🇪🇬 EGYPT ──
  { id: 'eg_cave_church', country: 'Egypt', flag: '🇪🇬', emoji: '⛪', name: 'St. Simon Cave Church', area: 'Mokattam, Cairo',
    lat: 30.0329, lng: 31.2757, tags: ['Culture', 'Calm'],
    desc: 'A breathtaking monastery carved straight into Mokattam mountain. Vast rock-hewn halls, a deeply peaceful vibe, and one of Cairo\'s most surreal escapes from the noise.' },
  { id: 'eg_mario_ropes', country: 'Egypt', flag: '🇪🇬', emoji: '🧗', name: 'Mario High Ropes', area: 'Mokattam, Cairo',
    lat: 30.0341, lng: 31.2744, tags: ['Adrenaline', 'Groups'],
    desc: 'Ropes courses and ziplines strung between the rocky heights next to the Cave Church. Physical challenges for every fitness level — perfect for a crew day out.' },
  { id: 'eg_giza_complex', country: 'Egypt', flag: '🇪🇬', emoji: '🐫', name: 'Giza Pyramids Plateau', area: 'Giza',
    lat: 29.9773, lng: 31.1325, tags: ['Culture', 'Hiking'],
    desc: 'The legendary plateau — open desert paths for long walks between the monuments and panoramic views where ancient history meets the horizon.' },
  { id: 'eg_khufu', country: 'Egypt', flag: '🇪🇬', emoji: '🔺', name: 'Great Pyramid of Khufu', area: 'Giza',
    lat: 29.9792, lng: 31.1342, tags: ['Adventure', 'Culture'],
    desc: 'The last ancient wonder still standing. Descend through the narrow passages into its inner chambers — a real physical and mental mini-expedition.' },
  { id: 'eg_khafre', country: 'Egypt', flag: '🇪🇬', emoji: '⛰️', name: 'Pyramid of Khafre', area: 'Giza',
    lat: 29.9761, lng: 31.1308, tags: ['Culture', 'Photo'],
    desc: 'Second tallest, still crowned with its original casing stones. The most photogenic angle on the plateau and the visual anchor of the whole complex.' },
  { id: 'eg_queens', country: 'Egypt', flag: '🇪🇬', emoji: '👑', name: 'Queens\' Pyramids', area: 'Giza',
    lat: 29.9785, lng: 31.1365, tags: ['Calm', 'Culture'],
    desc: 'The smaller pyramids on the eastern side — quieter, less crowded, and perfect for slowly taking in the fine architectural details of the ancient necropolis.' },
  { id: 'eg_giza_pass', country: 'Egypt', flag: '🇪🇬', emoji: '🎫', name: 'Giza Pyramids Entrance', area: 'Giza',
    lat: 29.9814, lng: 31.1329, tags: ['Meet point'],
    desc: 'The official gate and ticket point — the natural meetup spot for your squad before heading into the plateau together.' },
  { id: 'eg_coloured_canyon', country: 'Egypt', flag: '🇪🇬', emoji: '🏜️', name: 'Coloured Canyon', area: 'Nuweiba, Sinai',
    lat: 29.0400, lng: 34.5630, tags: ['Hiking', 'Wellbeing'],
    desc: 'Hike through winding rock corridors painted in unreal colours. Camping, silence, and the best kind of digital detox — Sinai at its most magical.' },

  // ── 🇷🇴 ROMANIA ──
  { id: 'ro_transfagarasan', country: 'Romania', flag: '🇷🇴', emoji: '🛣️', name: 'Transfăgărășan', area: 'Carpathians',
    lat: 45.6036, lng: 24.6173, tags: ['Adventure', 'Hiking'],
    desc: 'One of the most spectacular mountain roads on Earth, winding past glacial lakes and green cliffs. A paradise for camping and high-altitude trail days.' },
  { id: 'ro_cheile_turzii', country: 'Romania', flag: '🇷🇴', emoji: '🏞️', name: 'Cheile Turzii Gorge', area: 'Cluj',
    lat: 46.5628, lng: 23.6817, tags: ['Hiking', 'Adrenaline'],
    desc: 'A deep natural gorge with stream crossings, hanging bridges and cave detours. Intense, beautiful, and pure wild nature from start to finish.' },
  { id: 'ro_bran', country: 'Romania', flag: '🇷🇴', emoji: '🏰', name: 'Bran Castle', area: 'Transylvania',
    lat: 45.5152, lng: 25.3672, tags: ['Culture', 'Mystery'],
    desc: 'The cliff-edge castle behind the Dracula legend. Secret passages, narrow stairways, and a panoramic view over Transylvania\'s dense forests.' },

  // ── 🇪🇸 SPAIN ──
  { id: 'es_caminito_north', country: 'Spain', flag: '🇪🇸', emoji: '🥾', name: 'Caminito del Rey · North', area: 'Málaga',
    lat: 36.9370, lng: -4.8040, tags: ['Adrenaline', 'Hiking'],
    desc: 'The northern gateway to the world\'s most famous cliff-side walkway — boardwalks pinned to a sheer canyon wall. A serious adrenaline dose with jaw-dropping views.' },
  { id: 'es_caminito_tickets', country: 'Spain', flag: '🇪🇸', emoji: '🎟️', name: 'Caminito del Rey · Tickets', area: 'El Chorro',
    lat: 36.9155, lng: -4.7616, tags: ['Meet point'],
    desc: 'The visitor reception — tickets, safety briefing and gear. The meetup point for groups before the walkway adventure begins.' },
  { id: 'es_caminito_playa', country: 'Spain', flag: '🇪🇸', emoji: '🏖️', name: 'Caminito del Rey · Playa', area: 'Ardales',
    lat: 36.9430, lng: -4.8010, tags: ['Calm', 'Swim'],
    desc: 'A turquoise lake beach right by the trailheads — the perfect wind-down after the cliff walk. Balance the adrenaline with pure calm.' },
  { id: 'es_portaventura', country: 'Spain', flag: '🇪🇸', emoji: '🎢', name: 'PortAventura World', area: 'Tarragona',
    lat: 41.0870, lng: 1.1560, tags: ['Adrenaline', 'Fun'],
    desc: 'A massive theme park with some of Europe\'s fastest coasters, live shows and full-day energy. Maximum adrenaline, zero hiking boots required.' },

  // ── 🇫🇷 FRANCE ──
  { id: 'fr_verdon', country: 'France', flag: '🇫🇷', emoji: '🛶', name: 'Verdon Gorge', area: 'Provence',
    lat: 43.7496, lng: 6.3285, tags: ['Rafting', 'Hiking'],
    desc: '"Europe\'s Grand Canyon" — turquoise rapids between towering cliffs. Rafting, advanced trails and climbing routes for the truly brave.' },
  { id: 'fr_chamonix', country: 'France', flag: '🇫🇷', emoji: '🏔️', name: 'Chamonix', area: 'French Alps',
    lat: 45.9237, lng: 6.8694, tags: ['Climbing', 'Adventure'],
    desc: 'The iconic Alpine town at the foot of Mont Blanc. Cable cars, climbing routes and long-distance trails — the absolute dream base for mountain people.' },
  { id: 'fr_eiffel', country: 'France', flag: '🇫🇷', emoji: '🗼', name: 'Eiffel Tower', area: 'Paris',
    lat: 48.8584, lng: 2.2945, tags: ['Culture', 'Photo'],
    desc: 'The classic — but take the stairs and it becomes a workout with the best panoramic reward in Paris. Iron-lattice engineering meets serious altitude.' },
];
