import { useState, useEffect, useCallback } from 'react';
import { SUPABASE_READY, storedSessionNow } from '../lib/supabase';
import { explain } from '../lib/explain';
import { fetchFeed, fetchReposts } from '../services/posts';
import { fetchTagsForPosts } from '../services/tags';
import { rankFeed } from '../services/algorithm';
import { actionFeed } from '../lib/actionFeed';
import { FEED, ME, AV_NEUTRAL } from '../constants/mockData';

/* Feed source for HomeScreen.
   Real mode  — loads real posts from Supabase, always. An empty table
                shows a genuine empty state (HomeScreen renders it) —
                never mock content pretending to be real people.
   Demo mode  — serves the mock FEED, same as the original prototype
                (used only when no Supabase project is configured). */

const relTime = (startsAt) => {
  if (!startsAt) return 'Soon';
  const diffMin = Math.round((new Date(startsAt) - Date.now()) / 60000);
  if (diffMin <= 0) return 'Live now';
  if (diffMin < 60) return 'in ' + diffMin + 'm';
  if (diffMin < 48 * 60) return 'in ' + Math.round(diffMin / 60) + 'h';
  return 'in ' + Math.round(diffMin / (60 * 24)) + 'd';
};

/* When the post was published — "12m ago", "3h ago", or "12 Aug". */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const agoTime = (createdAt) => {
  if (!createdAt) return 'now';
  const d = new Date(createdAt);
  const min = Math.max(1, Math.round((Date.now() - d) / 60000));
  if (min < 60) return min + 'm ago';
  if (min < 24 * 60) return Math.round(min / 60) + 'h ago';
  if (min < 7 * 24 * 60) return Math.round(min / (24 * 60)) + 'd ago';
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
};

/* DB row → the shape PostCard/MagicFlow already consume.
   Exported so shared-link posts (?post=…) render identically. */
export const toCard = (row) => ({
  id: row.id,
  userId: row.user_id, // owner — powers "is this mine?" (delete, profile)
  user: {
    id: row.user_id,
    name: (row.user && row.user.name) || 'Explorer',
    avatar: (row.user && row.user.avatar_url) || AV_NEUTRAL,
    verified: !!(row.user && row.user.verified),
    flag: (row.user && row.user.country_flag) || null, // their country, right next to the name
  },
  type: row.type || 'post',
  media: row.media_url || null, // no photo → renders as a text moment
  /* ── THE STILL, AND THE LENGTH ────────────────────────────────────
     Both of these existed on the row and neither one reached the card.
     The still is why a posted video was a black rectangle in the feed:
     the card handed the .mp4 URL to an <Image>, which draws nothing.
     The length is why the chip on it read "WATCH · undefined". */
  thumb: row.thumb_url || null,
  durationSec: Number.isFinite(row.duration_sec) ? row.duration_sec : null,
  textBg: row.text_bg || null,
  caption: row.caption || '',
  // a travel plan rides along with the post it belongs to
  plan: row.plan || null,
  // 'hangout' or 'warning' — decides the card's main button
  intent: row.intent === 'warning' ? 'warning' : 'hangout',
  // who it went out to — so Manage opens showing the truth, not a guess
  closeOnly: !!row.close_only,
  place: row.place || null,
  // scheduled moments count down; plain posts show WHEN they were posted
  startsIn: row.starts_at ? relTime(row.starts_at) : agoTime(row.created_at),
  coords: row.lat != null && row.lng != null
    ? { latitude: row.lat, longitude: row.lng }
    : null,
  vibes: row.vibes || 0,
  comments: row.comments || 0,
  squad: row.squad_name || 'New Vibe Squad',
  joinable: row.starts_at != null, // scheduled moments are invitations; plain posts are not
  // passed on by somebody — the card says so, in their name
  repostedBy: row.reposted_by
    ? { id: row.reposted_by.id, name: row.reposted_by.name, avatar: row.reposted_by.avatar_url || AV_NEUTRAL }
    : null,
  tagged: row.tagged || [],
});

/* ─── THE FEED, WITHOUT THE WAIT ──────────────────────────────────────
   Ayser: "الـLoading كتير ... خلي على طول يتعامل بسيط السريع".

   Measured with every server call slowed to 400ms — a phone in Cairo
   talking to a database in Europe — the feed took 2.0 seconds to show
   its first post, and three of those round trips were waiting that
   did not need to happen:

     · it did not START until the splash had finished and the screen
       had mounted, so the splash and the network took turns instead
       of running together;
     · it would not show a single post until a second query — who is
       tagged in them — had come back as well;
     · and every cold start began from an empty list, although the
       phone had shown this exact feed a few minutes earlier. An iPhone
       throws a backgrounded web app away constantly, so "cold start"
       is most starts.

   So: the request goes out the moment we know who is signed in, in
   parallel with the splash (primeFeed, called from App). The posts
   are shown the moment they arrive and the tags are added when THEY
   arrive. And the last feed is kept on the phone and drawn
   immediately, then quietly replaced by the fresh one — what you saw
   last time, at once, instead of a skeleton. */

