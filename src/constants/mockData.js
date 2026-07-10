/* ────────────────────────── MOCK DATA (Cairo) ──────────────────────── */

export const av = (n) => 'https://i.pravatar.cc/150?img=' + n;
export const pic = (seed, w, h) => 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h;

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

export const MAP_PEOPLE = [
  { ...USERS.nour, coords: { latitude: 30.0609, longitude: 31.2197 }, fx: '22%', fy: '18%' },
  { ...USERS.farida, coords: { latitude: 30.0421, longitude: 31.2229 }, fx: '16%', fy: '58%' },
  { ...USERS.omar, coords: { latitude: 30.0511, longitude: 31.2409 }, fx: '68%', fy: '38%' },
  { ...USERS.zeyad, coords: { latitude: 30.033, longitude: 31.2336 }, fx: '44%', fy: '74%' },
  { ...USERS.malak, coords: { latitude: 30.0566, longitude: 31.2394 }, fx: '60%', fy: '12%' },
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

export const GROUPS = [
  { id: 'g1', name: 'Cairo Explorers', emoji: '🎒', members: '12.3K', about: 'Hidden spots, day trips, and spontaneous adventures around Cairo.', members_avatars: [av(12), av(47), av(15)] },
  { id: 'g2', name: 'Sunrise Hikers EG', emoji: '⛰️', members: '4.8K', about: 'We chase the 5AM light. Moqattam, Galala, and beyond.', members_avatars: [av(47), av(32), av(45)] },
  { id: 'g3', name: 'Third-Wave Coffee', emoji: '☕', members: '7.1K', about: 'Cuppings, new roasters, and where to find the best pour in town.', members_avatars: [av(32), av(8), av(60)] },
  { id: 'g4', name: 'Blue Hole Buddies', emoji: '🤿', members: '2.2K', about: 'Freedivers and scuba folks planning Dahab trips together.', members_avatars: [av(15), av(5), av(8)] },
  { id: 'g5', name: 'Downtown Vinyl Society', emoji: '🎧', members: '3.6K', about: 'Rooftop record nights and crate-digging meetups.', members_avatars: [av(45), av(12), av(47)] },
];
