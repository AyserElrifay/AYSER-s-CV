/* ────────────────────────── MOCK DATA (Cairo) ──────────────────────── */

export const av = (n) => 'https://i.pravatar.cc/150?img=' + n;
export const pic = (seed, w, h) => 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h;

/* Neutral fallback avatar — the Moments star on purple. Used in REAL
   mode wherever a profile photo hasn't loaded/been set yet, so the app
   never flashes random stock faces at startup. */
export const AV_NEUTRAL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'>" +
    "<rect width='96' height='96' rx='48' fill='#7C3AED'/>" +
    "<text x='48' y='63' font-size='42' text-anchor='middle' fill='#F5B301'>✦</text>" +
    '</svg>'
  );

export const ME = {
  id: 'me',
  name: 'You',
  handle: '@you.moments',
  emoji: '🧿',
  avatar: av(5),
  verified: true,
  intent: 'Living it 🌙',
  vouchTag: 'Trusted Explorer',
  vouches: 18,
  bio: 'Leave a moment or live a memory. 🌙\nZamalek · chasing golden hours & good company.',
  moments: 96, mates: 240, campfires: 12,
  coords: { latitude: 30.0459, longitude: 31.2243 }, // Zamalek
};

/* Story highlights — the little pinned circles under a profile (IG style) */
export const HIGHLIGHTS = [
  { id: 'h1', label: 'Dahab', cover: pic('hldahab', 200, 200) },
  { id: 'h2', label: 'Sunrise', cover: pic('hlsun', 200, 200) },
  { id: 'h3', label: 'Nights', cover: pic('hlnight', 200, 200) },
  { id: 'h4', label: 'Coffee', cover: pic('hlcoffee', 200, 200) },
  { id: 'h5', label: 'Padel', cover: pic('hlpadel', 200, 200) },
];

/* The moment grid on your own space — photos, reels and a couple of text cards */
export const MY_MOMENTS = [
  { id: 'g1', media: pic('mine1', 400, 400), kind: 'reel', vibes: 218 },
  { id: 'g2', media: pic('mine2', 400, 400), vibes: 64 },
  { id: 'g3', text: 'padel at 6am beats any party. fight me 🎾', textBg: 'mint', vibes: 41 },
  { id: 'g4', media: pic('mine4', 400, 400), vibes: 132 },
  { id: 'g5', media: pic('mine5', 400, 400), kind: 'reel', vibes: 97 },
  { id: 'g6', media: pic('mine6', 400, 400), vibes: 58 },
  { id: 'g7', text: 'golden hour hits different from a rooftop 🌇', textBg: 'sky', vibes: 73 },
  { id: 'g8', media: pic('mine8', 400, 400), vibes: 45 },
  { id: 'g9', media: pic('mine9', 400, 400), vibes: 189 },
];

/* Little badges that sit on your space — the identity layer */
export const BADGES = [
  { id: 'b1', emoji: '🛡️', label: 'Trusted Explorer' },
  { id: 'b2', emoji: '🔥', label: '12 Campfires hosted' },
  { id: 'b3', emoji: '🌅', label: 'Sunrise Club' },
];

/* Settings — the app drawer, grouped like iOS Settings */
export const SETTINGS_GROUPS = [
  { title: 'Account', rows: [
    { icon: 'person-outline', label: 'Edit your space', hint: 'Name, bio & vibe' },
    { icon: 'megaphone-outline', label: 'Moments Ads', hint: 'Boost your moments · media buying' },
    { icon: 'shield-checkmark-outline', label: 'Privacy & safety' },
    { icon: 'notifications-outline', label: 'Notifications' },
  ] },
  { title: 'Preferences', rows: [
    { icon: 'language-outline', label: 'Language', value: 'English' },
    { icon: 'color-palette-outline', label: 'Appearance', value: 'Light' },
    { icon: 'musical-notes-outline', label: 'Sounds & haptics', value: 'On' },
  ] },
  { title: 'More', rows: [
    { icon: 'help-circle-outline', label: 'Help & support' },
    { icon: 'information-circle-outline', label: 'About Moments' },
  ] },
];

export const USERS = {
  clay: {
    id: 'clay', name: 'Clay Agency', handle: '@theclaystudio', emoji: '🎬',
    avatar: av(12), verified: true, vouches: 32, vouchTag: 'Trusted Host',
    intent: 'On Set 🎬', moments: 214, mates: 88, campfires: 19,
    bio: 'Premium production house. We shoot the night, not around it.',
  },
  nour: {
    id: 'nour', name: 'Nour El-Sayed', handle: '@nour.climbs', emoji: '🧗‍♀️',
    avatar: av(47), verified: true, vouches: 14, vouchTag: 'Safe Explorer',
    intent: 'Yala Hike! ⛰️', moments: 128, mates: 46, campfires: 12,
    bio: 'Sunrise chaser. If the trail has a view, I have a plan.',
  },
  omar: {
    id: 'omar', name: 'Omar Farouk', handle: '@omar.depth', emoji: '🤿',
    avatar: av(15), verified: true, vouches: 21, vouchTag: 'Certified Buddy',
    intent: 'Yala Dive! 🤿', moments: 96, mates: 39, campfires: 7,
    bio: 'Freediver. Blue Hole regular. One breath at a time.',
  },
  farida: {
    id: 'farida', name: 'Farida Aziz', handle: '@farida.pours', emoji: '☕',
    avatar: av(32), verified: false, vouches: 9, vouchTag: 'Great Company',
    intent: 'Coffee ☕', moments: 74, mates: 28, campfires: 4,
    bio: 'Third-wave everything. Will judge your espresso, kindly.',
  },
  zeyad: {
    id: 'zeyad', name: 'Zeyad Mansour', handle: '@zeyad.plays', emoji: '🎾',
    avatar: av(8), verified: true, vouches: 17, vouchTag: 'Fair Player',
    intent: 'Padel @6PM 🎾', moments: 143, mates: 61, campfires: 3,
    bio: 'Padel, pickup football, and post-match koshary.',
  },
  malak: {
    id: 'malak', name: 'Malak Hassan', handle: '@malak.fm', emoji: '🎧',
    avatar: av(45), verified: true, vouches: 26, vouchTag: 'Voice of the Night',
    intent: 'Live Campfire 🔥', live: true, moments: 187, mates: 73, campfires: 41,
    bio: 'Hosting Vibe Circles after midnight. Bring a story.',
  },
};

