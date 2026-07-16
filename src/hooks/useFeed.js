import { useState, useEffect, useCallback } from 'react';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchFeed } from '../services/posts';
import { rankFeed } from '../services/algorithm';
import { fetchFeedAds, injectAds } from '../services/nativeAds';
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
  textBg: row.text_bg || null,
  caption: row.caption || '',
  place: row.place || 'Somewhere out there',
  // scheduled moments count down; plain posts show WHEN they were posted
  startsIn: row.starts_at ? relTime(row.starts_at) : agoTime(row.created_at),
  coords: row.lat != null && row.lng != null
    ? { latitude: row.lat, longitude: row.lng }
    : ME.coords,
  vibes: row.vibes || 0,
  comments: row.comments || 0,
  squad: row.squad_name || 'New Vibe Squad',
  joinable: row.starts_at != null, // scheduled moments are invitations; plain posts are not
});

export function useFeed() {
  const [posts, setPosts] = useState(SUPABASE_READY ? [] : FEED);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive] = useState(SUPABASE_READY); // true whenever real mode is on, empty or not
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    if (!SUPABASE_READY) {
      // Demo mode still gets the preference-ranked ordering.
      setPosts(await rankFeed(FEED));
      return;
    }
    try {
      const [rows, ads] = await Promise.all([fetchFeed(), fetchFeedAds()]);
      const ranked = await rankFeed((rows || []).map(toCard));
      setPosts(injectAds(ranked, ads)); // native Sponsored cards, always labeled
      setLoadError(null);
    } catch (e) {
      setLoadError(e.message || 'Could not load moments');
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

  return { posts, refreshing, refresh, isLive, prependPost, removePost, patchPost, loadError };
}
