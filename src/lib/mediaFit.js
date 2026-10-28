import { publicMedia } from './publicMedia';

/* ─── THE RIGHT VIDEO ON THE RIGHT CARD ───────────────────────────────
   Ayser, October 2026: a coffee table in Zamalek, Heliopolis or Maadi
   shows a city evening — coffee, art, people talking — never somebody
   jumping out of a plane. Adventure clips (skydiving, paragliding,
   canyon dives, reefs, desert safaris, climbing) belong to Roam, travel
   and the Global Track only. A clip the Studio set that names one of
   those, on a local Drop, is swapped for the city clip of its kind. */

export const ADVENTURE = /sky|parachut|paraglid|skydiv|bungee|canyon|dive|diving|reef|desert|safari|surf|kite|climb|ferrata|raft|zipline|jump|sinai|siwa|marsa|island|white-desert|merzouga/i;

/* the city clip for each local pillar: all real evenings in town */
export const CITY_CLIP = {
  tables: 'act-coffee-v1.mp4',
  culture: 'act-opera-v1.mp4',
  impact: 'reel-volunteer.mp4',
};
export const CITY_CLIPS = ['act-coffee-v1.mp4', 'act-coffee-v2.mp4', 'reel-coffee.mp4', 'act-opera-v1.mp4', 'painting-night.mp4', 'wide-painting.mp4', 'reel-talk.mp4', 'reel-volunteer.mp4', 'welcome-hang.mp4', 'act-music-v1.mp4', 'act-crochet-v1.mp4', 'reel-sketch.mp4', 'reel-read.mp4'];

export const isAdventure = (uri) => !!uri && ADVENTURE.test(String(uri).split('?')[0]);

/* the loop a Drop card may play */
export const dropClip = (d) => {
  const cat = (d && d.category) || 'tables';
  const own = d && d.video_url;
  if (cat === 'roam') return own || null;
  if (own && !isAdventure(own)) return own;
  return CITY_CLIP[cat] ? publicMedia(CITY_CLIP[cat]) : null;
};
