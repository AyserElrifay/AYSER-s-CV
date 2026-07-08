import { useState, useEffect, useCallback } from 'react';
import { SUPABASE_READY } from '../lib/supabase';
import { fetchFeed } from '../services/posts';
import { FEED, ME, av } from '../constants/mockData';

/* Feed source for HomeScreen.
   Real mode  — loads posts from Supabase; falls back to the mock FEED
                while the database is still empty so the app never
                looks broken.
   Demo mode  — serves the mock FEED, same as the original prototype. */

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
  const [posts, setPosts] = useState(FEED);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false); // true once real rows are shown

  const load = useCallback(async () => {
    if (!SUPABASE_READY) return;
    try {
      const rows = await fetchFeed();
      if (rows && rows.length > 0) {
        setPosts(rows.map(toCard));
        setIsLive(true);
      }
      // Empty table → keep the mock feed so the app stays alive.
    } catch (e) {
      // Network/RLS error → keep whatever we have; pull-to-refresh retries.
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

  return { posts, refreshing, refresh, isLive, prependPost };
}
