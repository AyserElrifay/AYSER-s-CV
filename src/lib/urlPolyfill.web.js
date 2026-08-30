/* ─── DELIBERATELY EMPTY ─────────────────────────────────────────────
   Every browser has had URL and URLSearchParams for a decade. The
   polyfill next door is for React Native's engine, which does not, and
   it is not free: it pulls in whatwg-url-without-unicode and a Buffer
   shim, and those two were 118 KB of the first download — on a phone,
   before anything appeared on screen, to replace something the phone's
   own browser already had.

   Metro prefers a `.web.js` file over its plain neighbour, so simply
   existing is the whole job. The import in src/lib/supabase.js is
   unchanged and still correct on native. */
