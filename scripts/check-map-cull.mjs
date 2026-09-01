/* The map only stays smooth while every marker goes through the cull.
   328 live marker nodes made a pinch drop ten frames and freeze for
   150ms on a phone-class CPU; routed through track()/showAt() the same
   view holds 25 and never freezes. One marker is allowed to skip it —
   your own pin, which is always on the map. Anything else added
   straight to the layer would quietly bring the stutter back, so this
   fails the build instead. */
import fs from 'fs';

const SRC = 'src/components/LeafletMap.js';
const src = fs.readFileSync(SRC, 'utf8');
const problems = [];

const direct = [...src.matchAll(/\.addTo\(layerRef\.current\)/g)].length;
if (direct !== 1) {
  problems.push(
    `${direct} markers are added straight to the map layer; exactly one may be ` +
    `(your own pin). Every other marker must go through track(mk, tier) so the ` +
    `cull can take it off the map when it cannot be seen.`
  );
}

const tiers = [...src.matchAll(/track\([^;]*?,\s*\n?\s*([^;]*?)\);/gs)]
  .flatMap((m) => [...m[1].matchAll(/'([a-z-]+)'/g)].map((t) => t[1]));
if (!tiers.length) problems.push('no track(mk, tier) calls found — has the cull been removed?');

const handled = new Set(
  [...src.matchAll(/tier === '([a-z-]+)'/g)].map((m) => m[1])
);
for (const t of new Set(tiers)) {
  if (!handled.has(t)) {
    problems.push(
      `markers are tracked as '${t}' but showAt() never mentions that tier, so ` +
      `they fall through to "always visible" and are never culled.`
    );
  }
}

if (!/map\.on\('moveend', reCull\)/.test(src) || !/map\.on\('zoomend', reCull\)/.test(src)) {
  problems.push('the cull is no longer re-run on moveend and zoomend.');
}

if (problems.length) {
  console.error('The map cull is broken:\n');
  problems.forEach((p) => console.error('  • ' + p + '\n'));
  process.exit(1);
}
console.log(
  `Map cull intact: ${new Set(tiers).size} tiers, all handled, re-run on move and zoom.`
);
