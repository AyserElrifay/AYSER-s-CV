import { myPlus } from '../services/offers';

/* ─── AM I PLUS? ──────────────────────────────────────────────────────
   One answer, asked of the server (my_plus in RUN_ME.sql) and kept for
   a minute, so every Plus thing in the app agrees and nothing asks
   twice. The server is what actually decides: Papyrus's diary talks are
   refused there, not here. */
let cache = null; let at = 0; let inflight = null;
export function getPlus(force) {
  if (!force && cache && Date.now() - at < 60000) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = myPlus().then((r) => { cache = r || { plus: false }; at = Date.now(); inflight = null; return cache; })
    .catch(() => { inflight = null; return cache || { plus: false }; });
  return inflight;
}
export const plusNow = () => cache;
export const forgetPlus = () => { cache = null; at = 0; };
