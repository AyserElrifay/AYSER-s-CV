import { useState, useEffect, useCallback } from 'react';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchFeed } from '../services/posts';
import { rankFeed } from '../services/algorithm';
import { fetchFeedAds, injectAds } from '../services/nativeAds';
import { FEED, ME, av } from '../constants/mockData';

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

/* DB row → the shape PostCard/MagicFlow already consume. */
const toCard = (row) => ({
  id: row.id,
  user: {
    name: (row.user && row.user.name) || 'Explorer',
    avatar: (row.user && row.user.avatar_url) || av(60),
    verified: !!(row.user && row.user.verified),
  },
  type: row.type || 'post',
  media: row.media_url || null, // no photo → renders as a text moment
  textBg: row.text_bg || null,
  caption: row.caption || '',
  place: row.place || 'Somewhere out there',
  startsIn: relTime(row.starts_at),
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

  return { posts, refreshing, refresh, isLive, prependPost, loadError };
}
