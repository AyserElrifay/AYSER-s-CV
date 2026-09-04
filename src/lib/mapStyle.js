/* ─── THE MAP SPEAKS ONE LANGUAGE: YOURS ─────────────────────────────
   Ayser: "الخريطه شكلها ممل و كبير في السن كائيب خليها ملونه cartoonish
   هتبقي احسن ووحد اللغه في الخريطه علي حسب لغه الابلكشن".

   Two complaints, and the second one cannot be fixed at all with the
   map we had. Raster tiles arrive as PICTURES with the names already
   painted into them, in whatever language the place uses: an Arabic
   speaker flying from القاهرة to Praha to 北京 reads three alphabets on
   one map and can look up none of them. Nothing on our side can change
   a word of that, because by the time a tile reaches us it is a PNG.

   Vector tiles arrive as DATA — the shape of a road, the position of a
   city, and every name that city has. The label is drawn on the phone,
   which means we get to choose which name to draw. That is the whole
   reason for the change: a map in the app's own language, everywhere,
   including places nobody at OpenStreetMap wrote an English name for.

   And the same move answers the first complaint, because the colours
   are ours now too instead of the grey-green of the default OSM sheet.

   Everything in this file is a pure function on a style object, so all
   of it can be checked without a browser, a map or a network:

       node scripts/check-map-language.mjs
*/

/* OpenFreeMap: OpenStreetMap data, vector tiles, no account, no API
   key, no request limit, and it may be used commercially — which is
   what we need after CARTO started stamping "API KEY REQUIRED" across
   a person's own map. Attribution is required and is given on the map.

   "liberty" is the bright, friendly sheet. We repaint parts of it
   below; the language is rewritten for every label on it. */
export const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/* The app's languages, in the name OpenStreetMap uses for them. Every
   one of these really exists in the tiles as `name:xx`; a language we
   do not list simply falls through to the international name, which is
   still one language for the whole map rather than thirty. */
const OSM_LANG = {
  en: 'en', ar: 'ar', es: 'es', fr: 'fr', it: 'it', ja: 'ja', ko: 'ko',
  nl: 'nl', pt: 'pt', ro: 'ro', ru: 'ru', tr: 'tr', zh: 'zh',
};

export const mapLangCode = (lang) => OSM_LANG[String(lang || 'en').slice(0, 2).toLowerCase()] || 'en';

/* WHICH name to draw, in order of preference:
     1. the name in your language — القاهرة for an Arabic reader;
     2. the international name, when the place has no name in it;
     3. the latin transcription, so 北京 is at least readable;
     4. the local name, which is better than an unlabelled dot.
   `coalesce` takes the first of those that exists, per label, on the
   phone, as the map draws. */
export function nameExpression(lang) {
  const code = mapLangCode(lang);
  return ['coalesce',
    ['get', 'name:' + code],
    ['get', 'name_int'],
    ['get', 'name:latin'],
    ['get', 'name'],
  ];
}

/* ── EVERY LABEL, NOT THE ONES WE THOUGHT OF ─────────────────────────
   A style has a few hundred layers and the label ones are not named
   predictably — "place_label_city", "poi_z14", "waterway-name". So
   this does not go looking for layers by name: it rewrites the
   text-field of EVERY symbol layer that has one, whatever shape the
   original expression was in. A layer we failed to think of is a
   sentence in the wrong alphabet on somebody's map. */
let lastSpoken = 0;
let lastPainted = 0;
/* How much the last patch actually touched — a style that changed
   underneath us and now matches nothing would otherwise fail silently,
   as a map that looks exactly like everybody else's. */
export const patchCounts = () => ({ labels: lastSpoken, painted: lastPainted });

export function speakStyle(style, lang) {
  if (!style || !Array.isArray(style.layers)) return style;
  const name = nameExpression(lang);
  let touched = 0;
  const layers = style.layers.map((layer) => {
    const layout = layer && layer.layout;
    if (!layout || layout['text-field'] === undefined) return layer;
    touched++;
    return { ...layer, layout: { ...layout, 'text-field': name } };
  });
  /* Nothing extra is added to the style object itself: MapLibre
     validates the root and complains about keys it does not know, and a
     warning nobody reads is how a real one gets missed. The count is
     available to whoever wants it, separately. */
  lastSpoken = touched;
  return { ...style, layers };
}

