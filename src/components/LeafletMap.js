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

const pinHtml = (emoji, kind) => {
  const border = kind === 'fire' ? '#F43F5E' : kind === 'venue' ? '#7C3AED' : '#7C3AED';
  return (
    '<div style="width:36px;height:36px;border-radius:12px;background:#fff;border:2px solid ' + border +
    ';display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 6px rgba(0,0,0,0.25)">' +
    emoji + '</div>'
  );
};

export const LeafletMap = ({ center, markers = [], onPress }) => {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const meRef = useRef(null);

  // init once
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || !elRef.current || mapRef.current) return;
      const map = L.map(elRef.current, { zoomControl: false, attributionControl: false })
        .setView([center.latitude, center.longitude], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
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

    // your own live pin
    const meIcon = L.divIcon({
      html: '<div style="width:22px;height:22px;border-radius:50%;background:#7C3AED;border:3px solid #fff;box-shadow:0 0 0 6px rgba(124,58,237,0.25)"></div>',
      className: '', iconSize: [22, 22], iconAnchor: [11, 11],
    });
    meRef.current = L.marker([center.latitude, center.longitude], { icon: meIcon, zIndexOffset: 1000 }).addTo(layerRef.current);

    markers.forEach((m) => {
      if (m.lat == null || m.lng == null) return;
      const icon = L.divIcon({ html: pinHtml(m.emoji || '📍', m.kind), className: '', iconSize: [36, 36], iconAnchor: [18, 36] });
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

  // recenter when the user's real location resolves
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setView([center.latitude, center.longitude], mapRef.current.getZoom() || 14);
      if (typeof window !== 'undefined' && window.L) draw(window.L);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center && center.latitude, center && center.longitude]);

  if (Platform.OS !== 'web') return null;
  // react-dom renders lowercase host tags on web (same as the <video>/<iframe> used elsewhere)
  return <div ref={elRef} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />;
};
