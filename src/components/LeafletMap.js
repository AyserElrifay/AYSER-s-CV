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

/* THE ANCIENT ATLAS — every land on the planet carries its very
   ancient name for this era, applied to EVERYONE equally and with NO
   exceptions: Kemet, Gaul, Hispania, Persia, Cathay, Tawantinsuyu…
   and the land between the river and the sea by its own ancient-era
   name, Canaan — treated exactly like every other region, no special
   label. Each has a small symbol for its civilization. Names render
   in ONE language: whichever the app is set to (Arabic → the Arabic
   name, everything else → the ancient Latin-script name, which reads
   the same across English/French/Spanish/…). Decorative,
   non-interactive, hidden once you zoom into street level. */
const REGIONS = [
  // ── MENA — the ancient heart ──
  { emoji: '🍇', en: 'Canaan', ar: 'كنعان', lat: 31.55, lng: 35.05 },
  { emoji: '🌞', en: 'Kemet', ar: 'كيمِت', lat: 27.8, lng: 28.8 },
  { emoji: '🏹', en: 'Nubia', ar: 'النوبة', lat: 21.0, lng: 31.0 },
  { emoji: '👑', en: 'Kush', ar: 'كوش', lat: 14.5, lng: 32.5 },
  { emoji: '⛰️', en: 'Sinai', ar: 'سيناء', lat: 29.3, lng: 33.9 },
  { emoji: '🏜️', en: 'Sahara', ar: 'الصحراء الكبرى', lat: 24.5, lng: 8.0 },
  { emoji: '🛶', en: 'The Nile', ar: 'النيل', lat: 26.4, lng: 32.2 },
  { emoji: '🐠', en: 'Red Sea', ar: 'البحر الأحمر', lat: 20.5, lng: 38.3 },
  { emoji: '⛵', en: 'Mediterranean', ar: 'البحر المتوسط', lat: 35.2, lng: 17.5 },
  { emoji: '🫒', en: 'The Levant', ar: 'بلاد الشام', lat: 34.8, lng: 38.2 },
  { emoji: '🐚', en: 'Phoenicia', ar: 'فينيقيا', lat: 34.1, lng: 35.7 },
  { emoji: '📜', en: 'Mesopotamia', ar: 'بلاد الرافدين', lat: 33.2, lng: 43.5 },
  { emoji: '🦁', en: 'Persia', ar: 'بلاد فارس', lat: 32.5, lng: 54.0 },
  { emoji: '🕋', en: 'Hejaz', ar: 'الحجاز', lat: 24.0, lng: 39.5 },
  { emoji: '🐎', en: 'Najd', ar: 'نجد', lat: 25.2, lng: 44.5 },
  { emoji: '🌿', en: 'Sheba', ar: 'سبأ', lat: 15.5, lng: 47.5 },
  { emoji: '⛏️', en: 'Magan', ar: 'مجان', lat: 21.0, lng: 57.0 },
  { emoji: '🌴', en: 'Dilmun', ar: 'دلمون', lat: 25.9, lng: 50.2 },
  { emoji: '🦪', en: 'The Gulf', ar: 'الخليج', lat: 26.6, lng: 51.9 },
  { emoji: '🐫', en: 'The Empty Quarter', ar: 'الربع الخالي', lat: 20.0, lng: 51.0 },
  { emoji: '🐆', en: 'Libu', ar: 'ليبو', lat: 27.0, lng: 17.5 },
  { emoji: '⚓', en: 'Carthage', ar: 'قرطاج', lat: 34.4, lng: 9.5 },
  { emoji: '🐎', en: 'Numidia', ar: 'نوميديا', lat: 34.6, lng: 4.5 },
  { emoji: '🌅', en: 'Mauretania', ar: 'موريطنية', lat: 32.6, lng: -7.5 },
  { emoji: '🏔️', en: 'Atlas Mountains', ar: 'جبال الأطلس', lat: 30.6, lng: -5.5 },
  // ── ancient Europe ──
  { emoji: '🏛️', en: 'Hellas', ar: 'هيلاس', lat: 39.2, lng: 22.0 },
  { emoji: '🐺', en: 'Italia', ar: 'إيطاليا', lat: 42.8, lng: 12.5 },
  { emoji: '🐓', en: 'Gaul', ar: 'بلاد الغال', lat: 47.0, lng: 2.5 },
  { emoji: '🐂', en: 'Hispania', ar: 'هسبانيا', lat: 40.0, lng: -4.0 },
  { emoji: '🧭', en: 'Lusitania', ar: 'لوسيتانيا', lat: 39.5, lng: -8.1 },
  { emoji: '🛡️', en: 'Britannia', ar: 'بريتانيا', lat: 52.8, lng: -1.8 },
  { emoji: '🦌', en: 'Caledonia', ar: 'كاليدونيا', lat: 56.8, lng: -4.2 },
  { emoji: '☘️', en: 'Hibernia', ar: 'هيبرنيا', lat: 53.2, lng: -8.2 },
  { emoji: '🌲', en: 'Germania', ar: 'جرمانيا', lat: 51.0, lng: 10.0 },
  { emoji: '🏰', en: 'Bohemia', ar: 'بوهيميا', lat: 49.8, lng: 15.0 },
  { emoji: '🌾', en: 'Pannonia', ar: 'بانونيا', lat: 47.2, lng: 19.2 },
  { emoji: '🐍', en: 'Dacia', ar: 'داسيا', lat: 45.2, lng: 24.8 },
  { emoji: '🐻', en: 'Carpathians', ar: 'جبال الكاربات', lat: 47.6, lng: 24.6 },
  { emoji: '⚔️', en: 'Thrace', ar: 'تراقيا', lat: 42.2, lng: 25.3 },
  { emoji: '⛰️', en: 'The Balkans', ar: 'البلقان', lat: 43.5, lng: 20.6 },
  { emoji: '🏹', en: 'Sarmatia', ar: 'سارماتيا', lat: 51.5, lng: 23.0 },
  { emoji: '❄️', en: 'Rus', ar: 'روس', lat: 56.0, lng: 38.0 },
  { emoji: '🪓', en: 'Scandinavia', ar: 'إسكندنافيا', lat: 63.0, lng: 15.0 },
  { emoji: '🏔️', en: 'The Alps', ar: 'جبال الألب', lat: 46.4, lng: 9.8 },
  // ── ancient Asia ──
  { emoji: '🐎', en: 'Anatolia', ar: 'الأناضول', lat: 39.0, lng: 33.5 },
  { emoji: '🦅', en: 'The Caucasus', ar: 'القوقاز', lat: 42.5, lng: 44.0 },
  { emoji: '🧵', en: 'Sogdiana', ar: 'صغد', lat: 40.5, lng: 65.5 },
  { emoji: '🐫', en: 'Bactria', ar: 'باختر', lat: 34.8, lng: 66.5 },
  { emoji: '🏇', en: 'The Steppe · Scythia', ar: 'السهوب · سكيثيا', lat: 48.5, lng: 66.0 },
  { emoji: '❄️', en: 'Siberia', ar: 'سيبيريا', lat: 62.0, lng: 95.0 },
  { emoji: '🐘', en: 'Bharat', ar: 'بهارات', lat: 22.5, lng: 79.0 },
  { emoji: '🗻', en: 'The Himalayas', ar: 'الهيمالايا', lat: 28.5, lng: 84.0 },
  { emoji: '🐉', en: 'Cathay', ar: 'كاثاي', lat: 34.5, lng: 105.0 },
  { emoji: '🌸', en: 'Nippon', ar: 'نيبون', lat: 36.8, lng: 138.5 },
  { emoji: '🌄', en: 'Joseon', ar: 'جوسون', lat: 36.5, lng: 127.8 },
  { emoji: '🛕', en: 'Siam', ar: 'سيام', lat: 15.5, lng: 101.0 },
  { emoji: '🌋', en: 'Nusantara', ar: 'نوسانتارا', lat: -1.5, lng: 113.0 },
  // ── ancient Africa ──
  { emoji: '🌺', en: 'Punt', ar: 'بونت', lat: 8.5, lng: 47.5 },
  { emoji: '☕', en: 'Abyssinia', ar: 'الحبشة', lat: 9.0, lng: 39.5 },
  { emoji: '🐬', en: 'Azania', ar: 'أزانيا', lat: -6.5, lng: 38.5 },
  { emoji: '🦓', en: 'The Serengeti', ar: 'سيرينجيتي', lat: -2.5, lng: 34.8 },
  { emoji: '🪙', en: 'Mali Empire', ar: 'إمبراطورية مالي', lat: 14.8, lng: -5.0 },
  { emoji: '📚', en: 'Songhai', ar: 'سونغهاي', lat: 16.5, lng: 1.5 },
  { emoji: '🥁', en: 'Kongo', ar: 'كونغو', lat: -5.5, lng: 16.5 },
  { emoji: '🦍', en: 'Congo Basin', ar: 'حوض الكونغو', lat: -0.8, lng: 23.0 },
  { emoji: '🪨', en: 'Great Zimbabwe', ar: 'زيمبابوي العظمى', lat: -19.5, lng: 30.0 },
  // ── the Americas & Oceania, by their oldest names ──
  { emoji: '🐢', en: 'Turtle Island', ar: 'جزيرة السلحفاة', lat: 42.0, lng: -98.0 },
  { emoji: '⛰️', en: 'The Rockies', ar: 'جبال الروكي', lat: 46.5, lng: -113.0 },
  { emoji: '🦅', en: 'Anáhuac', ar: 'أناواك', lat: 22.5, lng: -101.5 },
  { emoji: '🏝️', en: 'The Caribbean', ar: 'الكاريبي', lat: 15.5, lng: -72.0 },
  { emoji: '🦙', en: 'Tawantinsuyu', ar: 'تاوانتينسويو', lat: -12.5, lng: -74.0 },
  { emoji: '🦜', en: 'The Amazon', ar: 'الأمازون', lat: -4.0, lng: -62.0 },
  { emoji: '🗻', en: 'The Andes', ar: 'الأنديز', lat: -22.0, lng: -67.5 },
  { emoji: '🐧', en: 'Patagonia', ar: 'باتاغونيا', lat: -44.0, lng: -70.0 },
  { emoji: '🦘', en: 'The Outback', ar: 'المناطق النائية', lat: -24.0, lng: 134.0 },
  { emoji: '🥝', en: 'Aotearoa', ar: 'آوتياروا', lat: -43.2, lng: 171.5 },
];

