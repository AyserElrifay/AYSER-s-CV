import AsyncStorage from '@react-native-async-storage/async-storage';

/* ─────────────── THE REACH ALGORITHM · preference-based feed ─────────
   Every interaction teaches the feed what you love. Scores combine:

     40%  affinity   — how often you vibe/comment/join this author & type
     30%  engagement — what the crowd is already loving (vibes+comments)
     20%  recency    — fresh moments float up
     10%  intent     — matches the vibe you picked at onboarding

   Signals persist on-device (AsyncStorage), so the feed keeps learning
   across sessions. Server-side ranking can replace this later without
   touching the screens — useFeed just calls rankFeed().              */

const KEY = 'moments.prefs.v1';

let prefs = { authors: {}, types: {}, intent: null };
let loaded = false;

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
  } catch (e) { /* fresh profile */ }
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {});
}

const SIGNAL_WEIGHT = { vibe: 1, comment: 2, join: 3, watch: 0.5 };

/* Call on every interaction: recordSignal('vibe', post) */
export async function recordSignal(kind, post) {
  await ensureLoaded();
  const w = SIGNAL_WEIGHT[kind] || 1;
  const author = post.user && post.user.name;
  if (author) prefs.authors[author] = (prefs.authors[author] || 0) + w;
  if (post.type) prefs.types[post.type] = (prefs.types[post.type] || 0) + w;
  persist();
}

export async function setIntent(intent) {
  await ensureLoaded();
  prefs.intent = intent;
  persist();
}

const INTENT_KEYWORDS = {
  '🎒 Explorer': ['trail', 'ridge', 'desert', 'quest', 'hike'],
  '☕ Coffee': ['coffee', 'cupping', 'espresso', 'pour'],
  '🧗‍♂️ Hiking': ['hike', 'trail', 'ridge', 'sunrise', 'moqattam'],
  '🎬 Creator': ['shoot', 'set', 'film', 'reel', 'behind the scenes'],
  '🎮 Gamer': ['game', 'padel', 'court', 'poker', 'match'],
};

function scorePost(post, now, maxEngagement) {
  const author = post.user && post.user.name;
  const affinity =
    Math.min(((author && prefs.authors[author]) || 0) / 10, 1) * 0.7 +
    Math.min(((post.type && prefs.types[post.type]) || 0) / 15, 1) * 0.3;

  const engagement = maxEngagement > 0
    ? ((post.vibes || 0) + 2 * (post.comments || 0)) / maxEngagement
    : 0;

  // Local/optimistic posts carry a timestamp in their id; DB rows don't
  // reach this path with one, so recency falls back to list order upstream.
  const recency = String(post.id).startsWith('local-') ? 1 : 0.5;

  let intent = 0;
  const words = INTENT_KEYWORDS[prefs.intent] || [];
  const hay = ((post.caption || '') + ' ' + (post.place || '')).toLowerCase();
  if (words.some((w) => hay.includes(w))) intent = 1;

  return 0.4 * affinity + 0.3 * engagement + 0.2 * recency + 0.1 * intent;
}

/* Stable, preference-aware ordering. Ties keep original (fresh-first) order. */
export async function rankFeed(posts) {
  await ensureLoaded();
  const maxEngagement = Math.max(
    1,
    ...posts.map((p) => (p.vibes || 0) + 2 * (p.comments || 0))
  );
  const now = Date.now();
  return posts
    .map((p, i) => ({ p, i, s: scorePost(p, now, maxEngagement) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
}
