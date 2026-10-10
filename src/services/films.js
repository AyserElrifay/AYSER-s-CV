import { supabase } from '../lib/supabase';
import { withAffiliate } from './broker';

/* ── FILMS ──────────────────────────────────────────────────────────
   We host nothing and stream nothing. A film here is a catalogue entry
   that points at the services which legally carry it — that is the
   only lawful way to do this and, as it happens, the honest one too.

   A film is a reason to get together, not something to sit through
   here: the app shows a short list picked for you
   (src/lib/filmPicks.js), where each one is legally streamed, and a
   "Watch together" that turns it into a plan. No stars, no reviews. */

export async function fetchFilms({ genre, arabic, language, limit = 40 } = {}) {
  let q = supabase.from('films').select('*').limit(limit);
  /* The country room asks for one language at a time. It is the same
     column `arabic` already used — named properly so a caller can ask
     for Greek without a boolean per language being added here. */
  if (language) q = q.eq('language', language);
  else if (arabic) q = q.eq('language', 'ar');
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

/* The services we can link into, by the names the catalogue uses.
   Several names, one service: TMDB calls Prime "Amazon Prime Video"
   in one country and "Amazon Video" in another. */
const SERVICES = [
  { id: 'netflix', name: 'Netflix',     emoji: '🅽', partner: 'netflix', match: /^netflix/i,
    url: (t) => 'https://www.netflix.com/search?q=' + t },
  { id: 'prime',   name: 'Prime Video', emoji: '📦', partner: 'amazon',  match: /amazon|prime video/i,
    url: (t) => 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=' + t },
  { id: 'shahid',  name: 'Shahid',      emoji: '🎬', partner: 'shahid',  match: /shahid/i,
    url: (t) => 'https://shahid.mbc.net/en/search?q=' + t },
  { id: 'disney',  name: 'Disney+',     emoji: '✨', partner: 'disney',  match: /disney/i,
    url: (t) => 'https://www.disneyplus.com/search?q=' + t },
  { id: 'max',     name: 'Max',         emoji: '🟦', partner: 'max',     match: /^(hbo )?max\b|hbo max/i,
    url: (t) => 'https://play.max.com/search?q=' + t },
  { id: 'appletv', name: 'Apple TV',    emoji: '',  partner: 'appletv', match: /apple tv/i,
    url: (t) => 'https://tv.apple.com/search?term=' + t },
  { id: 'youtube', name: 'YouTube',     emoji: '▶️', partner: 'youtube', match: /youtube/i,
    url: (t) => 'https://www.youtube.com/results?search_query=' + t + '+full+movie' },
];
const DEFAULT = ['netflix', 'prime', 'shahid', 'appletv', 'youtube'];

/* Where to watch it, here. When the catalogue knows which services
   carry the title in your country (TMDB, from JustWatch), those come
   first and say so; a service we cannot link into gets the catalogue's
   own "where to watch" page. When it does not know, the usual search
   links — a service either carries a title or it doesn't. */
export function watchOptions(film, region = null) {
  const t = encodeURIComponent(film.title || '');
  const here = region && film.providers && film.providers[region];
  const names = here && Array.isArray(here.names) ? here.names : [];
  const out = [];
  const used = new Set();
  for (const nm of names) {
    const sv = SERVICES.find((x) => x.match.test(nm));
    if (sv && !used.has(sv.id)) { used.add(sv.id); out.push({ id: sv.id, name: sv.name, emoji: sv.emoji, partner: sv.partner, url: sv.url(t), here: true }); }
    else if (!sv && here.link && !used.has(nm)) { used.add(nm); out.push({ id: 'p:' + nm, name: nm, emoji: '📺', partner: 'tmdb', url: here.link, here: true }); }
  }
  if (!out.length) {
    for (const id of DEFAULT) {
      const sv = SERVICES.find((x) => x.id === id);
      out.push({ id: sv.id, name: sv.name, emoji: sv.emoji, partner: sv.partner, url: sv.url(t), here: false });
    }
  }
  return out.map((o) => ({ ...o, url: withAffiliate(o.partner, o.url) }));
}