/* The best-known lands, spread across the globe — these stay visible
   even at the far world view; every other name appears as you zoom in,
   keeping the planet light and uncrowded at a glance. */
const REGION_MAJOR = new Set([
  'Canaan', 'Kemet', 'Sahara', 'Mesopotamia', 'Persia', 'Hellas', 'Italia',
  'Hispania', 'Britannia', 'Germania', 'Anatolia', 'The Himalayas', 'Cathay',
  'Nippon', 'Bharat', 'Turtle Island', 'The Amazon', 'Tawantinsuyu',
  'The Outback', 'Abyssinia',
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
    .mm-pill {
      background: rgba(255,255,255,0.97); border-radius: 8px; padding: 1.5px 6.5px; font-size: 9.5px;
      font-weight: 700; color: #1f2937; white-space: nowrap; text-align: center;
      box-shadow: 0 1.5px 5px rgba(0,0,0,0.13);
      font-family: -apple-system, system-ui, sans-serif;
      max-width: 108px; overflow: hidden; text-overflow: ellipsis;
    }
    /* Snap-Map energy: light, summery, colourful. Bright airy landcover
       with lively blues & greens — playful and easy on the eyes. A
       touch lighter than before in the default (light) theme. */
    .mm-tiles { filter: saturate(1.46) contrast(0.96) brightness(1.17); }
    /* DARK MODE — a Snap-style dark planet; the dark tiles need almost
       no filtering, just a hair of life. */
    .mm-dark .mm-tiles { filter: saturate(1.15) contrast(1.02) brightness(0.95); }
    /* clean, chic ancient-atlas names — small editorial caps, widely
       tracked and softly muted, so the map reads calm and elegant, not
       crowded; a tiny civilization symbol sits delicately above each */
    .mm-region {
      font: 600 9.5px -apple-system, system-ui, 'Segoe UI', 'Helvetica Neue', sans-serif;
      color: rgba(72, 64, 104, 0.55); letter-spacing: 2.6px; text-transform: uppercase;
      text-shadow: 0 1px 2px rgba(255,255,255,0.95);
      white-space: nowrap; text-align: center; pointer-events: none;
    }
    /* Arabic isn't a caps script — keep it natural, just small & soft */
    .mm-region.mm-ar {
      font-family: -apple-system, system-ui, 'Segoe UI', 'Tahoma', sans-serif;
      text-transform: none; letter-spacing: 0; font-size: 11px;
    }
    .mm-region-sym {
      font-size: 9.5px; line-height: 10px; margin-bottom: 2px; opacity: 0.6;
      filter: saturate(0.85) drop-shadow(0 1px 1px rgba(255,255,255,0.9));
    }
    /* declutter, tiered for a clean minimal feel:
       • whole-globe view → NO names at all, just people & the map
       • far world view   → only the major regions, no clutter
       • closer in        → every region name appears */
    .mm-z-globe .mm-region { display: none; }
    .mm-z-far .mm-region-minor { display: none; }

    /* ── CARTOON GLOBE (zoomed all the way out) ──
       The flat world is masked into a floating round planet: a circular
       window with a soft sky filling everything outside it, spherical
       shading inside for the 3-D bulge, a chunky cartoon outline and a
       drop shadow so it hovers. Pointer-events off → the map underneath
       stays fully pannable/zoomable. */
    .mm-globe-frame {
      display: none; position: absolute; left: 50%; top: 48%;
      width: min(92vw, 74vh); height: min(92vw, 74vh);
      transform: translate(-50%, -50%); border-radius: 50%;
      pointer-events: none; z-index: 450;
      box-shadow:
        0 0 0 9999px #e9f4ff,
        inset -16px -20px 44px rgba(6,30,66,0.42),
        inset 20px 16px 40px rgba(255,255,255,0.38),
        0 16px 44px rgba(6,30,66,0.30);
      border: 3px solid #16233d;
    }
    .mm-z-globe .mm-globe-frame { display: block; }
    /* extra cartoon pop on the tiles while in globe mode */
    .mm-z-globe .mm-tiles { filter: saturate(1.72) contrast(1.03) brightness(1.14); }
    .mm-dark.mm-z-globe .mm-tiles { filter: saturate(1.2) contrast(1.04) brightness(0.98); }
    /* dark-mode globe: a planet floating in deep space, not on white */
    .mm-dark .mm-globe-frame {
      box-shadow:
        0 0 0 9999px #080c17,
        inset -16px -20px 50px rgba(0,0,0,0.62),
        inset 20px 16px 42px rgba(120,150,205,0.16),
        0 16px 46px rgba(0,0,0,0.6);
      border-color: #2a3550;
    }
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
    .mm-dest { transform-origin: center bottom; transition: transform 0.2s ease, opacity 0.2s ease; }
    .mm-z-far .mm-dest { display: none; }
    .mm-z-mid .mm-dest { transform: scale(0.62); }
    .mm-z-mid .mm-dest .mm-pill { display: none; }
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
      '<div class="mm-dest" style="position:relative;width:88px;height:54px;display:flex;flex-direction:column;align-items:center">' +
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

export const LeafletMap = ({ center, markers = [], onPress, locate = true, focus = null, lang = 'en' }) => {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const meRef = useRef(null);
  const flownRef = useRef(false);
  const locateRef = useRef(locate);
  locateRef.current = locate;
  const langRef = useRef(lang);
  langRef.current = lang;

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
      // CARTO no-labels basemap — colourful cartoonish landcover with
      // modern country names stripped (lands are named by OUR Ancient
      // Atlas layer instead). Theme-aware: the light "Voyager" tiles in
      // normal mode, and the dark tiles when the device is in dark mode,
      // so the planet goes Snap-dark to match the rest of the phone.
      const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
      const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png';
      const mq = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(prefers-color-scheme: dark)') : null;
      const isDark = () => !!(mq && mq.matches);
      const tiles = L.tileLayer(isDark() ? DARK_TILES : LIGHT_TILES, {
        maxZoom: 20, subdomains: 'abcd', className: 'mm-tiles',
        updateWhenIdle: true, keepBuffer: 4, // smoother panning, less churn
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      // follow the OS light/dark switch live: swap tiles + flag the
      // container so the globe frame and names restyle for the theme
      const applyTheme = () => {
        if (cancelled || !mapRef.current) return;
        map.getContainer().classList.toggle('mm-dark', isDark());
        tiles.setUrl(isDark() ? DARK_TILES : LIGHT_TILES);
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
        el.classList.toggle('mm-z-globe', z < 4);        // whole planet → names off
        el.classList.toggle('mm-hide-regions', z >= 9);  // street level → names off
        el.classList.toggle('mm-z-far', z < 6);          // world → majors only, no cards
        el.classList.toggle('mm-z-mid', z >= 6 && z < 8); // region → cards as dots
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

    // the Ancient Atlas — our own text layer: every land by its very
    // ancient name in the app's ONE selected language, each with a
    // small civilization symbol above it. Minor regions hide at the
    // far world view so the map stays light & uncrowded.
    const useAr = langRef.current === 'ar';
    REGIONS.forEach((r) => {
      const label = (useAr && r.ar) ? r.ar : r.en;
      const sym = r.emoji ? '<div class="mm-region-sym">' + r.emoji + '</div>' : '';
      const minor = REGION_MAJOR.has(r.en) ? '' : ' mm-region-minor';
      const arCls = useAr ? ' mm-ar' : '';
      const icon = L.divIcon({
        html: '<div class="mm-region' + minor + arCls + '">' + sym + '<div>' + label + '</div></div>',
        className: '', iconSize: [240, 34], iconAnchor: [120, 17],
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

  // re-draw when data or language changes; keep the current pan/zoom
  useEffect(() => {
    if (typeof window !== 'undefined' && window.L && mapRef.current) draw(window.L);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, lang]);

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
