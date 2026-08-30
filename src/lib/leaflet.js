/* ─── FETCHING LEAFLET, AND NOTHING ELSE ─────────────────────────────
   App.js warms the map while the app is idle so that opening the Map
   tab is instant. It used to reach into components/LeafletMap.js for
   that one function — and importing a React component to call a
   twelve-line DOM helper put the whole 41 KB map component, and the
   country data behind it, into the first download of every person who
   never opened the map at all.

   Nothing here touches React. The component imports loadLeaflet from
   here; App.js imports warmMap from here; the component itself now
   travels with the Map tab, where it belongs.

   ── AND WHY IT IS FETCHED BEFORE IT IS ASKED FOR ─────────────────
   The map library and its stylesheet live on a CDN, and nothing went
   looking for them until the moment you tapped the Map tab. So the tab
   opened onto an empty dark rectangle while a DNS lookup, a TLS
   handshake and ~150KB of JavaScript happened, and only then did the
   first tile request even start. That is the wait.

   None of that work depends on you tapping anything. warmMap() starts
   it while the app is idle, and opens the connection to the tile server
   at the same time, so by the time the tab is tapped the library is
   usually already in memory and the tiles have a warm socket waiting.
   Exported so App can call it once at startup — calling it twice is
   free, the promise is shared. */
let leafletPromise = null;

export function warmMap() {
  if (typeof document === 'undefined') return;
  ['https://unpkg.com', 'https://tile.openstreetmap.org']
    .forEach((href) => {
      if (document.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
      const l = document.createElement('link');
      l.rel = 'preconnect';
      l.href = href;
      l.crossOrigin = '';
      document.head.appendChild(l);
    });
  loadLeaflet();
}

export function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = () => resolve(window.L);
    js.onerror = () => resolve(null);
    document.head.appendChild(js);
  });
  return leafletPromise;
}

