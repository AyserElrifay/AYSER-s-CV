import { supabase } from '../lib/supabase';
import { withAffiliate } from './broker';

/* ── FILMS ──────────────────────────────────────────────────────────
   We host nothing and stream nothing. A film here is a catalogue entry
   that points at the services which legally carry it — that is the
   only lawful way to do this and, as it happens, the honest one too.

   Two scores, never merged: the catalogue's global rating, and what
   the people in this app actually thought. They measure different
   things and showing them as one number would be a small lie. */

export const FILM_GENRES = ['All', 'Trending', 'Drama', 'Comedy', 'Action', 'Science Fiction', 'Animation', 'Romance', 'Horror'];

export async function fetchFilms({ genre, arabic, limit = 40 } = {}) {
  let q = supabase.from('films').select('*').limit(limit);
  if (arabic) q = q.eq('language', 'ar');
  if (genre && genre !== 'All' && genre !== 'Trending') q = q.contains('genres', [genre]);
  const { data, error } = await q.order('popularity', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function searchFilms(term, { limit = 30 } = {}) {
  const t = String(term || '').trim();
  if (!t) return [];
  const { data, error } = await supabase
    .from('films').select('*')
    .ilike('title', '%' + t + '%')
    .order('popularity', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* What this crowd gave it — kept apart from the catalogue's own score. */
export async function fetchOurScores(filmIds) {
  if (!filmIds || !filmIds.length) return {};
  const { data, error } = await supabase.rpc('film_scores', { ids: filmIds });
  if (error) return {};
  const out = {};
  (data || []).forEach((r) => { out[r.film_id] = { stars: Number(r.avg_stars), votes: Number(r.votes) }; });
  return out;
}

export async function fetchReviews(filmId) {
  const { data, error } = await supabase
    .from('film_reviews')
    .select('stars, body, created_at, edited_at, user_id, user:profiles!film_reviews_user_id_fkey(id, name, avatar_url, country_flag)')
    .eq('film_id', filmId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return data || [];
}

/* One opinion per person, changeable. Upsert rather than insert so
   saying it again edits what you said instead of stacking. */
export async function saveReview(filmId, userId, stars, body) {
  const { data, error } = await supabase
    .from('film_reviews')
    .upsert({
      film_id: filmId, user_id: userId,
      stars: Math.max(1, Math.min(5, Math.round(stars))),
      body: String(body || '').trim().slice(0, 1200) || null,
      edited_at: new Date().toISOString(),
    }, { onConflict: 'film_id,user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReview(filmId, userId) {
  const { error } = await supabase.from('film_reviews').delete().eq('film_id', filmId).eq('user_id', userId);
  if (error) throw error;
}

/* Where to watch it, legally. These are search links into each
   service rather than deep links to a stream: a service either carries
   a title or it doesn't, and pretending to know which is how you end
   up sending people to a dead page. Affiliate tags attach where a
   programme exists — the link works either way. */
export function watchOptions(film) {
  const t = encodeURIComponent(film.title || '');
  return [
    { id: 'prime',   name: 'Prime Video', emoji: '📦', partner: 'amazon',
      url: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=' + t },
    { id: 'netflix', name: 'Netflix',     emoji: '🅽', partner: 'netflix',
      url: 'https://www.netflix.com/search?q=' + t },
    { id: 'shahid',  name: 'Shahid',      emoji: '🎬', partner: 'shahid',
      url: 'https://shahid.mbc.net/en/search?q=' + t },
    { id: 'appletv', name: 'Apple TV',    emoji: '',  partner: 'appletv',
      url: 'https://tv.apple.com/search?term=' + t },
    { id: 'youtube', name: 'YouTube',     emoji: '▶️', partner: 'youtube',
      url: 'https://www.youtube.com/results?search_query=' + t + '+full+movie' },
  ].map((o) => ({ ...o, url: withAffiliate(o.partner, o.url) }));
}
