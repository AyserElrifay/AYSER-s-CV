/* ─── A BOOK AS A PDF ─────────────────────────────────────────────────
   Ayser, November 2026: "لما أعمل داونلود … خليه PDF كامل … كأنه بوك".
   Each page of the Moments Book is drawn on a canvas (MemoryBook.js) and
   handed here as a JPEG; this writes them, one per A4 page, into a real
   PDF file. No library: a PDF of full-page JPEG pictures is a short,
   well-known shape (catalog → pages → page → image), and writing it here
   keeps the app's first download as small as it is. */

const enc = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff; return b; };

/* pages: [{ jpeg: Uint8Array, w, h }] (w × h in pixels) → Blob (application/pdf) */
export function buildPdf(pages, { title = 'The Moments Book' } = {}) {
  const parts = []; let len = 0; const offs = [];
  const put = (x) => { const b = typeof x === 'string' ? enc(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; put(n + ' 0 obj\n'); body(); put('\nendobj\n'); };
  const W = 595.28, H = 841.89;                      // A4 in points
  const n = pages.length;
  // 1 catalog · 2 pages · 3 info · then 3 objects a page: page, contents, image
  const pageId = (i) => 4 + i * 3;
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put('<< /Type /Pages /Count ' + n + ' /Kids [' + pages.map((_, i) => pageId(i) + ' 0 R').join(' ') + '] >>'));
  const safe = String(title).replace(/[^\x20-\x7E]/g, '').replace(/[()\\]/g, '');
  obj(3, () => put('<< /Title (' + safe + ') /Producer (Moments) >>'));
  pages.forEach((p, i) => {
    const id = pageId(i);
    // fit the picture on the page, centred, keeping its shape
    const r = Math.min(W / p.w, H / p.h);
    const dw = (p.w * r).toFixed(2), dh = (p.h * r).toFixed(2);
    const dx = ((W - p.w * r) / 2).toFixed(2), dy = ((H - p.h * r) / 2).toFixed(2);
    const draw = 'q ' + dw + ' 0 0 ' + dh + ' ' + dx + ' ' + dy + ' cm /Im0 Do Q';
    obj(id, () => put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + (id + 2) + ' 0 R >> >> /Contents ' + (id + 1) + ' 0 R >>'));
    obj(id + 1, () => { put('<< /Length ' + draw.length + ' >>\nstream\n'); put(draw); put('\nendstream'); });
    obj(id + 2, () => {
      put('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>\nstream\n');
      put(p.jpeg); put('\nendstream');
    });
  });
  const total = 4 + n * 3;
  const xref = len;
  put('xref\n0 ' + total + '\n0000000000 65535 f \n');
  for (let k = 1; k < total; k++) put(String(offs[k]).padStart(10, '0') + ' 00000 n \n');
  put('trailer\n<< /Size ' + total + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return new Blob(parts, { type: 'application/pdf' });
}

/* a canvas → the JPEG bytes buildPdf wants */
export const canvasJpeg = (c, q = 0.86) => new Promise((resolve) => {
  try {
    c.toBlob(async (b) => { if (!b) return resolve(null); resolve({ jpeg: new Uint8Array(await b.arrayBuffer()), w: c.width, h: c.height }); }, 'image/jpeg', q);
  } catch (e) { resolve(null); }
});

/* save it, or hand it to the phone's share sheet */
export async function savePdf(blob, name) {
  const file = typeof File !== 'undefined' ? new File([blob], name, { type: 'application/pdf' }) : null;
  try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return true; } } catch (e) { if (e && e.name === 'AbortError') return true; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return 'saved';
}
