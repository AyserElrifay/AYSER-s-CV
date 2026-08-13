import { C } from '../../constants/theme';

/* ─── لمّة · THE FOUR CHANNELS ────────────────────────────────────────
   Four answers, told apart by colour AND by shape — never colour alone.
   One in twelve men cannot reliably separate red from green, and a quiz
   that punishes them for it is not a quiz, it is a hearing test. The
   shape carries the same information the colour does, so nobody has to
   ask which one is which.

   DELIBERATELY NOT KAHOOT'S. Red triangle, blue diamond, gold circle,
   green square is their signature — as much theirs as the shade of a
   drinks can is somebody's. Copying it would make لمّة read as a
   knock-off of a game people already know, which is the fastest way to
   be seen as the cheap version of something rather than a thing of your
   own. So: no triangle, no diamond, no filled circle, no square, and
   the colours are Moments' own.

   Positions are FIXED on screen and do not mirror in Arabic. The
   colours and shapes are the muscle memory — the top-left tile being
   the purple hexagon has to stay true whichever way the language runs,
   or a bilingual player has to relearn the board every time they switch
   language.                                                           */

export const CHANNELS = [
  { id: 0, key: 'hex',     color: C.purple, soft: C.purpleSoft, icon: 'hexagon',        lib: 'mci' },
  { id: 1, key: 'cross',   color: C.coral,  soft: C.coralSoft,  icon: 'plus-thick',     lib: 'mci' },
  { id: 2, key: 'ring',    color: C.green,  soft: C.greenSoft,  icon: 'circle-outline', lib: 'mci' },
  { id: 3, key: 'chevron', color: C.blue,   soft: C.blueSoft,   icon: 'chevron-up',     lib: 'mci' },
];

export const channelFor = (index) => CHANNELS[index] || CHANNELS[0];
