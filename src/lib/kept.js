/* ─── WHAT A SHEET SAW LAST TIME ──────────────────────────────────────
   "كل ما أدوس علي زرار green minds بيعمل لودنج من الاول". A sheet that
   empties itself and asks again every time it opens shows a spinner
   every time, even though it was showing the very same list a minute
   ago. So a sheet keeps what it last showed here, opens on it, and is
   brought up to date quietly underneath. A spinner is only for the
   very first time.

   In memory only, never written to the phone: some of this is personal
   (your notifications, your mates), and it all goes when you sign out
   (AuthContext) or close the app. Keys carry the user id where the
   data is somebody's own. */
const mem = new Map();

export const kept = (key) => (key && mem.has(key) ? mem.get(key) : null);
export const keep = (key, value) => { if (key && value != null) mem.set(key, value); return value; };
export const forgetKept = () => mem.clear();