/* ── THE COLOURS ─────────────────────────────────────────────────────
   "ممل و كبير في السن كائيب" — dull, elderly, depressing. It was: pale
   green land, grey roads, white everything.

   These are the six things a person actually sees from far away, and
   nothing else is touched — a style is a living thing maintained by
   somebody else, and a patch that reaches into two hundred layers
   breaks the next time they change one. Water, land, green space,
   sand, buildings and the big roads carry the whole mood of a map. */
const CARTOON = {
  water: '#7FD1F0',
  land: '#FBF6E9',
  green: '#A8E6A1',
  sand: '#FBE7A8',
  building: '#EBDFCB',
  road: '#FFFFFF',
  roadBig: '#FFD37A',
  roadMid: '#FFE9B8',
  text: '#33413E',
  halo: 'rgba(255,255,255,0.92)',
};

/* ── AND AT NIGHT ────────────────────────────────────────────────────
   The old dark map was the light one turned inside out by a CSS
   filter — invert, spin the hue back, hope. It was the cheapest
   possible answer to "OpenStreetMap has no dark tiles" and it looked
   it: grey mud with the labels fighting to stay legible.

   With the colours in our hands there is no reason for a trick. This
   is a night palette, painted on purpose: deep blue water, near-black
   land, roads that glow just enough to follow. */
const NIGHT = {
  water: '#12395C',
  land: '#111A26',
  green: '#163323',
  sand: '#2A2A1E',
  building: '#1B2635',
  road: '#3A4A5E',
  roadBig: '#6A5A3A',
  roadMid: '#4A4436',
  text: '#DCE6F0',
  halo: 'rgba(4,10,18,0.9)',
};

/* Which of those a layer is, decided by what the layer DRAWS rather
   than by its name, wherever that is possible: the source-layer is
   part of the tile schema and changes far less often than a style's
   own layer ids. */
const paintFor = (layer, C) => {
  const id = String(layer.id || '').toLowerCase();
  const sl = String(layer['source-layer'] || '').toLowerCase();
  if (layer.type === 'background') return { 'background-color': C.land };
  if (layer.type === 'fill') {
    if (sl === 'water' || /water|ocean|sea|river|lake/.test(id)) return { 'fill-color': C.water };
    if (/sand|beach|desert/.test(id)) return { 'fill-color': C.sand };
    if (/park|wood|forest|grass|green|garden|golf|pitch|cemetery/.test(id)) return { 'fill-color': C.green };
    if (sl === 'building' || /building/.test(id)) return { 'fill-color': C.building };
    /* Everything else a landuse layer draws — residential, industrial,
       hospital grounds — is a faint tint that carries no mood and reads
       as a diagram the moment you brighten it. Left as it was. */
    return null;
  }
  if (layer.type === 'line' && (sl === 'transportation' || /road|street|highway|motorway|trunk|primary/.test(id))) {
    if (/casing|outline/.test(id)) return null;  // the darker edge under a road is what makes it read as a road
    if (/motorway|trunk/.test(id)) return { 'line-color': C.roadBig };
    if (/primary|secondary/.test(id)) return { 'line-color': C.roadMid };
    return { 'line-color': C.road };
  }
  /* A label has to be readable on whatever it lands on, and that is
     the one thing a colour change can quietly break: dark grey text on
     near-black land at night is a map with no names on it. */
  if (layer.type === 'symbol' && layer.layout && layer.layout['text-field'] !== undefined) {
    return { 'text-color': C.text, 'text-halo-color': C.halo, 'text-halo-width': 1.4 };
  }
  return null;
};

export function cartoonStyle(style, { dark } = {}) {
  if (!style || !Array.isArray(style.layers)) return style;
  const C = dark ? NIGHT : CARTOON;
  let painted = 0;
  const layers = style.layers.map((layer) => {
    const patch = paintFor(layer, C);
    if (!patch) return layer;
    painted++;
    return { ...layer, paint: { ...(layer.paint || {}), ...patch } };
  });
  lastPainted = painted;
  return { ...style, layers };
}

/* Both at once — what the map actually asks for. */
export function momentsStyle(style, { lang, dark } = {}) {
  return cartoonStyle(speakStyle(style, lang), { dark });
}

export const CARTOON_COLORS = CARTOON;
export const NIGHT_COLORS = NIGHT;
