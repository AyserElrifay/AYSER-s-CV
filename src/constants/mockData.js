const pic = (seed, w, h) => 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h;
const av = (n) => 'https://i.pravatar.cc/150?img=' + n;

export const ME = { id: 'me', name: 'Ayser', emoji: '🎒', coords: { latitude: 30.0459, longitude: 31.2243 } };

export const FEED = [
  { id: 'p1', user: { name: 'Clay Agency', avatar: av(12), verified: true }, type: 'reel', media: pic('clayset', 700, 1100), caption: 'Neon Desert shoot wrapped! 🎬 Who is joining the afterparty?', place: 'Katameya Dunes', vibes: 47, comments: 18, squad: 'Neon Crew' },
  { id: 'p2', user: { name: 'Nour El-Sayed', avatar: av(47), verified: true }, type: 'post', media: pic('hike', 900, 640), caption: 'Moqattam ridge at 5AM. Bring tea. ☕', place: 'Moqattam', vibes: 23, comments: 9, squad: 'Sunrise Hikers' }
];
