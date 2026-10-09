/* ─── THE FEED AND THE MAP ARE ONE PLACE ──────────────────────────────
   A moment in the feed happened somewhere; the map is where somewhere
   is. "Show on the map" on a post asks for that spot here, the tab bar
   switches to the map, and the map — mounted now or a second from now,
   it is loaded lazily — takes the spot and flies there.

   A target waits until the map takes it, so the order the two happen
   in does not matter. */

let pending = null;
const subs = new Set();

export function showOnMap(target) {
  if (!target || target.lat == null || target.lng == null) return;
  pending = { ...target, ts: Date.now() };
  subs.forEach((fn) => { try { fn(pending); } catch (e) {} });
}

/* the map's side: the spot asked for, once */
export function takeMapTarget() {
  const t = pending;
  pending = null;
  return t;
}

export function onMapTarget(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/* The same idea for a whole tab: "find a hangout" from inside a sheet
   that does not know about navigation. */
const tabSubs = new Set();
export function goToTab(name) { tabSubs.forEach((fn) => { try { fn(name); } catch (e) {} }); }
export function onGoToTab(fn) { tabSubs.add(fn); return () => tabSubs.delete(fn); }
