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
  ['https://unpkg.com', 'https://tiles.openfreemap.org', 'https://tile.openstreetmap.org']
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


/* ─── AND THE VECTOR MAP, WHICH IS THE MAP THAT CAN SPEAK ────────────
   The raster map below is a wall of pictures with the place names
   already painted on, each in its own alphabet. To draw the names in
   the language somebody chose in this app, the phone has to draw the
   names itself — which means vector tiles, which means MapLibre.

   All three of these are loaded ONLY when the map opens, from the same
   CDN Leaflet already comes from, and every one of them may fail
   without taking the map with it: this resolves null, and the map
   falls back to the picture tiles it has always used. A map in the
   wrong alphabet is a poor map; no map at all is a broken app.

   The third file is the one that is easy to forget and impossible to
   miss afterwards: without the right-to-left plugin, every Arabic
   label on the map comes out backwards and disconnected. Arabic is
   this app's first language. */
const MAPLIBRE_JS  = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const GL_LEAFLET   = 'https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js';
const RTL_TEXT     = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js';

let vectorPromise = null;

const script = (src) => new Promise((resolve) => {
  const el = document.createElement('script');
  el.src = src;
  el.onload = () => resolve(true);
  el.onerror = () => resolve(false);
  document.head.appendChild(el);
});

export function loadVectorMap() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (vectorPromise) return vectorPromise;
  vectorPromise = (async () => {
    /* No WebGL, no vector map — some phones, some browsers with it
       switched off, and every headless environment. Asking first is
       cheaper than catching the failure afterwards. */
    try {
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return null;
    } catch (e) { return null; }
    if (!window.maplibregl) {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = MAPLIBRE_CSS;
      document.head.appendChild(css);
      if (!(await script(MAPLIBRE_JS)) || !window.maplibregl) return null;
    }
    /* Arabic, Hebrew and Persian labels are shaped by this plugin or
       they are not shaped at all. Load it before the first map exists —
       MapLibre refuses it afterwards — and never let it be fatal. */
    try {
      if (window.maplibregl.getRTLTextPluginStatus &&
          window.maplibregl.getRTLTextPluginStatus() === 'unavailable') {
        window.maplibregl.setRTLTextPlugin(RTL_TEXT, null, true);
      }
    } catch (e) {}
    const L = await loadLeaflet();
    if (!L) return null;
    if (!L.maplibreGL && !(await script(GL_LEAFLET))) return null;
    if (!L.maplibreGL) return null;
    return { maplibregl: window.maplibregl, L };
  })();
  return vectorPromise;
}
