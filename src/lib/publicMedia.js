/* Where public/media ends up once deployed. app.json sets baseUrl to
   /AYSER-s-CV; reading it back off the page (as the language files do,
   LanguageContext) keeps this right if that ever changes. */
export const publicMedia = (name) => {
  let base = '/';
  try { if (typeof document !== 'undefined' && document.baseURI) base = document.baseURI; } catch (e) {}
  return String(base).replace(/[^/]*$/, '') + 'media/' + name;
};