/* ── SOUNDS · attach a track to stories & reels (IG/TikTok style) ── */
export const SOUNDS = [
  { id: 'snd1', title: 'Neon Nights', artist: 'Cairokee', emoji: '🎸', uses: '12.4K' },
  { id: 'snd2', title: 'Ya Habibi (Remix)', artist: 'Disco Misr', emoji: '🪩', uses: '9.1K' },
  { id: 'snd3', title: 'Golden Hour Drive', artist: 'Sharmoofers', emoji: '🚗', uses: '6.8K' },
  { id: 'snd4', title: 'Nile Lo-Fi', artist: 'Moseqar', emoji: '🌙', uses: '5.2K' },
  { id: 'snd5', title: 'Desert Bass', artist: 'El Waili', emoji: '🏜️', uses: '3.7K' },
  { id: 'snd6', title: 'Original sound', artist: 'Your recording', emoji: '🎤', uses: '—' },
];

/* ── INDIE MUSIC HUB · demo tracks, categorized by how they SOUND
   (mood / BPM / instruments) — never by artist name. ── */
export const TRACK_MOODS = ['All', '🌙 Dreamy', '🔥 Hype', '🍂 Melancholic', '☀️ Warm', '🌊 Chill'];
export const HUB_TRACKS = [
  { id: 'hb1', title: 'Untitled Sunrise', cover_emoji: '🌅', mood: '☀️ Warm', bpm: 92, music_key: 'C major', timbre: 'warm', instruments: ['acoustic guitar', 'rhodes'], genre_shape: 'acoustic', uses_count: 812, by: 'indie producer' },
  { id: 'hb2', title: '3AM Loops', cover_emoji: '🌙', mood: '🌙 Dreamy', bpm: 74, music_key: 'A minor', timbre: 'hazy', instruments: ['synth pad', 'vinyl'], genre_shape: 'lo-fi', uses_count: 1543, by: 'indie producer' },
  { id: 'hb3', title: 'Concrete Bloom', cover_emoji: '🔥', mood: '🔥 Hype', bpm: 140, music_key: 'F# minor', timbre: 'gritty', instruments: ['808', 'hi-hats'], genre_shape: 'melodic trap', uses_count: 2210, by: 'indie producer' },
  { id: 'hb4', title: 'Tideline', cover_emoji: '🌊', mood: '🌊 Chill', bpm: 100, music_key: 'D major', timbre: 'bright', instruments: ['guitar', 'shaker'], genre_shape: 'indie pop', uses_count: 640, by: 'indie producer' },
  { id: 'hb5', title: 'Rain on Glass', cover_emoji: '🍂', mood: '🍂 Melancholic', bpm: 68, music_key: 'E minor', timbre: 'soft', instruments: ['piano', 'strings'], genre_shape: 'ambient', uses_count: 921, by: 'indie producer' },
];

/* Countries — for the flag on your map avatar (the light version of the
   "national-outfit avatar" idea). */
export const COUNTRIES = [
  { name: 'Egypt', flag: '🇪🇬' }, { name: 'Saudi Arabia', flag: '🇸🇦' }, { name: 'UAE', flag: '🇦🇪' },
  { name: 'Morocco', flag: '🇲🇦' }, { name: 'France', flag: '🇫🇷' }, { name: 'Spain', flag: '🇪🇸' },
  { name: 'USA', flag: '🇺🇸' }, { name: 'UK', flag: '🇬🇧' }, { name: 'Germany', flag: '🇩🇪' },
  { name: 'Korea', flag: '🇰🇷' }, { name: 'Japan', flag: '🇯🇵' }, { name: 'China', flag: '🇨🇳' },
  { name: 'Russia', flag: '🇷🇺' }, { name: 'Bosnia', flag: '🇧🇦' }, { name: 'Romania', flag: '🇷🇴' },
];

/* Each story: a moment that disappears after the vibe. */
export const STORIES = [
  { user: USERS.malak, media: pic('storymalak', 700, 1200), sound: SOUNDS[1], caption: 'Tonight we go LIVE 🔥' },
  { user: USERS.nour, media: pic('storynour', 700, 1200), sound: SOUNDS[2], caption: 'Trail check ⛰️' },
  { user: USERS.clay, media: pic('storyclay', 700, 1200), sound: SOUNDS[0], caption: 'Set life 🎬' },
  { user: USERS.omar, media: pic('storyomar', 700, 1200), sound: SOUNDS[3], caption: 'Blue therapy 🌊' },
  { user: USERS.zeyad, media: pic('storyzeyad', 700, 1200), sound: null, caption: 'Court booked 🎾' },
  { user: USERS.farida, media: pic('storyfarida', 700, 1200), sound: SOUNDS[4], caption: 'First pour ☕' },
];

