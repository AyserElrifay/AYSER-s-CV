import { supabase } from '../lib/supabase';

/* ── DISCOVER PEOPLE ────────────────────────────────────────────────
   Every row here is a real account. There is no seeded cast, no
   "suggested" filler and no borrowed photos: when a lane has nobody in
   it yet, it returns an empty list and the screen says so plainly.
   A short list of real people is worth more than a long list of
   invented ones.

   Lanes:
     everyone       — real accounts, most recently active first
     mayKnow        — mates of your mates, ranked by mutual friends
     nearby         — closest by the location they chose to share
     sameInterests  — overlapping hobbies, or your language pair mirrored
     seriousLearners— people who turned their learning profile on

   Filters: country and city, applied by the database, not in the app. */

const COLS = 'id, name, avatar_url, avatar_dna, country, country_flag, city, bio, hobbies, speaks_language, learning_language, learning_level, learning_visible, last_active_at, lat, lng, verified';

const clean = (rows) => (rows || []).filter((r) => r && r.id && r.name);

/* Everyone, newest-active first. */
export async function fetchPeople({ country, city, limit = 40, excludeId } = {}) {
  let q = supabase.from('profiles').select(COLS).limit(limit);
  if (country) q = q.eq('country', country);
  if (city) q = q.ilike('city', city);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q.order('last_active_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return clean(data);
}

/* Friends of your friends. The mutual count comes from a security-
   definer function, because row-level security correctly hides other
   people's friend rows — the tally is public, the rows are not. */
export async function fetchPeopleYouMayKnow(myId, limit = 30) {
  if (!myId) return [];
  const { data, error } = await supabase.rpc('people_you_may_know', { uid: myId, lim: limit });
  if (error) throw error;
  return clean(data).map((r) => ({ ...r, mutuals: Number(r.mutuals) || 0 }));
}

/* Closest first. Distance is computed here rather than in SQL so this
   works without PostGIS; the candidate set is already small. */
export async function fetchNearby(myId, { lat, lng, limit = 40 } = {}) {
  if (lat == null || lng == null) return [];
  const { data, error } = await supabase
    .from('profiles').select(COLS)
    .not('lat', 'is', null).not('lng', 'is', null)
    .limit(300);
  if (error) throw error;
  return clean(data)
    .filter((p) => p.id !== myId)
    .map((p) => ({ ...p, km: haversineKm(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (bLat - aLat) * d, dLng = (bLng - aLng) * d;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* People worth knowing: a shared hobby, or the mirror of your language
   pair — they speak what you're learning and are learning what you
   speak. Scored so the strongest overlap comes first. */
export async function fetchSameInterests(me, limit = 40) {
  if (!me) return [];
  const { data, error } = await supabase.from('profiles').select(COLS).limit(300);
  if (error) throw error;
  const myHobbies = tokens(me.hobbies);
  const mySpeaks = norm(me.speaks_language);
  const myLearning = norm(me.learning_language);
  const scored = clean(data)
    .filter((p) => p.id !== me.id)
    .map((p) => {
      const shared = tokens(p.hobbies).filter((h) => myHobbies.includes(h));
      let score = shared.length * 2;
      const mirror = mySpeaks && myLearning
        && norm(p.speaks_language) === myLearning && norm(p.learning_language) === mySpeaks;
      if (mirror) score += 5;
      else if (myLearning && norm(p.learning_language) === myLearning) score += 1; // same goal
      return { ...p, score, shared, mirror };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

const norm = (s) => String(s || '').trim().toLowerCase();
const tokens = (s) => String(s || '').toLowerCase().split(/[,،|/]+/).map((t) => t.trim()).filter((t) => t.length > 2);

/* People who deliberately turned their learning profile on — the ones
   actually here to practise, not just to browse. */
export async function fetchSeriousLearners({ country, city, limit = 40, excludeId } = {}) {
  let q = supabase.from('profiles').select(COLS).eq('learning_visible', true).limit(limit);
  if (country) q = q.eq('country', country);
  if (city) q = q.ilike('city', city);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q.order('last_active_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return clean(data);
}

/* The countries and cities that real accounts actually live in, so the
   filter never offers a place with nobody in it. */
export async function fetchPlaces() {
  const { data, error } = await supabase.from('profiles').select('country, country_flag, city').limit(1000);
  if (error) throw error;
  const countries = new Map(), cities = new Map();
  (data || []).forEach((r) => {
    if (r.country) {
      const c = countries.get(r.country) || { name: r.country, flag: r.country_flag || '', count: 0 };
      c.count += 1; if (!c.flag && r.country_flag) c.flag = r.country_flag;
      countries.set(r.country, c);
    }
    if (r.city) {
      const key = r.city.trim();
      const c = cities.get(key.toLowerCase()) || { name: key, country: r.country || '', count: 0 };
      c.count += 1; cities.set(key.toLowerCase(), c);
    }
  });
  const by = (a, b) => b.count - a.count || a.name.localeCompare(b.name);
  return { countries: [...countries.values()].sort(by), cities: [...cities.values()].sort(by) };
}

/* "Recently active" the way a person reads it, not a timestamp. */
export function activeLabel(iso) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 0) return null;
  if (mins < 5) return 'Active now';
  if (mins < 60) return `Active ${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Active ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days <= 7 ? `Active ${days}d ago` : 'Recently active';
}


/* ─── THE PEOPLE WHO SPEAK WHAT YOU ARE LEARNING ─────────────────────
   The language exchange already existed — it lives in Chats and it
   works. What it was missing is the moment it is actually wanted: you
   have just read twelve Czech phrases and you want to say one of them
   to a Czech person. That moment is inside the country room, not on a
   different screen two taps away.

   Matching on a free-text field is why this needs care. Somebody typed
   "Czech", somebody typed "czech", somebody typed "Czech / English".
   All three are the same person to a traveller and were three
   different people to an exact match, which is why the room asks for
   a language that CONTAINS the name rather than equals it. */
export async function fetchSpeakersOf(language, { excludeId, limit = 12 } = {}) {
  const name = String(language || '').trim();
  if (!name) return [];
  /* Only people who deliberately turned their learning profile on. A
     room full of people who never asked to be practised at would be
     the wrong thing to build, however good the numbers looked. */
  let q = supabase
    .from('profiles')
    .select(COLS)
    .eq('learning_visible', true)
    .ilike('speaks_language', '%' + name + '%')
    .limit(limit);
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q.order('last_active_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return clean(data);
}
