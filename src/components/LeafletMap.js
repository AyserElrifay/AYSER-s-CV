import React, { useRef, useEffect } from 'react';
import { Platform } from 'react-native';

/* A REAL interactive map on web — Leaflet + OpenStreetMap data with
   CARTO's playful "Voyager" tiles. Pannable, zoomable, opens on the
   whole planet. Pins float gently and glow purple — the Snap-Map
   energy, but in the Moments identity (purple + gold, name pills).
   Native uses react-native-maps instead, so this renders web-only. */

let leafletPromise = null;
function loadLeaflet() {
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

/* A CLEAN, name-free planet — the owner's call, applied to everyone
   equally: NO country on Earth carries a name on this map. The single
   decorative label kept is the shared three-faith name for the region
   between the river and the sea — 'الأرض المقدسة · Holy Land' — which
   names no state and erases no one, because no state anywhere is
   named. Non-interactive, hidden once you zoom into street level. */
const REGIONS = [
  { name: 'الأرض المقدسة · Holy Land', lat: 31.55, lng: 35.05 },
];

/* The Moments map identity — gentle float, purple glow, white pills. */
function injectMapStyle() {
  if (typeof document === 'undefined' || document.getElementById('mm-map-style')) return;
  const st = document.createElement('style');
  st.id = 'mm-map-style';
  st.textContent = `
    @keyframes mmFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes mmPulse { 0% { transform: scale(0.9); opacity: 0.55; } 70% { transform: scale(1.7); opacity: 0; } 100% { opacity: 0; } }
    .mm-float { animation: mmFloat 3.2s ease-in-out infinite; }
    .mm-pill {
      background: #fff; border-radius: 11px; padding: 2.5px 8px; font-size: 10.5px;
      font-weight: 800; color: #111827; white-space: nowrap; text-align: center;
      border: 1.5px solid rgba(124,58,237,0.28);
      box-shadow: 0 3px 10px rgba(124,58,237,0.22), 0 2px 5px rgba(0,0,0,0.14);
      font-family: -apple-system, system-ui, sans-serif;
      max-width: 116px; overflow: hidden; text-overflow: ellipsis;
    }
    /* Snap-Map energy in our identity: juicy saturated landcover, a
       little extra warmth and light — playful and colourful without
       turning harsh or hard to read. */
    .mm-tiles { filter: saturate(1.6) contrast(1.07) brightness(1.05); }
    /* soft italic ancient-atlas names, faint purple ink */
    .mm-region {
      font: italic 600 13px Georgia, 'Times New Roman', serif;
      color: rgba(84, 72, 130, 0.78); letter-spacing: 2.2px;
      text-shadow: 0 1px 4px rgba(255,255,255,0.95), 0 0 10px rgba(255,255,255,0.75);
      white-space: nowrap; text-align: center; pointer-events: none;
    }
    .mm-hide-regions .mm-region { display: none; }
    /* Destination pins are STATIC (no per-pin animations — with ~60 of
       them, infinite glows were what made the map feel heavy) and they
       shrink to tidy dots when you're zoomed out, so the world view
       stays organized instead of a wall of overlapping cards. */
    .mm-dest { transform-origin: center bottom; transition: transform 0.25s ease; }
    .mm-z-far .mm-dest { transform: scale(0.5); }
    .mm-z-far .mm-dest .mm-pill { display: none; }
  `;
  document.head.appendChild(st);
}

const glowRing = (color) =>
  '<div style="position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:radial-gradient(circle,' + color + ' 0%,transparent 70%);animation:mmPulse 2.6s ease-out infinite"></div>';

const pinHtml = (m) => {
  const flag = m.flag;
  const flagBadge = flag
    ? '<div style="position:absolute;bottom:10px;right:-6px;background:#fff;border-radius:8px;font-size:11px;line-height:15px;padding:0 2px;box-shadow:0 1px 3px rgba(0,0,0,0.3)">' + flag + '</div>'
    : '';

  // People: real photo in a floating avatar with a purple glow — Snap
  // energy, Moments identity. Name pill underneath.
  if (m.kind === 'person' && m.avatar) {
    const doing = m.emoji && m.emoji.length <= 3
      ? '<div style="position:absolute;top:-7px;left:-7px;background:#fff;border-radius:9px;font-size:12px;line-height:17px;padding:0 2px;box-shadow:0 1px 3px rgba(0,0,0,0.3)">' + m.emoji + '</div>' : '';
    const name = (m.label || '').replace(/^[^ ]+ /, '').split(' ')[0] || m.label;
    return (
      '<div class="mm-float" style="position:relative;width:52px;height:66px">' +
      glowRing('rgba(124,58,237,0.45)') +
      '<img src="' + m.avatar + '" style="position:relative;width:48px;height:48px;margin-left:2px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 0 0 3px #7C3AED, 0 4px 10px rgba(0,0,0,0.3)"/>' +
      doing + flagBadge +
      '<div class="mm-pill" style="margin-top:3px">' + name + '</div>' +
      '</div>'
    );
  }

  // Curated destinations: a compact static gold-rim card + name pill.
  // No float/glow animations here — sixty of those at once is exactly
  // what made the map slow. Motion is saved for people, who are few.
  if (m.kind === 'dest') {
    return (
      '<div class="mm-dest" style="position:relative;width:96px;height:62px;display:flex;flex-direction:column;align-items:center">' +
      '<div style="position:relative;width:38px;height:38px;border-radius:13px;background:#fff;border:2.5px solid #F5B301;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 2px 6px rgba(0,0,0,0.22)">' +
      (m.emoji || '📍') +
      (flag ? '<div style="position:absolute;bottom:-5px;right:-7px;background:#fff;border-radius:8px;font-size:10px;line-height:14px;padding:0 2px;box-shadow:0 1px 3px rgba(0,0,0,0.3)">' + flag + '</div>' : '') +
      '</div>' +
      '<div class="mm-pill" style="margin-top:4px">' + (m.label || '') + '</div>' +
      '</div>'
    );
  }

  const border = m.kind === 'fire' ? '#F43F5E' : m.kind === 'deal' ? '#10B981' : m.kind === 'place' ? '#F59E0B' : '#7C3AED';
  return (
    '<div style="position:relative;width:36px;height:36px;border-radius:12px;background:#fff;border:2px solid ' + border +
    ';display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 6px rgba(0,0,0,0.25)">' +
    (m.emoji || '📍') + flagBadge + '</div>'
  );
};

export const LeafletMap = ({ center, markers = [], onPress, locate = true, focus = null }) => {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const meRef = useRef(null);
  const flownRef = useRef(false);
  const locateRef = useRef(locate);
  locateRef.current = locate;

  // init once — open on the whole planet
  useEffect(() => {
    let cancelled = false;
    injectMapStyle();
    loadLeaflet().then((L) => {
      if (cancelled || !L || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, {
        zoomControl: false, attributionControl: false,
        minZoom: 2, worldCopyJump: true, zoomSnap: 0.25,
      }).setView([24, 14], 2.5); // Earth view — Egypt/Europe in frame
      // CARTO "Voyager · no labels" — the same colourful, cartoonish
      // landcover with the entire text layer removed: NO administrative
      // names appear for ANY country, worldwide, so the basemap stays
      // purely visual and viewpoint-neutral. Names on this map come
      // from OUR pins (people, real places, destinations) instead.
      // Revert to labels: swap 'voyager_nolabels' back to 'voyager'.
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, subdomains: 'abcd', className: 'mm-tiles',
        updateWhenIdle: true, keepBuffer: 4, // smoother panning, less churn
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      // zoom-aware tidiness: the region label fades out at street zoom,
      // and destination pins collapse to dots when zoomed far out
      const applyZoomClasses = () => {
        const el = map.getContainer();
        el.classList.toggle('mm-hide-regions', map.getZoom() >= 8);
        el.classList.toggle('mm-z-far', map.getZoom() < 5);
      };
      map.on('zoomend', applyZoomClasses);
      applyZoomClasses();
      draw(L);
      setTimeout(() => map.invalidateSize(), 250);
    });
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = (L) => {
    if (!L || !layerRef.current) return;
    layerRef.current.clearLayers();

    // decorative region names (our own text layer on the label-free map)
    REGIONS.forEach((r) => {
      const icon = L.divIcon({
        html: '<div class="mm-region">' + r.name + '</div>',
        className: '', iconSize: [240, 20], iconAnchor: [120, 10],
      });
      L.marker([r.lat, r.lng], { icon, interactive: false, zIndexOffset: -100 }).addTo(layerRef.current);
    });

    // your own live pin — only once your REAL location is known.
    // Purple dot + gold ring + a "You" pill, so there is never any
    // doubt the map found your true spot.
    if (locateRef.current) {
      const meIcon = L.divIcon({
        html:
          '<div style="position:relative;width:56px;height:48px;display:flex;flex-direction:column;align-items:center">' +
          glowRing('rgba(124,58,237,0.5)') +
          '<div style="position:relative;width:22px;height:22px;border-radius:50%;background:#7C3AED;border:3px solid #fff;box-shadow:0 0 0 3px #F5B301, 0 0 0 7px rgba(124,58,237,0.22)"></div>' +
          '<div class="mm-pill" style="margin-top:5px">You ✦</div>' +
          '</div>',
        className: '', iconSize: [56, 48], iconAnchor: [28, 11],
      });
      meRef.current = L.marker([center.latitude, center.longitude], { icon: meIcon, zIndexOffset: 1000 }).addTo(layerRef.current);
    }

    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return;
      const isPerson = m.kind === 'person' && m.avatar;
      const isDest = m.kind === 'dest';
      const icon = L.divIcon({
        html: pinHtml(m), className: '',
        iconSize: isPerson ? [52, 66] : isDest ? [96, 62] : [36, 36],
        iconAnchor: isPerson ? [26, 33] : isDest ? [48, 31] : [18, 36],
      });
      const mk = L.marker([m.lat, m.lng], { icon, zIndexOffset: isPerson ? 500 : isDest ? 300 : 0 }).addTo(layerRef.current);
      if (m.label && !isPerson && !isDest) mk.bindTooltip(m.label, { direction: 'top', offset: [0, -34] });
      mk.on('click', () => onPress && onPress(m));
    });
  };

  // re-draw when data changes; keep the current pan/zoom
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L && mapRef.current) draw(window.L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  // glide down from the globe the moment the user's REAL location is
  // known (never to a placeholder). Later GPS moves just slide the
  // "You" pin — the camera stays wherever the user panned it.
  useEffect(() => {
    if (!mapRef.current || !center || !locate) return;
    if (!flownRef.current) {
      flownRef.current = true;
      mapRef.current.flyTo([center.latitude, center.longitude], 14, { duration: 2.4 });
      if (typeof window !== 'undefined' && window.L) draw(window.L);
    } else if (meRef.current) {
      meRef.current.setLatLng([center.latitude, center.longitude]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locate, center && center.latitude, center && center.longitude]);

  // search → fly the camera to whatever the user picked
  useEffect(() => {
    if (!mapRef.current || !focus || focus.lat == null || focus.lng == null) return;
    mapRef.current.flyTo([focus.lat, focus.lng], focus.zoom || 14, { duration: 1.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus && focus.ts]);

  if (Platform.OS !== 'web') return null;
  // react-dom renders lowercase host tags on web (same as the <video>/<iframe> used elsewhere).
  // zIndex:0 makes the map a stacking context so Leaflet's internal high
  // z-index panes stay BELOW the app's overlay buttons.
  return <div ref={elRef} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 0 }} />;
};