const CACHE_KEY = 'mm.feed.v1';
const CACHE_MAX = 24;

const whoNow = () => { const s = storedSessionNow(); return s ? s.user.id : null; };

function readCache() {
  try {
    const uid = whoNow();
    if (!uid || typeof localStorage === 'undefined') return null;
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    /* someone else's feed on a shared phone is not "what you saw last" */
    if (!c || c.uid !== uid || !Array.isArray(c.posts)) return null;
    /* a day-old feed is a worse first look than a skeleton */
    if (Date.now() - (c.at || 0) > 24 * 3600e3) return null;
    return actionFeed(c.posts);
  } catch (e) { return null; }
}

function writeCache(posts) {
  try {
    const uid = whoNow();
    if (!uid || typeof localStorage === 'undefined') return;
    const keep = posts.filter((c) => !c.sponsored && !String(c.id).startsWith('local-')).slice(0, CACHE_MAX);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, at: Date.now(), posts: keep }));
  } catch (e) { /* a full store just means no head start next time */ }
}

async function fetchFresh() {
  /* no adverts in the feed: an organisation reaches people by hosting
     something on the map, not by buying a card between their friends */
  const [rows, reposts] = await Promise.all([fetchFeed(), fetchReposts()]);
  /* A repost brings the moment itself back, credited to whoever
     passed it on. If the moment is already in the feed we don't
     show it twice — we just put the credit on the card that's
     already there. */
  const cards = (rows || []).map(toCard);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const revived = [];
  (reposts || []).forEach((r) => {
    const there = byId.get(r.id);
    if (there) { if (!there.repostedBy && r.reposted_by) there.repostedBy = { id: r.reposted_by.id, name: r.reposted_by.name, avatar: r.reposted_by.avatar_url || AV_NEUTRAL }; return; }
    const card = toCard(r);
    byId.set(card.id, card);
    revived.push(card);
  });
  return { all: actionFeed(cards.concat(revived)) };
}

/* The head start. A request already on its way is reused by the first
   load rather than asked again; one older than fifteen seconds is not
   trusted to still be the news. */
let primed = null;
export function primeFeed() {
  if (!SUPABASE_READY) return;
  if (primed && Date.now() - primed.at < 15000) return;
  const promise = fetchFresh();
  promise.catch(() => {});
  primed = { at: Date.now(), promise };
}
const takePrimed = () => {
  const p = primed && Date.now() - primed.at < 15000 ? primed.promise : null;
  primed = null;
  return p;
};

export function useFeed() {
  const [posts, setPosts] = useState(() => (SUPABASE_READY ? (readCache() || []) : FEED));
  const [refreshing, setRefreshing] = useState(false);
  const [isLive] = useState(SUPABASE_READY); // true whenever real mode is on, empty or not
  const [loadError, setLoadError] = useState(null);
  /* ── EMPTY, OR NOT LOADED YET? ────────────────────────────────────
     posts starts as [] and stays [] until the first fetch answers, so
     for the whole of that first second an empty feed and a still-loading
     feed look the same on screen — and the screen shows "No moments yet,
     be the first". On a slow connection you open straight onto that and
     then watch real posts push it away, which reads as the app opening
     broken and then correcting itself.

     settled is false until the first load has actually finished, once.
     The screen shows a calm skeleton until then, and "be the first"
     appears only after a real load came back with nothing. */
  const [settled, setSettled] = useState(() => !SUPABASE_READY || posts.length > 0);

  const load = useCallback(async () => {
    if (!SUPABASE_READY) {
      // Demo mode still gets the preference-ranked ordering.
      setPosts(await rankFeed(FEED));
      return;
    }
    try {
      const { all } = await (takePrimed() || fetchFresh());
      const ranked = await rankFeed(all);
      setPosts(ranked);
      setLoadError(null);
      setSettled(true);
      writeCache(ranked);
      /* who is tagged in them — added when it arrives, never waited on */
      fetchTagsForPosts(all.map((c) => c.id)).then((tags) => {
        if (!tags) return;
        setPosts((list) => list.map((c) => (tags[c.id] ? { ...c, tagged: tags[c.id] } : c)));
      }, () => {});
    } catch (e) {
      /* WHAT went wrong, never the database's words for it — the raw
         message was being printed on the feed and it named tables and
         schema caches at people who were only looking for their friends.
         See src/lib/explain.js. */
      setLoadError(explain(e));
    } finally {
      setSettled(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  /* Optimistic insert — a just-shared moment appears at the top instantly. */
  const prependPost = useCallback((card) => {
    setPosts((p) => [card, ...p]);
  }, []);

  /* Optimistic removal — a deleted moment disappears instantly. */
  const removePost = useCallback((id) => {
    setPosts((p) => p.filter((x) => x.id !== id));
  }, []);

  /* Optimistic edit — patch fields on a card instantly (e.g. caption). */
  const patchPost = useCallback((id, fields) => {
    setPosts((p) => p.map((x) => (x.id === id ? { ...x, ...fields } : x)));
  }, []);

  return { posts, refreshing, refresh, isLive, prependPost, removePost, patchPost, loadError, settled };
}