export const FEED = [
  {
    id: 'p1', user: USERS.clay, type: 'vod',
    media: pic('clayset', 900, 520), duration: '02:41',
    caption: 'Behind the scenes — the "Neon Desert" shoot. Cranes up at golden hour, lasers after dark. Come watch the magic (and eat from the catering truck).',
    place: 'Katameya Dunes Backlot', startsIn: 'Live now',
    coords: { latitude: 29.966, longitude: 31.361 },
    vibes: 47, comments: 18, squad: 'Neon Desert Crew', joinable: true, topFan: 'Nour',
  },
  {
    id: 'p6', user: USERS.zeyad, type: 'post',
    media: null, textBg: 'mint',
    caption: 'Unpopular opinion: padel at 6AM beats any party. Fight me. 🎾',
    place: 'El Gezira Club', startsIn: 'now',
    coords: { latitude: 30.041, longitude: 31.221 },
    vibes: 14, comments: 7, squad: 'Padel Heads', joinable: false, topFan: 'Omar',
  },
  {
    id: 'sp1', sponsored: true, type: 'post',
    user: { id: 'brand1', name: 'Wadi Degla Clubs', avatar: av(20), verified: true },
    media: pic('adpitch', 900, 520),
    caption: 'Padel, football and pool — all courts bookable from your phone. First session free this week 🎾',
    place: 'Sponsored', startsIn: 'Ad', cta: 'Book now',
    coords: { latitude: 29.96, longitude: 31.27 },
    vibes: 88, comments: 9, joinable: false, topFan: 'Zeyad',
  },
  {
    id: 'p2', user: USERS.nour, type: 'reel',
    media: pic('moqattam', 700, 1100),
    caption: 'Saturday 5:30AM. Moqattam ridge, tea at the top, zero excuses. I bring the flask, you bring the legs.',
    place: 'Moqattam Trailhead', startsIn: 'in 14h',
    coords: { latitude: 30.01, longitude: 31.276 },
    vibes: 23, comments: 9, squad: 'Sunrise Hike · Moqattam', joinable: true, topFan: 'Malak', sound: SOUNDS[2],
  },
  {
    id: 'p3', user: USERS.farida, type: 'post',
    media: pic('cupping', 900, 640),
    caption: 'Cupping session — three Ethiopian lots, one mystery Yemeni. Six seats, slow morning, loud opinions welcome.',
    place: 'Kafein, Zamalek', startsIn: 'in 2h',
    coords: { latitude: 30.058, longitude: 31.222 },
    vibes: 11, comments: 5, squad: 'Slow Coffee Circle', joinable: false,
  },
  {
    id: 'p4', user: USERS.omar, type: 'reel',
    media: pic('bluehole', 700, 1100),
    caption: 'The Blue Hole at 7AM is a different planet. One breath, forty seconds, total silence. Beginners welcome — we buddy up, always.',
    place: 'Blue Hole, Dahab', startsIn: 'Fri 7AM',
    coords: { latitude: 28.495, longitude: 34.513 },
    vibes: 34, comments: 21, squad: 'Blue Hole Buddies', joinable: true, topFan: 'Nour', sound: SOUNDS[3],
  },
  {
    id: 'p5', user: USERS.malak, type: 'post',
    media: pic('vinyl', 900, 640),
    caption: 'Vinyl night, downtown rooftop. Bring one record that explains who you are. I will start: side B only.',
    place: 'Rooftop 44, Downtown', startsIn: 'in 5h',
    coords: { latitude: 30.047, longitude: 31.243 },
    vibes: 29, comments: 12, squad: 'Side B Society', joinable: false,
  },
];

/* `doing` = the activity badge a person chose to show on their pin */
export const MAP_PEOPLE = [
  { ...USERS.nour, doing: '⛰️', coords: { latitude: 30.0609, longitude: 31.2197 }, fx: '22%', fy: '18%' },
  { ...USERS.farida, doing: '☕', coords: { latitude: 30.0421, longitude: 31.2229 }, fx: '16%', fy: '58%' },
  { ...USERS.omar, doing: '🤿', coords: { latitude: 30.0511, longitude: 31.2409 }, fx: '68%', fy: '38%' },
  { ...USERS.zeyad, doing: '⚽', coords: { latitude: 30.033, longitude: 31.2336 }, fx: '44%', fy: '74%' },
  { ...USERS.malak, doing: '🎧', coords: { latitude: 30.0566, longitude: 31.2394 }, fx: '60%', fy: '12%' },
];

export const DOING_OPTIONS = ['⚽', '🎾', '☕', '🎬', '🤿', '🎧', '⛰️', '🏊', '🎮', '📚'];

/* ── OUTING DEALS · real external offers opened inside Moments (the
   broker layer). Global coverage: Waffarha for Egypt, Groupon for
   US/EU, Playtomic for courts worldwide, Meetup for playing with
   strangers. Every click is logged (partner_clicks) = the referral
   proof for our 10–20% commission, and users earn $MOMENT cashback. ── */
export const DEAL_FILTERS = ['All', '🎢 Fun', '🍽️ Food', '🏨 Stay', '🎾 Sport', '👥 Meet'];

