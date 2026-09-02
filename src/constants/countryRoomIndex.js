/* ── WHICH COUNTRIES HAVE A ROOM ─────────────────────────────────────
   Deliberately a separate, tiny file. The map screen needs to know
   whether to offer the row for a place — and if it imported the room
   data to find out, it would pull 75 KB of phrases into the map's own
   chunk and the lazy load would have been for nothing.

   Keyed by the country name exactly as destinations.js spells it, since
   that is the string the map has in its hand. scripts/check-country-
   room.mjs fails the build if this list and the rooms ever disagree. */
export const ROOM_CODES = new Map([
  ['Greece', 'GR'],
  ['Italy', 'IT'],
  ['Spain', 'ES'],
  ['France', 'FR'],
  ['Germany', 'DE'],
  ['Portugal', 'PT'],
  ['Netherlands', 'NL'],
  ['Romania', 'RO'],
  ['Poland', 'PL'],
  ['Czechia', 'CZ'],
  ['Türkiye', 'TR'],
  ['Morocco', 'MA'],
  ['Egypt', 'EG'],
  ['China', 'CN'],
]);
