/* ── SAVE THE DAY'S PHOTOS, ALL AT ONCE ──────────────────────────────
   After an outing everybody wants everybody's photos, and nobody wants
   to open twenty of them one by one. On a phone that can share files
   (an iPhone, most Androids) the photos go to the phone's own share
   sheet, where "Save images" puts them all in the camera roll in one
   tap. Elsewhere each is downloaded, spaced out — twenty at once is
   how a browser decides something is wrong and stops.

   Two steps, not one: the photos are fetched first, and the share
   sheet opens on the next tap. A phone only lets a page open it right
   after a tap, and fetching twenty photos takes longer than "right
   after". */

const nameFor = (i, type) => 'moments-' + new Date().toISOString().slice(0, 10) + '-' + (i + 1) + (/png/.test(type || '') ? '.png' : '.jpg');

export async function fetchPhotos(urls) {
  const out = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const r = await fetch(urls[i], { mode: 'cors', credentials: 'omit' });
      if (!r.ok) continue;
      const b = await r.blob();
      out.push(new File([b], nameFor(i, b.type), { type: b.type || 'image/jpeg' }));
    } catch (e) { /* one photo that will not come costs one photo */ }
  }
  return out;
}

export const canShareFiles = (files) => {
  try { return !!(files && files.length && navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; }
};

/* true when the phone took them; false when the person closed the sheet */
export async function savePhotos(files, urls) {
  if (canShareFiles(files)) {
    try { await navigator.share({ files }); return true; } catch (e) { return false; }
  }
  if (typeof document === 'undefined') return false;
  const list = files && files.length ? files : null;
  const n = list ? list.length : urls.length;
  for (let i = 0; i < n; i++) {
    try {
      const a = document.createElement('a');
      const href = list ? URL.createObjectURL(list[i]) : urls[i];
      a.href = href; a.download = list ? list[i].name : nameFor(i);
      a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if (list) setTimeout(() => URL.revokeObjectURL(href), 4000);
    } catch (e) { /* keep going */ }
    await new Promise((r) => setTimeout(r, 350));
  }
  return true;
}