export const DEALS = [
  { id: 'dl1', partner: 'waffarha', emoji: '🎢', cat: '🎢 Fun', region: '🇪🇬 Egypt', title: 'Waffarha · Outings & fun', sub: 'Parks, karting, escape rooms', badge: 'Up to 70% off', cashback: 15, url: 'https://www.waffarha.com/' },
  { id: 'dl2', partner: 'waffarha', emoji: '🍽️', cat: '🍽️ Food', region: '🇪🇬 Egypt', title: 'Waffarha · Restaurants', sub: 'Dining deals around you', badge: 'Save big', cashback: 15, url: 'https://www.waffarha.com/en/category/restaurants' },
  { id: 'dl3', partner: 'groupon', emoji: '🎟️', cat: '🎢 Fun', region: '🇺🇸🇪🇺 US & Europe', title: 'Groupon · Things to do', sub: 'Activities, spas, events', badge: 'Daily deals', cashback: 10, url: 'https://www.groupon.com/' },
  { id: 'dl4', partner: 'booking', emoji: '🏨', cat: '🏨 Stay', region: '🌍 Worldwide', title: 'Booking.com · Hotels', sub: 'Stays anywhere on earth', badge: 'Member prices', cashback: 10, url: 'https://www.booking.com/' },
  { id: 'dl5', partner: 'airbnb', emoji: '🏡', cat: '🏨 Stay', region: '🌍 Worldwide', title: 'Airbnb · Homes', sub: 'Unique stays & experiences', badge: 'Live anywhere', cashback: 8, url: 'https://www.airbnb.com/' },
  { id: 'dl6', partner: 'playtomic', emoji: '🎾', cat: '🎾 Sport', region: '🌍 Worldwide', title: 'Playtomic · Book a court', sub: 'Padel & tennis courts near you', badge: 'Open matches', cashback: 8, url: 'https://playtomic.io/' },
  { id: 'dl7', partner: 'meetup', emoji: '👥', cat: '👥 Meet', region: '🌍 Worldwide', title: 'Meetup · Play with strangers', sub: 'Groups & events for everything', badge: 'Find your people', cashback: 5, url: 'https://www.meetup.com/' },
  { id: 'dl8', partner: 'uber', emoji: '🚗', cat: '🎢 Fun', region: '🌍 Worldwide', title: 'Uber · Get there', sub: 'Ride to your next moment', badge: 'Open app', cashback: 5, url: 'https://m.uber.com/' },
  { id: 'dl9', partner: 'getyourguide', emoji: '🗺️', cat: '🎢 Fun', region: '🌍 Worldwide', title: 'GetYourGuide · Tours', sub: 'Tickets & experiences everywhere', badge: 'Skip the line', cashback: 8, url: 'https://www.getyourguide.com/' },
  { id: 'dl10', partner: 'viator', emoji: '🎫', cat: '🎢 Fun', region: '🌍 Worldwide', title: 'Viator · Things to do', sub: 'Day trips & activities', badge: 'Book ahead', cashback: 8, url: 'https://www.viator.com/' },
  { id: 'dl11', partner: 'hostelworld', emoji: '🛏️', cat: '🏨 Stay', region: '🌍 Worldwide', title: 'Hostelworld · Hostels', sub: 'Budget stays for travelers', badge: 'Meet travelers', cashback: 7, url: 'https://www.hostelworld.com/' },
  { id: 'dl12', partner: 'travelpayouts', emoji: '✈️', cat: '🏨 Stay', region: '🌍 Worldwide', title: 'Flights & Hotels', sub: 'Compare across every site', badge: 'Best price', cashback: 6, url: 'https://www.travelpayouts.com/' },
];

/* ── MAP BOOKINGS · courts, hotels & experiences you grab in two taps ── */
export const BOOKINGS = [
  { id: 'bk1', emoji: '🎾', name: 'Padel Court · Gezira Club', sub: 'Next slot 6:00 PM · 4 players', price: 'E£220/hr', kind: 'Sport' },
  { id: 'bk2', emoji: '⚽', name: 'Football Pitch · Zamalek 5-a-side', sub: 'Tonight 8:00 PM · turf', price: 'E£350/hr', kind: 'Sport' },
  { id: 'bk3', emoji: '🏨', name: 'Nile View Hotel', sub: 'Tonight · king room · breakfast', price: 'E£1,900', kind: 'Stay' },
  { id: 'bk4', emoji: '🛶', name: 'Sunset Felucca Hour', sub: 'Daily 5:30 PM · up to 8 mates', price: 'E£120/pp', kind: 'Experience' },
  { id: 'bk5', emoji: '🍽️', name: 'Rooftop Dinner · Downtown', sub: 'Table for 4 · 9:00 PM', price: 'E£300/pp', kind: 'Food' },
];

export const CAMPFIRES = [
  {
    id: 'c1', title: 'Late Night Deep Talks', host: USERS.malak, listeners: 132,
    coords: { latitude: 30.0475, longitude: 31.2357 }, fx: '50%', fy: '46%',
    topic: 'What would you do with one free year?',
  },
  {
    id: 'c2', title: 'Indie Music Exchange', host: USERS.zeyad, listeners: 58,
    coords: { latitude: 30.0638, longitude: 31.2262 }, fx: '32%', fy: '30%',
    topic: 'Trade one song you love, leave with five.',
  },
];

