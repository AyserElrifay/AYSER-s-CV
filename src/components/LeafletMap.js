import React, { useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { WORLD } from '../constants/worldGeo';

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

/* Big, well-known countries whose names show even zoomed out; smaller
   ones appear as you zoom in, so the world view never crowds. */
const COUNTRY_MAJOR = new Set([
  'Russia','China','United States','Canada','Brazil','Australia','India',
  'Argentina','Kazakhstan','Algeria','Saudi Arabia','Egypt','Mexico','Indonesia',
  'Iran','Turkey','Sudan','Libya','Chad','Niger','Angola','Mali','Ethiopia',
  'Nigeria','South Africa','DR Congo','Greenland','Mongolia','Peru','Colombia',
  'Bolivia','Pakistan','France','Spain','Germany','Ukraine','Sweden','Norway',
  'Finland','Japan','Thailand','Myanmar','Afghanistan','Iraq','Morocco','Italy',
  'United Kingdom','Poland','Romania','Chile','Venezuela','Namibia','Botswana',
  'Zambia','Tanzania','Kenya','Somalia','Yemen',
]);

/* The Moments map identity — gentle float, purple glow, white pills. */
function injectMapStyle() {
  if (typeof document === 'undefined' || document.getElementById('mm-map-style')) return;
  const st = document.createElement('style');
  st.id = 'mm-map-style';
  st.textContent = `
    @keyframes mmFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes mmPulse { 0% { transform: scale(0.9); opacity: 0.55; } 70% { transform: scale(1.7); opacity: 0; } 100% { opacity: 0; } }
    .mm-float { animation: mmFloat 3.2s ease-in-out infinite; }
    /* soft loading backdrop before the street tiles paint */
    .leaflet-container { background: #dfeaf2; }
    .mm-dark .leaflet-container, .leaflet-container.mm-dark { background: #0c1626; }
    /* cartoon pop on the real street tiles — juicy but easy on the eyes */
    .mm-tiles { filter: saturate(1.35) contrast(1.0) brightness(1.06); }
    .mm-dark .mm-tiles { filter: saturate(1.1) contrast(1.02) brightness(1.0); }
    /* our own country names — every country identical styling, so no
       country (incl. Israel & Palestine) is visually favoured. */
    .mm-country {
      font: 700 11.5px 'Helvetica Neue', -apple-system, system-ui, 'Segoe UI', 'Tahoma', sans-serif;
      color: rgba(34, 52, 48, 0.82); letter-spacing: 0.3px; white-space: nowrap; text-align: center;
      text-shadow: 0 1px 2px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.7);
      pointer-events: none;
    }
    .mm-dark .mm-country { color: rgba(228,236,242,0.85); text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.6); }
    .mm-z-globe .mm-country { display: none; }
    .mm-pill {
      background: rgba(255,255,255,0.97); border-radius: 8px; padding: 1.5px 6.5px; font-size: 9.5px;
      font-weight: 700; color: #1f2937; white-space: nowrap; text-align: center;
      box-shadow: 0 1.5px 5px rgba(0,0,0,0.13);
      font-family: -apple-system, system-ui, sans-serif;
      max-width: 108px; overflow: hidden; text-overflow: ellipsis;
    }
    /* declutter, tiered so the map never crowds — but country names show
       from far away, Snapchat-style:
       • from the globe/world view → the big countries are already named
       • closer in                 → every country name appears */
    .mm-z-far .mm-region-minor { display: none; }

    /* ── CARTOON GLOBE (zoomed all the way out) ──
       The flat world is masked into a floating round planet: a circular
       window with a soft sky filling everything outside it, spherical
       shading inside for the 3-D bulge, a chunky cartoon outline and a
       drop shadow so it hovers. Pointer-events off → the map underneath
       stays fully pannable/zoomable. */
    /* Zoom-out = a real planet in space. No "ring around a map": just
       deep black space filling everything outside the sphere, a soft
       blue atmosphere glow, a lit limb and a dark terminator for real
       spherical depth (Google-Earth feel). */
    .mm-globe-frame {
      display: none; position: absolute; left: 50%; top: 47%;
      width: min(96vw, 86vh); height: min(96vw, 86vh);
      transform: translate(-50%, -50%); border-radius: 50%;
      pointer-events: none; z-index: 450;
      box-shadow:
        0 0 50px 14px rgba(120,180,255,0.6),         /* atmosphere glow */
        0 0 100px 40px rgba(90,150,240,0.28),        /* outer haze */
        0 0 0 9999px #04060d,                         /* deep space */
        inset -26px -30px 80px rgba(0,0,0,0.72),      /* dark terminator */
        inset 28px 24px 60px rgba(150,195,255,0.2);   /* lit limb */
      border: 1px solid rgba(150,195,255,0.4);
    }
    .mm-z-globe .mm-globe-frame { display: block; }
    /* on the globe the satellite imagery shows true colour */
    .mm-z-globe .mm-sat { filter: saturate(1.06) brightness(1.02); }
    /* region names flip to light ink on the dark planet */
    .mm-dark .mm-region { color: rgba(226,232,240,0.74); text-shadow: 0 1px 3px rgba(0,0,0,0.9); }
    /* the Snap "activity heatmap" glow that blooms under a live person */
    @keyframes mmHeat { 0%,100% { opacity: 0.55; } 50% { opacity: 0.8; } }
    .mm-heat {
      position: absolute; left: 50%; top: 46%; width: 78px; height: 78px;
      margin: -39px 0 0 -39px; border-radius: 50%; pointer-events: none;
      background: radial-gradient(circle, rgba(245,179,1,0.55) 0%, rgba(244,63,94,0.4) 32%, rgba(124,58,237,0.25) 55%, transparent 72%);
      filter: blur(2px); animation: mmHeat 3s ease-in-out infinite;
    }
    .mm-hide-regions .mm-region { display: none; }
    /* Destination pins are STATIC (no per-pin animations — with ~60 of
       them, infinite glows were what made the map feel heavy). To keep
       the world view calm and Snap-clean, the cards are HIDDEN when
       you're zoomed far out and appear as you zoom into a region; at
       the mid zoom they drop their name pill and shrink a touch so a
       busy area never becomes a wall of overlapping cards. */
    /* Only each COUNTRY'S most important place (its "hero") shows while
       you're zoomed out — small and label-free — so the world stays
       calm. Every other place stays hidden until you zoom hard into a
       city, where all of them appear in full with their names. */
    .mm-dest { transform-origin: center bottom; transition: transform 0.2s ease; }
    .mm-dest:not(.mm-dest-hero) { display: none; }        /* minors: hidden until city zoom */
    .mm-dest-hero { transform: scale(0.68); }             /* hero: small */
    .mm-dest-hero .mm-pill { display: none; }             /* hero: no label yet */
    .mm-z-globe .mm-dest { display: none !important; }    /* whole-planet view: nothing */
    .mm-z-city .mm-dest { display: flex !important; transform: none; } /* zoomed in: show all, full */
    .mm-z-city .mm-dest .mm-pill { display: block; }
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
      '<div class="mm-heat"></div>' +
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
      '<div class="mm-dest' + (m.hero ? ' mm-dest-hero' : '') + '" style="position:relative;width:88px;height:54px;display:flex;flex-direction:column;align-items:center">' +
      '<div style="position:relative;width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px rgba(245,179,1,0.9),0 2px 5px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;font-size:15px">' +
      (m.emoji || '📍') +
      (flag ? '<div style="position:absolute;bottom:-3px;right:-4px;font-size:11px;line-height:11px;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.3))">' + flag + '</div>' : '') +
      '</div>' +
      '<div class="mm-pill" style="margin-top:4px">' + (m.label || '') + '</div>' +
      '</div>'
    );
  }

  // Real going-out places (cafés, restaurants, bars…): a tiny, clean
  // round dot with a whisper-thin amber ring — small enough that a busy
  // street stays tidy, with the place's own emoji still readable.
  if (m.kind === 'place') {
    return (
      '<div style="width:20px;height:20px;border-radius:50%;background:#fff;' +
      'box-shadow:0 0 0 1.3px rgba(245,158,11,0.85),0 1px 3px rgba(0,0,0,0.18);' +
      'display:flex;align-items:center;justify-content:center;font-size:11px">' +
      (m.emoji || '📍') + '</div>'
    );
  }

  const border = m.kind === 'fire' ? '#F43F5E' : m.kind === 'deal' ? '#10B981' : '#7C3AED';
  return (
    '<div style="position:relative;width:34px;height:34px;border-radius:12px;background:#fff;border:2px solid ' + border +
    ';display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 2px 6px rgba(0,0,0,0.25)">' +
    (m.emoji || '📍') + flagBadge + '</div>'
  );
};

export const LeafletMap = ({ center, markers = [], onPress, locate = true, focus = null, lang = 'en', meAvatar = null, meDoing = null }) => {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const meRef = useRef(null);
  const flownRef = useRef(false);
  const locateRef = useRef(locate);
  locateRef.current = locate;
  const langRef = useRef(lang);
  langRef.current = lang;
  const meAvatarRef = useRef(meAvatar);
  meAvatarRef.current = meAvatar;
  const meDoingRef = useRef(meDoing);
  meDoingRef.current = meDoing;

  // init once — open on the whole planet
  useEffect(() => {
    let cancelled = false;
    injectMapStyle();
    loadLeaflet().then((L) => {
      if (cancelled || !L || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, {
        zoomControl: false, attributionControl: false,
        minZoom: 2, maxZoom: 18, worldCopyJump: true, zoomSnap: 0.25,
        preferCanvas: true, // fast rendering for the hand-drawn land
      }).setView([24, 14], 2.5); // Earth view — Egypt/Europe in frame

      // ── COLOURFUL CARTOON MAP, NAME-FREE (neutral) ──
      // CARTO "Voyager · no labels" (light) / "Dark Matter · no labels"
      // (dark): the same colourful, cartoonish landcover and roads, but
      // with NO baked country/place names — so the basemap favours no
      // country. Every name comes from OUR own layer instead, where
      // Israel and Palestine are two equal entries.
      const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
      const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png';
      const mq = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(prefers-color-scheme: dark)') : null;
      const isDark = () => !!(mq && mq.matches);
      const tiles = L.tileLayer(isDark() ? DARK_TILES : LIGHT_TILES, {
        maxZoom: 20, subdomains: 'abcd', className: 'mm-tiles',
        updateWhenIdle: true, keepBuffer: 4,
      }).addTo(map);

      // Zoom-OUT = the real Earth floating in space. Satellite imagery
      // (Esri World Imagery) shows only at the far globe view and fades
      // to the cartoon map as you zoom in — so far out it's a real
      // planet in space, close in it's the friendly colourful map.
      const sat = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, className: 'mm-sat', updateWhenIdle: true, keepBuffer: 2 }
      ).addTo(map);
      const applySat = () => {
        if (!mapRef.current) return;
        const z = map.getZoom();
        sat.setOpacity(z < 4 ? 1 : z < 5.5 ? (5.5 - z) / 1.5 : 0);
      };

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      map.on('zoomend', applySat);
      applySat();

      // follow the OS light/dark switch live: swap tiles + flag container
      const applyTheme = () => {
        if (cancelled || !mapRef.current) return;
        const dark = isDark();
        map.getContainer().classList.toggle('mm-dark', dark);
        tiles.setUrl(dark ? DARK_TILES : LIGHT_TILES);
      };
      applyTheme();
      if (mq) { try { mq.addEventListener('change', applyTheme); } catch (e) { mq.addListener && mq.addListener(applyTheme); } }
      // the cartoon-globe frame — a pure-CSS overlay shown only at the
      // far zoom; masks the flat map into a floating round planet
      const globe = document.createElement('div');
      globe.className = 'mm-globe-frame';
      map.getContainer().appendChild(globe);
      // zoom-aware tidiness (Snap-clean): at the world/continent view
      // NO destination cards show at all — just the calm map, region
      // names and live people. Zoom into a country (z 6–7) and they
      // appear as tiny dots; zoom into a city (z≥8) and the full
      // medallion + name shows. Region names fade at street zoom.
      const applyZoomClasses = () => {
        const el = map.getContainer();
        const z = map.getZoom();
        el.classList.toggle('mm-z-globe', z < 4);        // whole planet → no names, no places
        el.classList.toggle('mm-hide-regions', z >= 9);  // street level → region names off
        el.classList.toggle('mm-z-far', z < 6);          // world → only major region names
        el.classList.toggle('mm-z-city', z >= 8);        // zoomed hard → every place, in full
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

    // OUR OWN country names — every country the same way, in the app's
    // selected language (Arabic where we have it, else the Latin name).
    // Israel and Palestine are two ordinary, equal labels here.
    const useAr = langRef.current === 'ar';
    // place Israel & Palestine SIDE BY SIDE (not stacked): Israel by the
    // coast, Palestine over the West Bank — so both read clearly.
    const FIXED = { Israel: [34.85, 31.35], Palestine: [35.28, 31.95] };
    WORLD.forEach((c) => {
      if (!c.n) return;
      const pt = FIXED[c.n] || c.p;
      if (!pt) return;
      const label = (useAr && c.ar) ? c.ar : c.n;
      const minor = COUNTRY_MAJOR.has(c.n) ? '' : ' mm-region-minor';
      const icon = L.divIcon({
        html: '<div class="mm-country' + minor + '">' + label + '</div>',
        className: '', iconSize: [200, 18], iconAnchor: [100, 9],
      });
      L.marker([pt[1], pt[0]], { icon, interactive: false, zIndexOffset: -100 }).addTo(layerRef.current);
    });

    // your own live pin — only once your REAL location is known. Snap
    // style: YOUR own cartoon character stands on your real spot, with
    // a gold ring, an optional activity badge and a "You" pill.
    if (locateRef.current) {
      const av = meAvatarRef.current;
      const doing = meDoingRef.current;
      const doingBadge = doing
        ? '<div style="position:absolute;top:-6px;left:-6px;background:#fff;border-radius:9px;font-size:12px;line-height:17px;padding:0 2px;box-shadow:0 1px 3px rgba(0,0,0,0.3)">' + doing + '</div>' : '';
      const meHtml = av
        ? '<div class="mm-float" style="position:relative;width:56px;height:66px;display:flex;flex-direction:column;align-items:center">' +
            '<div class="mm-heat"></div>' + glowRing('rgba(245,179,1,0.5)') +
            '<img src="' + av + '" style="position:relative;width:50px;height:50px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 0 0 3px #F5B301, 0 4px 10px rgba(0,0,0,0.3)"/>' +
            doingBadge +
            '<div class="mm-pill" style="margin-top:3px">You ✦</div>' +
          '</div>'
        : '<div style="position:relative;width:56px;height:48px;display:flex;flex-direction:column;align-items:center">' +
            glowRing('rgba(124,58,237,0.5)') +
            '<div style="position:relative;width:22px;height:22px;border-radius:50%;background:#7C3AED;border:3px solid #fff;box-shadow:0 0 0 3px #F5B301, 0 0 0 7px rgba(124,58,237,0.22)"></div>' +
            '<div class="mm-pill" style="margin-top:5px">You ✦</div>' +
          '</div>';
      const meIcon = L.divIcon({
        html: meHtml, className: '',
        iconSize: av ? [56, 66] : [56, 48], iconAnchor: av ? [28, 33] : [28, 11],
      });
      meRef.current = L.marker([center.latitude, center.longitude], { icon: meIcon, zIndexOffset: 1000 }).addTo(layerRef.current);
    }

    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return;
      const isPerson = m.kind === 'person' && m.avatar;
      const isDest = m.kind === 'dest';
      const isPlace = m.kind === 'place';
      const icon = L.divIcon({
        html: pinHtml(m), className: '',
        iconSize: isPerson ? [52, 66] : isDest ? [88, 54] : isPlace ? [20, 20] : [34, 34],
        iconAnchor: isPerson ? [26, 33] : isDest ? [44, 27] : isPlace ? [10, 10] : [17, 34],
      });
      const mk = L.marker([m.lat, m.lng], { icon, zIndexOffset: isPerson ? 500 : isDest ? 300 : 0 }).addTo(layerRef.current);
      if (m.label && !isPerson && !isDest) mk.bindTooltip(m.label, { direction: 'top', offset: [0, -34] });
      mk.on('click', () => onPress && onPress(m));
    });
  };

  // re-draw when data, language, or your own avatar/activity changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L && mapRef.current) draw(window.L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, lang, meAvatar, meDoing]);

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
