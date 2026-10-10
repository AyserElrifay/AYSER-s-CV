/* ─── FILMS: A SHORT LIST, PICKED FOR YOU ─────────────────────────────
   The spec: "Stop infinite scrolling in the movie feed. Map user
   profile interests to genres, and strictly display only the Top 10–15
   matching movies for that user." And: films are not for watching here
   — they are a reason to get together ("Watch Together").

   So there is no shelf to scroll and no genre picker to fiddle with.
   Your hobbies and your vibe say which genres you are likely to enjoy;
   films in those genres that are streamable in YOUR country come
   first; then the catalogue's own popularity breaks the tie. Twelve.

   Pure, so it can be checked without a phone or a database:

       node scripts/check-film-picks.mjs
*/

export const PICKS = 12;

/* Egypt, Morocco and the 27 EU member states — the countries the film
   catalogue is pulled for (scripts/import-films.mjs) and where "where
   to watch" knows which services really carry a title. */
export const FILM_REGIONS = [
  'EG', 'MA',
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];

/* a hobby or a vibe → the genres it points at, strongest first */
const INTEREST_GENRES = [
  [/hik|camp|travel|explor|adventur|backpack|surf|div|cycl|beach|climb/i, ['Adventure', 'Action', 'Documentary']],
  [/film|cinema|movie|creator|photo/i, ['Drama', 'Independent', 'Documentary']],
  [/music|danc|sing|concert/i, ['Music', 'Romance', 'Drama']],
  [/gam|chess|puzzle/i, ['Science Fiction', 'Fantasy', 'Mystery', 'Action']],
  [/football|padel|gym|sport|yoga|run|tennis|fitness/i, ['Sport', 'Action', 'Documentary']],
  [/read|book|writ|histor|cultur|art|museum/i, ['Drama', 'History', 'Mystery']],
  [/coffee|caf/i, ['Romance', 'Comedy', 'Drama']],
  [/cook|food|bak/i, ['Comedy', 'Family', 'Documentary']],
  [/volunt|green|nature|eco|garden|clean/i, ['Documentary', 'Family', 'Animation']],
  [/kid|family|parent/i, ['Family', 'Animation', 'Comedy']],
  [/laugh|comed|fun|joke/i, ['Comedy']],
  [/scary|horror|thrill/i, ['Horror', 'Thriller']],
];

/* words in the profile → { genre: weight } */
export function tasteOf(profile) {
  const words = [].concat(
    String((profile && profile.hobbies) || '').split(/[,،;|]+/),
    String((profile && profile.intent) || ''),
  ).map((s) => s.trim()).filter(Boolean);
  const w = {};
  for (const word of words) {
    for (const [re, genres] of INTEREST_GENRES) {
      if (!re.test(word)) continue;
      genres.forEach((g, i) => { w[g] = (w[g] || 0) + (3 - Math.min(i, 2)); });
    }
  }
  return w;
}

/* The country a film list is for: the profile's own, if we pull films
   for it; nothing otherwise (then streaming availability is not used). */
export function regionOf(profile) {
  const c = String((profile && profile.country) || '').toUpperCase();
  return FILM_REGIONS.includes(c) ? c : null;
}

const streamableIn = (film, region) => !!(region && film && Array.isArray(film.regions) && film.regions.includes(region));

export function pickFilms(films, profile, { n = PICKS, lang = 'en' } = {}) {
  const taste = tasteOf(profile);
  const region = regionOf(profile);
  const arabicFirst = lang === 'ar' || region === 'EG' || region === 'MA';
  const maxPop = Math.max(1, ...(films || []).map((f) => Number(f.popularity) || 0));
  const seen = new Set();
  return (films || [])
    .filter((f) => f && f.title && f.poster_url)
    .map((f) => {
      const genres = Array.isArray(f.genres) ? f.genres : [];
      const match = genres.reduce((s, g) => s + (taste[g] || 0), 0);
      const score = match * 10
        + (streamableIn(f, region) ? 8 : 0)
        + (arabicFirst && f.language === 'ar' ? 3 : 0)
        + ((Number(f.popularity) || 0) / maxPop) * 5;
      return { f, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter(({ f }) => {
      const k = String(f.title).toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, n)
    .map(({ f }) => f);
}

/* the services that really carry it here, when the catalogue knows */
export function providersIn(film, region) {
  const p = film && film.providers && region ? film.providers[region] : null;
  return p && Array.isArray(p.names) ? p : null;
}