export const VOD_ROWS = [
  {
    title: 'Trending Tonight',
    items: [
      { id: 'v1', title: 'Neon Nile', tag: 'Series', meta: 'S1 · 8 eps', img: pic('neonnile', 500, 700) },
      { id: 'v2', title: 'Static Hearts', tag: 'Film', meta: '1h 52m', img: pic('static', 500, 700) },
      { id: 'v3', title: 'Desert Frequency', tag: 'Doc', meta: '48m', img: pic('freq', 500, 700) },
      { id: 'v4', title: 'Golden Hour Heist', tag: 'Film', meta: '2h 05m', img: pic('heist', 500, 700) },
    ],
  },
  {
    title: 'Comfort Classics',
    items: [
      { id: 'v5', title: 'The Long Summer', tag: 'Series', meta: 'S3 · 10 eps', img: pic('summer', 500, 700) },
      { id: 'v6', title: 'Salt & Stars', tag: 'Film', meta: '1h 38m', img: pic('salt', 500, 700) },
      { id: 'v7', title: 'Midnight Koshary Run', tag: 'Short', meta: '22m', img: pic('koshary', 500, 700) },
      { id: 'v8', title: 'Cairo After Dark', tag: 'Doc', meta: '57m', img: pic('cairodark', 500, 700) },
    ],
  },
];

export const GAMES = [
  { id: 'g1', name: 'UNO Flip', emoji: '🃏', price: 'E£120', eta: '25 min' },
  { id: 'g2', name: 'Jenga XL', emoji: '🗼', price: 'E£240', eta: '35 min' },
  { id: 'g3', name: 'Catan', emoji: '🏝️', price: 'E£480', eta: '40 min' },
  { id: 'g4', name: 'Poker Set', emoji: '♠️', price: 'E£350', eta: '30 min' },
];

/* ── PLAY · games you launch with mates. Egypt is home base; the same
   run is playable across cities. ── */
export const GAME_LOCATIONS = [
  { id: 'eg', city: 'Cairo', country: 'Egypt', flag: '🇪🇬', landmark: '🐫', colors: ['#F59E0B', '#B45309'], home: true },
  { id: 'ro', city: 'Bucharest', country: 'Romania', flag: '🇷🇴', landmark: '🏰', colors: ['#3B82F6', '#1E3A8A'] },
  { id: 'fr', city: 'Paris', country: 'France', flag: '🇫🇷', landmark: '🗼', colors: ['#6366F1', '#312E81'] },
  { id: 'es', city: 'Barcelona', country: 'Spain', flag: '🇪🇸', landmark: '🏟️', colors: ['#EF4444', '#7F1D1D'] },
  { id: 'ma', city: 'Marrakech', country: 'Morocco', flag: '🇲🇦', landmark: '🕌', colors: ['#F97316', '#7C2D12'] },
  { id: 'ba', city: 'Sarajevo', country: 'Bosnia', flag: '🇧🇦', landmark: '⛰️', colors: ['#10B981', '#064E3B'] },
];

/* Rooftop Rush — jump between rooftops, each country a different
   skyline AND a different themed chaser closing in behind you. */
export const ROOFTOP_LOCATIONS = [
  { id: 'eg', city: 'Cairo', country: 'Egypt', flag: '🇪🇬', landmark: '🔺', sky: ['#F59E0B', '#7C2D12'], chaser: '🧟', chaserName: 'The Mummy', caughtLine: 'The mummy got you! 🧟‍♂️💥', home: true },
  { id: 'fr', city: 'Paris', country: 'France', flag: '🇫🇷', landmark: '🗼', sky: ['#6366F1', '#1E1B4B'], chaser: '👻', chaserName: 'The Phantom', caughtLine: 'The Phantom of Paris caught you! 👻💥' },
  { id: 'ro', city: 'Bucharest', country: 'Romania', flag: '🇷🇴', landmark: '🏰', sky: ['#312E81', '#0B0B1A'], chaser: '🧛', chaserName: 'Dracula', caughtLine: 'Dracula got you! 🧛💥' },
];

export const PLAY_GAMES = [
  { id: 'run1', name: 'Catch Your Mate', emoji: '🏃', tag: 'Run together', players: '2–4 mates', desc: 'Chase your friend through the streets and dodge everything in your path. Crash and you’re out — last one running wins the round.', kind: 'runner' },
  { id: 'run2', name: 'Rooftop Rush', emoji: '🏙️', tag: 'Jump the skyline', players: '1 player', desc: 'Sprint across the rooftops and jump every gap — a different skyline and a different chaser on your tail in every country. Miss a jump and they catch you.', kind: 'rooftop' },
  { id: 'stack', name: 'Stack', emoji: '🧱', tag: 'Solo · beat your best', players: '1 player', desc: 'Tap to drop each block dead-centre and build the tallest tower you can. One sloppy drop and it all comes down. Chase the perfect streak.', kind: 'stack' },
  { id: 'tod', name: 'Truth or Dare', emoji: '🎲', tag: 'In chat', players: '2+ mates', desc: 'Drop it into any chat — a mate one-on-one or the whole gang. Spin, dare, laugh, remove it anytime.', kind: 'chat' },
];

