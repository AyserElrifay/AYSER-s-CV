/* ─── THE MAP HAS TO SPEAK ONE LANGUAGE, AND IT HAS TO BE YOURS ───────
   "وحد اللغه في الخريطه علي حسب لغه الابلكشن" — one language on the
   map, the app's.

   That was impossible with picture tiles: the names are painted into
   the image before it ever reaches the phone. The basemap is drawn
   here now, which means every label is a decision, which means every
   label can be got wrong — a style has a few hundred layers and the
   ones carrying text are not named in any pattern.

   So nothing here trusts a layer's name. The patch rewrites every
   symbol layer that has a text-field, and this asks for exactly that,
   on styles shaped the way real ones are: expressions of five
   different shapes, layers with no text at all, a style that changed
   underneath us.

   No browser, no network, no map:

       node scripts/check-map-language.mjs
*/
import fs from 'node:fs';
import {
  speakStyle, cartoonStyle, momentsStyle, nameExpression, mapLangCode,
  patchCounts, VECTOR_STYLE_URL, CARTOON_COLORS, NIGHT_COLORS,
} from '../src/lib/mapStyle.js';
import { LANGS } from '../src/constants/i18n.js';

let bad = 0;
const is = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + what + '  → ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
};

/* A style shaped like the real one: the five text-field shapes that
   actually occur in OpenMapTiles styles, plus layers with no text. */
