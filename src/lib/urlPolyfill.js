/* React Native's JS engine has no URL and no URLSearchParams, and
   Supabase builds both. This is the fill.

   There is a `.web.js` beside this file that is deliberately empty —
   see it for why. Metro picks that one when it is building for the
   browser, so the polyfill and everything it drags in stay out of the
   web bundle entirely. */
import 'react-native-url-polyfill/auto';