/* Truth or Dare — the chat game. Light, playful, safe-for-friends. */
export const TOD = {
  truths: [
    'What’s the last thing you screenshotted?',
    'Who in this chat would you swap lives with for a day?',
    'What’s a moment you’d relive if you could?',
    'Most embarrassing song on your playlist — no lying.',
    'What’s a tiny thing that instantly makes your day?',
    'Last person you stalked on Moments? 👀',
    'Biggest fear you never talk about?',
    'What’s your most-used emoji, and why that one?',
  ],
  dares: [
    'Post a story with the front camera right now — no filter.',
    'Send a voice note singing the last song you heard.',
    'Text your oldest chat “I was just thinking about you”.',
    'Change your profile pic to the 4th photo in your camera roll.',
    'Do your best impression of someone in this chat.',
    'Share your screen-time number with the group.',
    'Reply to a stranger’s moment with a compliment.',
    'Speak only in emojis for the next 3 messages.',
  ],
};

/* ── LEARN LANGUAGES · exchange partners (HelloTalk/Lingbe style).
   Chat with a native speaker who's learning YOUR language; hop on a
   call right from the thread. ── */
export const LANG_PARTNERS = [
  { id: 'lp1', name: 'Yuna', avatar: av(44), speaks: '한국어 Korean', learning: 'Arabic', flag: '🇰🇷', level: 'B1', online: true },
  { id: 'lp2', name: 'Mateo', avatar: av(53), speaks: 'Español Spanish', learning: 'English', flag: '🇪🇸', level: 'A2', online: true },
  { id: 'lp3', name: 'Chloé', avatar: av(38), speaks: 'Français French', learning: 'Arabic', flag: '🇫🇷', level: 'B2', online: false },
  { id: 'lp4', name: 'Haruto', avatar: av(59), speaks: '日本語 Japanese', learning: 'English', flag: '🇯🇵', level: 'A1', online: true },
  { id: 'lp5', name: 'Lena', avatar: av(41), speaks: 'Русский Russian', learning: 'Arabic', flag: '🇷🇺', level: 'B1', online: false },
];

/* ── WATCH · "where to stream" discovery + affiliate (JustWatch-style).
   We don't host films — we send people to the real platform and earn
   an affiliate commission. Works worldwide; each provider gets your
   affiliate tag in broker config. ── */
export const WATCH_PROVIDERS = {
  prime:   { name: 'Prime Video', emoji: '📦', color: '#1FA2FF', partner: 'amazon' },
  appletv: { name: 'Apple TV',    emoji: '', color: '#111827', partner: 'appletv' },
  netflix: { name: 'Netflix',     emoji: '🅽', color: '#E50914', partner: 'netflix' },
  shahid:  { name: 'Shahid',      emoji: '🎬', color: '#00B0F0', partner: 'shahid' },
  disney:  { name: 'Disney+',     emoji: '🏰', color: '#113CCF', partner: 'disney' },
  youtube: { name: 'YouTube',     emoji: '▶️', color: '#FF0000', partner: 'youtube' },
  yango:   { name: 'Yango Play',  emoji: '🎵', color: '#FF3D00', partner: 'yango' },
};

export const WATCH_GENRES = ['All', '🍿 Trending', '🪐 Sci-Fi', '😂 Comedy', '🎭 Drama', '🇪🇬 Arabic'];