const STYLE = {
  version: 8,
  name: 'liberty-ish',
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.example/planet' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
    { id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#a0c8f0' } },
    { id: 'landcover-grass', type: 'fill', 'source-layer': 'landcover', paint: { 'fill-color': '#d8e8c8' } },
    { id: 'landuse-residential', type: 'fill', 'source-layer': 'landuse', paint: { 'fill-color': '#e0dfdf' } },
    { id: 'park', type: 'fill', 'source-layer': 'park', paint: { 'fill-color': '#d8e8c8' } },
    { id: 'building', type: 'fill', 'source-layer': 'building', paint: { 'fill-color': '#e0dfdf' } },
    { id: 'highway-motorway-casing', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#e9ac77' } },
    { id: 'highway-motorway', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#fc8' } },
    { id: 'highway-primary', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#fea' } },
    { id: 'highway-minor', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#fff' } },
    // and the five shapes of label
    { id: 'place-city', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': ['get', 'name:latin'] } },
    { id: 'place-town', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': '{name}' } },
    { id: 'place-village', type: 'symbol', 'source-layer': 'place', layout: { 'text-field': ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']] } },
    { id: 'waterway-name', type: 'symbol', 'source-layer': 'waterway', layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] } },
    { id: 'poi-level-1', type: 'symbol', 'source-layer': 'poi', layout: { 'text-field': ['get', 'name'], 'text-size': 11 } },
    // a symbol layer that draws only an icon: it has no name to speak
    { id: 'poi-icon-only', type: 'symbol', 'source-layer': 'poi', layout: { 'icon-image': 'circle' } },
  ],
};
const LABELLED = 5;    // how many of those really carry text

console.log('which name gets drawn');
is('Arabic asks for name:ar first', nameExpression('ar')[1], ['get', 'name:ar']);
is('and falls back to the international name', nameExpression('ar')[2], ['get', 'name_int']);
is('then a latin transcription', nameExpression('ar')[3], ['get', 'name:latin']);
is('and finally the local name, rather than nothing', nameExpression('ar')[4], ['get', 'name']);
is('it is a coalesce, which is what picks the first that exists', nameExpression('en')[0], 'coalesce');

console.log('\nevery language this app is written in');
/* Straight from the app's own list, so a fourteenth language added to
   the settings screen and forgotten here fails this instead of quietly
   putting one map into English. */
const APP_LANGS = LANGS.map((l) => l.code);
const missing = APP_LANGS.filter((l) => mapLangCode(l) !== l);
is('all ' + APP_LANGS.length + ' of them name a real OpenStreetMap language', missing, []);
is('and something unheard of falls back to one language, not thirty', mapLangCode('xx'), 'en');
is('as does nothing at all', mapLangCode(undefined), 'en');
is('a regional tag still finds its language (pt-BR)', mapLangCode('pt-BR'), 'pt');

console.log('\nevery label on the sheet, whatever shape it was in');
const ar = speakStyle(STYLE, 'ar');
is('all ' + LABELLED + ' label layers were rewritten', patchCounts().labels, LABELLED);
const fields = ar.layers.filter((l) => l.layout && l.layout['text-field']).map((l) => JSON.stringify(l.layout['text-field']));
is('and every one of them now asks for the same thing', new Set(fields).size, 1);
is('specifically, Arabic', JSON.parse(fields[0])[1], ['get', 'name:ar']);
is('the icon-only layer was left alone', ar.layers.find((l) => l.id === 'poi-icon-only').layout['text-field'], undefined);
is('its icon is untouched', ar.layers.find((l) => l.id === 'poi-icon-only').layout['icon-image'], 'circle');
is('and the old {name} template is gone, not wrapped', /\{name\}/.test(JSON.stringify(ar.layers)), false);

console.log('\nand the original is never modified in place');
is('the sheet we were handed still says name:latin', STYLE.layers.find((l) => l.id === 'place-city').layout['text-field'], ['get', 'name:latin']);
is('so switching language twice gives the second language, not both', JSON.stringify(speakStyle(speakStyle(STYLE, 'ar'), 'ja').layers.find((l) => l.id === 'place-city').layout['text-field'])
  .includes('name:ja'), true);

console.log('\nthe colours — "ملونه cartoonish", not the grey-green sheet');
const day = cartoonStyle(STYLE);
const pick = (s, id) => s.layers.find((l) => l.id === id);
is('the land is warm, not white', pick(day, 'background').paint['background-color'], CARTOON_COLORS.land);
is('the water is candy blue', pick(day, 'water').paint['fill-color'], CARTOON_COLORS.water);
is('a park is green', pick(day, 'park').paint['fill-color'], CARTOON_COLORS.green);
is('a motorway is the big warm road', pick(day, 'highway-motorway').paint['line-color'], CARTOON_COLORS.roadBig);
is('a small street is white', pick(day, 'highway-minor').paint['line-color'], CARTOON_COLORS.road);
is('the dark edge under a road is left alone, or roads stop looking like roads',
   pick(day, 'highway-motorway-casing').paint['line-color'], '#e9ac77');
is('grass is grass, whichever layer draws it', pick(day, 'landcover-grass').paint['fill-color'], CARTOON_COLORS.green);
is('but a residential tint is left alone — brighten it and a map becomes a diagram',
   pick(day, 'landuse-residential').paint['fill-color'], '#e0dfdf');

console.log('\nat night — a real palette, not the light one inverted');
const night = cartoonStyle(STYLE, { dark: true });
is('the land goes dark', pick(night, 'background').paint['background-color'], NIGHT_COLORS.land);
is('the water stays water', pick(night, 'water').paint['fill-color'], NIGHT_COLORS.water);
is('and the labels are light enough to read on it', pick(night, 'place-city').paint['text-color'], NIGHT_COLORS.text);
is('with a dark halo behind them', pick(night, 'place-city').paint['text-halo-color'], NIGHT_COLORS.halo);
is('by day the same labels are dark on a light halo', pick(day, 'place-city').paint['text-color'], CARTOON_COLORS.text);

console.log('\nand nothing is smuggled into the style itself');
const out = momentsStyle(STYLE, { lang: 'ja', dark: false });
is('the root keys are exactly the ones a style may have',
   Object.keys(out).filter((k) => !['version', 'name', 'sources', 'layers'].includes(k)), []);
is('it still points at the same tiles', out.sources.openmaptiles.url, STYLE.sources.openmaptiles.url);

console.log('\na style that changed underneath us must be noticed, not ignored');
momentsStyle({ version: 8, layers: [{ id: 'x', type: 'fill', 'source-layer': 'nothing' }] }, { lang: 'ar' });
is('nothing to speak → the count says zero rather than pretending', patchCounts().labels, 0);
is('a style with no layers at all comes back whole', momentsStyle({ version: 8 }, { lang: 'ar' }).version, 8);
is('and so does nothing', momentsStyle(null, { lang: 'ar' }), null);

console.log('\nthe map must never be left blank if any of this fails');
const map = fs.readFileSync('src/components/LeafletMap.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
is('the picture tiles are still added, unconditionally', /L\.tileLayer\([\s\S]{0,400}\}\)\.addTo\(map\)/.test(map), true);
is('and are only removed once the vector map has really drawn', /once\('load', swap\)/.test(map), true);
is('a vector map that errors puts them back', /if \(!map\.hasLayer\(tiles\)\) tiles\.addTo\(map\)/.test(map), true);
is('OpenStreetMap is credited, which its licence requires', /attribution: '© OpenStreetMap'/.test(map), true);
const lib = fs.readFileSync('src/lib/leaflet.js', 'utf8');
is('no WebGL → no vector map, checked before anything is downloaded', /getContext\('webgl2'\)/.test(lib), true);
is('Arabic labels get the right-to-left plugin, or they come out backwards', /setRTLTextPlugin/.test(lib), true);
is('every loader resolves rather than throwing', /onerror = \(\) => resolve\(false\)/.test(lib), true);
is('the tile host is a real one with no key', /^https:\/\/tiles\.openfreemap\.org\//.test(VECTOR_STYLE_URL), true);

if (bad) {
  console.log('\n' + bad + ' wrong. The map is in the wrong language, the wrong colours, or not there at all.');
  process.exit(1);
}
console.log('\nOne map, one language — and the old one underneath it if anything fails.');
