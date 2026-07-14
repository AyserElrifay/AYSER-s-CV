import React, { useRef, useEffect } from 'react';
import { Platform } from 'react-native';

/* A REAL interactive map on web — Leaflet + OpenStreetMap tiles (free,
   no API key). You can pan and zoom, markers sit on true coordinates
   and stay put as you move. Native uses react-native-maps instead, so
   this component only renders on web. */

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

const pinHtml = (m) => {
  const flag = m.flag;
  const flagBadge = flag
    ? '<div style="position:absolute;bottom:-3px;right:-5px;background:#fff;border-radius:8px;font-size:11px;line-height:15px;padding:0 2px;box-shadow:0 1px 3px rgba(0,0,0,0.3)">' + flag + '</div>'
    : '';
  // People show their real photo (Snapchat-style); doing-badge on top.
  if (m.kind === 'person' && m.avatar) {
    const doing = m.emoji && m.emoji.length <= 3
      ? '<div style="position:absolute;top:-6px;left:-6px;background:#fff;border-radius:9px;font-size:11px;line-height:16px;padding:0 2px;box-shadow:0 1px 3px rgba(0,0,0,0.3)">' + m.emoji + '</div>' : '';
    return (
      '<div style="position:relative;width:44px;height:44px">' +
      '<img src="' + m.avatar + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:3px solid #7C3AED;box-shadow:0 2px 6px rgba(0,0,0,0.3)"/>' +
      doing + flagBadge + '</div>'
    );
  }
  const border = m.kind === 'fire' ? '#F43F5E' : m.kind === 'deal' ? '#10B981' : m.kind === 'place' ? '#F59E0B' : '#7C3AED';
  return (
    '<div style="position:relative;width:36px;height:36px;border-radius:12px;background:#fff;border:2px solid ' + border +
    ';display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 6px rgba(0,0,0,0.25)">' +
    (m.emoji || '📍') + flagBadge + '</div>'
  );
};

export const LeafletMap = ({ center, markers = [], onPress }) => {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const meRef = useRef(null);

  const flownRef = useRef(false);

  // init once
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !elRef.current || mapRef.current) return;
      // Open on the whole planet, then fly down to the user — the
      // "start on Earth, zoom into your street" Snap-Map feel.
      const map = L.map(elRef.current, {
        zoomControl: false, attributionControl: false,
        minZoom: 2, worldCopyJump: true, zoomSnap: 0.25,
      }).setView([20, 0], 2.5);
      // CARTO "Voyager" — clean, colourful, cartoonish-but-real (free, no key).
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, subdomains: 'abcd',
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      draw(L);
      setTimeout(() => map.invalidateSize(), 250);
      // Glide from the globe to the user's location.
      setTimeout(() => {
        if (cancelled || !mapRef.current) return;
        flownRef.current = true;
        map.flyTo([center.latitude, center.longitude], 14, { duration: 2.2 });
      }, 700);
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

    // your own live pin
    const meIcon = L.divIcon({
      html: '<div style="width:22px;height:22px;border-radius:50%;background:#7C3AED;border:3px solid #fff;box-shadow:0 0 0 6px rgba(124,58,237,0.25)"></div>',
      className: '', iconSize: [22, 22], iconAnchor: [11, 11],
    });
    meRef.current = L.marker([center.latitude, center.longitude], { icon: meIcon, zIndexOffset: 1000 }).addTo(layerRef.current);

    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return;
      const isPerson = m.kind === 'person' && m.avatar;
      const icon = L.divIcon({ html: pinHtml(m), className: '', iconSize: isPerson ? [44, 44] : [36, 36], iconAnchor: isPerson ? [22, 22] : [18, 36] });
      const mk = L.marker([m.lat, m.lng], { icon }).addTo(layerRef.current);
      if (m.label) mk.bindTooltip(m.label, { direction: 'top', offset: [0, -34] });
      mk.on('click', () => onPress && onPress(m));
    });
  };

  // re-draw when data changes; keep the current pan/zoom
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L && mapRef.current) draw(window.L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  // recenter when the user's real location resolves — glide, don't jump,
  // and only after the intro fly-in has taken over the view.
  useEffect(() => {
    if (mapRef.current && center && flownRef.current) {
      mapRef.current.flyTo([center.latitude, center.longitude], Math.max(mapRef.current.getZoom() || 14, 13), { duration: 1.2 });
      if (typeof window !== 'undefined' && window.L) draw(window.L);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center && center.latitude, center && center.longitude]);

  if (Platform.OS !== 'web') return null;
  // react-dom renders lowercase host tags on web (same as the <video>/<iframe> used elsewhere).
  // zIndex:0 makes the map a stacking context so Leaflet's internal high
  // z-index panes stay BELOW the app's overlay buttons.
  return <div ref={elRef} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 0 }} />;
};