export const MOVIES = [
  { id: 'mv1', title: 'Dune: Part Two', year: 2024, genre: '🪐 Sci-Fi', rating: '8.5', colors: ['#B45309', '#7C2D12'],
    on: [{ p: 'prime', url: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Dune%20Part%20Two' }, { p: 'appletv', url: 'https://tv.apple.com/search?term=Dune%20Part%20Two' }] },
  { id: 'mv2', title: 'Oppenheimer', year: 2023, genre: '🎭 Drama', rating: '8.4', colors: ['#1F2937', '#111827'],
    on: [{ p: 'prime', url: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Oppenheimer' }, { p: 'appletv', url: 'https://tv.apple.com/search?term=Oppenheimer' }] },
  { id: 'mv3', title: 'Poor Things', year: 2023, genre: '🎭 Drama', rating: '8.0', colors: ['#6D28D9', '#4C1D95'],
    on: [{ p: 'disney', url: 'https://www.disneyplus.com/' }, { p: 'appletv', url: 'https://tv.apple.com/search?term=Poor%20Things' }] },
  { id: 'mv4', title: 'The Bear', year: 2024, genre: '😂 Comedy', rating: '8.6', colors: ['#065F46', '#064E3B'],
    on: [{ p: 'disney', url: 'https://www.disneyplus.com/' }, { p: 'prime', url: 'https://www.primevideo.com/' }] },
  { id: 'mv5', title: 'Ramy', year: 2022, genre: '🇪🇬 Arabic', rating: '7.7', colors: ['#B91C1C', '#7F1D1D'],
    on: [{ p: 'shahid', url: 'https://shahid.mbc.net/' }, { p: 'prime', url: 'https://www.primevideo.com/' }] },
  { id: 'mv6', title: 'Interstellar', year: 2014, genre: '🪐 Sci-Fi', rating: '8.7', colors: ['#0F172A', '#1E293B'],
    on: [{ p: 'prime', url: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Interstellar' }, { p: 'netflix', url: 'https://www.netflix.com/search?q=Interstellar' }] },
  { id: 'mv7', title: 'Barbie', year: 2023, genre: '😂 Comedy', rating: '7.0', colors: ['#DB2777', '#9D174D'],
    on: [{ p: 'prime', url: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=Barbie' }, { p: 'appletv', url: 'https://tv.apple.com/search?term=Barbie' }] },
  { id: 'mv8', title: 'Blue Elephant 2', year: 2019, genre: '🇪🇬 Arabic', rating: '7.9', colors: ['#1E3A8A', '#172554'],
    on: [{ p: 'shahid', url: 'https://shahid.mbc.net/' }, { p: 'yango', url: 'https://yango.com/en_int/play/' }] },
  { id: 'mv9', title: 'Kira & El Gin', year: 2022, genre: '🇪🇬 Arabic', rating: '7.5', colors: ['#7C2D12', '#431407'],
    on: [{ p: 'shahid', url: 'https://shahid.mbc.net/' }, { p: 'yango', url: 'https://yango.com/en_int/play/' }] },
];

/* ── COURSES · long-form learning that's actually curated.
   Free courses: anyone can teach. Paid courses: certified creators
   only — every instructor applies with proof and every course is
   reviewed before it goes live. No junk long-form. ── */
export const COURSES = [
  { id: 'co1', emoji: '📸', title: 'Phone Photography — golden hour to night', by: 'Clay Agency', certified: true, price: 'E£450', rating: 4.9, students: '1.2K', lessons: 14, paid: true },
  { id: 'co2', emoji: '☕', title: 'Home Brewing 101 — your best cup yet', by: 'Farida Aziz', certified: true, price: 'Free', rating: 4.7, students: '3.4K', lessons: 8, paid: false },
  { id: 'co3', emoji: '🤿', title: 'Freediving basics — safe & certified', by: 'Omar Farouk', certified: true, price: 'E£800', rating: 5.0, students: '640', lessons: 12, paid: true },
  { id: 'co4', emoji: '🎧', title: 'Host your first Campfire', by: 'Malak Hassan', certified: false, price: 'Free', rating: 4.5, students: '2.1K', lessons: 5, paid: false },
];

export const QUESTS = [
  {
    id: 'q1', emoji: '👻', title: 'Ghost Signs of Downtown',
    desc: 'Scan 5 fading storefront signs before they vanish forever.',
    reward: 25, dist: '1.2 km', steps: 5, done: 2,
  },
  {
    id: 'q2', emoji: '🌅', title: 'Nile Golden Hour Shot',
    desc: 'Frame the AR falcon over the water at exactly 6:40 PM.',
    reward: 40, dist: '0.8 km', steps: 3, done: 0,
  },
  {
    id: 'q3', emoji: '🗿', title: 'Zamalek Statue Safari',
    desc: 'Find 4 hidden statues; unlock the sculptor’s voice notes.',
    reward: 30, dist: '2.1 km', steps: 4, done: 4,
  },
];

export const SQUADS = [
  {
    id: 's1', name: 'Neon Desert Crew', emoji: '🎬', members: [av(12), av(47), av(15), av(8)],
    last: 'Clay Agency: Call time moved to 5PM — golden hour waits for no one 🌅',
    time: '2m', unread: 3, activity: 'Tonight · Katameya',
  },
  {
    id: 's2', name: 'Sunrise Hike · Moqattam', emoji: '⛰️', members: [av(47), av(32), av(45)],
    last: 'Nour: Meet at gate 2, I have the flask ☕🚗',
    time: '18m', unread: 1, activity: 'Sat 5:30AM',
  },
  {
    id: 's3', name: 'Blue Hole Buddies', emoji: '🤿', members: [av(15), av(8), av(60), av(5)],
    last: 'Omar: Surface interval memes only please',
    time: '1h', unread: 0, activity: 'Fri · Dahab',
  },
];

export const DMS = [
  { id: 'd1', user: USERS.malak, last: 'Saving you a seat by the speaker 🎧', time: '5m', unread: 2, translated: false },
  { id: 'd2', user: USERS.farida, last: 'الميعاد اتأكد؟ هجيب الحبوب الإثيوبي ☕', time: '32m', unread: 1, translated: true },
  { id: 'd3', user: USERS.zeyad, last: 'Rematch. Same court. Bring your excuses.', time: '2h', unread: 0, translated: false },
  { id: 'd4', user: USERS.omar, last: 'Tide chart says Friday is perfect 🌊', time: '1d', unread: 0, translated: false },
];

export const INITIAL_TX = [
  { id: 't1', icon: '🍣', label: 'Split — Sushi Night', sub: '4 Roam Mates', amount: '-42', pos: false },
  { id: 't2', icon: '🗿', label: 'Quest Reward — Statue Safari', sub: 'AR Quest', amount: '+30', pos: true },
  { id: 't3', icon: '⛽', label: 'Top Up', sub: 'Apple Pay', amount: '+200', pos: true },
];

export const PLANNER_INIT = [
  {
    id: 'pl1', title: 'Dahab Pack List', emoji: '🧳',
    items: [
      { t: 'Fins & low-volume mask', done: true },
      { t: 'Reef-safe sunscreen', done: true },
      { t: 'Dry bag + towel', done: false },
      { t: 'Logbook & pencil', done: false },
    ],
  },
  {
    id: 'pl2', title: 'Sunday Reset', emoji: '🌿',
    items: [
      { t: 'Plan 3 vibes for the week', done: true },
      { t: 'Call grandma', done: false },
      { t: 'Inbox to zero-ish', done: false },
    ],
  },
];

export const FIXERS = [
  { id: 'f1', name: 'Am Sayed', trade: 'Plumber', emoji: '🔧', jobs: 212, eta: '30 min', speed: 4.8, honesty: 5.0, price: 4.2 },
  { id: 'f2', name: 'Volt Brothers', trade: 'Electricians', emoji: '⚡', jobs: 148, eta: '45 min', speed: 4.5, honesty: 4.7, price: 4.6 },
  { id: 'f3', name: 'AC Doctor', trade: 'HVAC', emoji: '❄️', jobs: 96, eta: '1 h', speed: 4.2, honesty: 4.8, price: 3.9 },
];

export const RIDES = [
  { id: 'r1', name: 'Yala Go', sub: '4 seats · closest', eta: '4 min', price: 'E£68', emoji: '🚗' },
  { id: 'r2', name: 'Yala XL', sub: '6 seats · squad size', eta: '7 min', price: 'E£95', emoji: '🚐' },
  { id: 'r3', name: 'Yala Lux', sub: 'Arrive like the moment matters', eta: '9 min', price: 'E£140', emoji: '🖤' },
];

/* ── SEARCH · trending topics & public groups (X / Facebook style) ── */
export const TRENDING = [
  { id: 't1', tag: '#NeonDesert', category: 'Trending in Cairo', moments: '2,481' },
  { id: 't2', tag: '#SunriseHike', category: 'Outdoors', moments: '1,204' },
  { id: 't3', tag: '#BlueHoleDahab', category: 'Trending', moments: '958' },
  { id: 't4', tag: '#CairoCoffee', category: 'Food & Drink', moments: '742' },
  { id: 't5', tag: '#VinylNight', category: 'Music', moments: '531' },
  { id: 't6', tag: '#PadelAt6', category: 'Sports', moments: '410' },
];

/* ── REELS · the standalone vertical feed (TikTok-style, Moments identity).
   Every few reels a sponsored one slips in — clearly labeled. ── */
export const REELS = [
  {
    id: 'rl1', user: USERS.nour, media: pic('reelnour', 700, 1400),
    caption: 'POV: you said yes to the 5AM hike 🌄 worth it. every. time.',
    sound: SOUNDS[2], vibes: 1204, comments: 89, reposts: 41,
  },
  {
    id: 'rl2', user: USERS.malak, media: pic('reelmalak', 700, 1400),
    caption: 'Rooftop session got out of hand (in the best way) 🎧🔥',
    sound: SOUNDS[1], vibes: 3418, comments: 214, reposts: 120,
  },
  {
    id: 'ad1', sponsored: true,
    user: { id: 'brand1', name: 'Wadi Degla Clubs', avatar: av(20), verified: true },
    media: pic('adpadel', 700, 1400),
    caption: 'Book your padel court in 30 seconds — first session on us 🎾',
    cta: 'Book now', vibes: 230, comments: 12, reposts: 4, sound: null,
  },
  {
    id: 'rl3', user: USERS.omar, media: pic('reelomar', 700, 1400),
    caption: 'One breath. 30 meters. Blue Hole never gets old 🤿💙',
    sound: SOUNDS[3], vibes: 2876, comments: 167, reposts: 98,
  },
  {
    id: 'rl4', user: USERS.zeyad, media: pic('reelzeyad', 700, 1400),
    caption: 'Golden goal at golden hour ⚽🌇 sound ON for the crowd',
    sound: SOUNDS[0], vibes: 954, comments: 63, reposts: 22,
  },
  {
    id: 'ad2', sponsored: true,
    user: { id: 'brand2', name: 'Cairo Coffee Fest', avatar: av(25), verified: true },
    media: pic('adcoffee', 700, 1400),
    caption: 'The city’s biggest coffee weekend is back — 40+ roasters, one park ☕',
    cta: 'Get tickets', vibes: 512, comments: 30, reposts: 15, sound: null,
  },
  {
    id: 'rl5', user: USERS.farida, media: pic('reelfarida', 700, 1400),
    caption: 'Rating every pour in Downtown until someone stops me ☕ part 7',
    sound: SOUNDS[4], vibes: 1688, comments: 143, reposts: 57,
  },
  {
    id: 'rl6', user: USERS.clay, media: pic('reelclay', 700, 1400),
    caption: 'Lasers, cranes and 40 crew members — the Neon Desert BTS cut 🎬',
    sound: SOUNDS[0], vibes: 5203, comments: 391, reposts: 260,
  },
];

export const GROUPS = [
  { id: 'g1', name: 'Cairo Explorers', emoji: '🎒', members: '12.3K', about: 'Hidden spots, day trips, and spontaneous adventures around Cairo.', members_avatars: [av(12), av(47), av(15)] },
  { id: 'g2', name: 'Sunrise Hikers EG', emoji: '⛰️', members: '4.8K', about: 'We chase the 5AM light. Moqattam, Galala, and beyond.', members_avatars: [av(47), av(32), av(45)] },
  { id: 'g3', name: 'Third-Wave Coffee', emoji: '☕', members: '7.1K', about: 'Cuppings, new roasters, and where to find the best pour in town.', members_avatars: [av(32), av(8), av(60)] },
  { id: 'g4', name: 'Blue Hole Buddies', emoji: '🤿', members: '2.2K', about: 'Freedivers and scuba folks planning Dahab trips together.', members_avatars: [av(15), av(5), av(8)] },
  { id: 'g5', name: 'Downtown Vinyl Society', emoji: '🎧', members: '3.6K', about: 'Rooftop record nights and crate-digging meetups.', members_avatars: [av(45), av(12), av(47)] },
];
