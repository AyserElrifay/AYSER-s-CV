// Green Minds shows sustainability plans, not every outing.
import { isGreen } from '../src/lib/greenKinds.js';
let bad = 0;
const is = (name, got, want) => { const ok = got === want; if (!ok) bad++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (ok ? '' : '  → ' + got)); };
is('a clean-up', isGreen({ kind: 'cleanup', title: 'Nile bank' }), true);
is('a tree-planting project', isGreen({ kind: 'project', title: 'Trees for the school' }), true);
is('a walk that picks up litter', isGreen({ kind: 'walk', title: 'Morning walk & pick-up · مشي الصبح ولمّ الزبالة' }), true);
is('football in the park', isGreen({ kind: 'sport', title: 'Football in the park' }), false);
is('sketching by the Nile', isGreen({ kind: 'art', title: 'Sketching by the Nile' }), false);
is('opera night', isGreen({ kind: 'culture', title: 'Opera night' }), false);
is('a sunset walk', isGreen({ kind: 'walk', title: 'Sunset walk on the corniche' }), false);
is('a language circle', isGreen({ kind: 'circle', title: 'Language exchange circle' }), false);
is('a culture swap', isGreen({ kind: 'circle', title: 'Culture swap · newcomers & locals' }), false);
is('volunteering at the food bank', isGreen({ kind: 'project', title_en: 'Volunteer: packing food boxes at the Egyptian Food Bank' }), true);
is('a school visit', isGreen({ kind: 'project', title_en: 'A school visit: arts or science track?' }), true);
is('a self-development circle', isGreen({ kind: 'circle', title_en: 'A self-development circle · every Saturday' }), false);
console.log(bad ? `\n${bad} wrong.` : '\nGreen Minds is about the places we share, not every plan.');
process.exit(bad ? 1 : 0);
