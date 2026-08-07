/* Inline SVG icon set — no network requests, so nothing can fail to load. */
function svg(inner, w) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
    (w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
}

const I = {
  phone: svg('<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 005.5 5.5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A17 17 0 014.5 5.2 2 2 0 016.5 3z"/>'),
  chat: svg('<path d="M21 11.5a8 8 0 01-11.7 7.1L4 20l1.4-4.6A8 8 0 1121 11.5z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  check: svg('<path d="M5 13l4 4L19 7"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  layers: svg('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
  upload: svg('<path d="M12 19V8"/><path d="M7 12l5-5 5 5"/><path d="M4 20h16"/>'),
  trash: svg('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 1110 3.2 7 7 0 0020 14.5z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>'),
  out: svg('<path d="M15 12H4"/><path d="M8 8l-4 4 4 4"/><path d="M11 4h6a2 2 0 012 2v12a2 2 0 01-2 2h-6"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
};

/* The Twelve mark: disc + 4-point star cut out of it + 12 bezel ticks.
   The star is filled with the surrounding surface colour so the mark
   inverts correctly between light and dark themes on its own. */
function compassMark(cutoutVar) {
  const cut = cutoutVar || "--bg";
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    ticks += '<line x1="' + (50 + 41 * Math.cos(a)).toFixed(1) + '" y1="' + (54 + 41 * Math.sin(a)).toFixed(1) +
      '" x2="' + (50 + 46 * Math.cos(a)).toFixed(1) + '" y2="' + (54 + 46 * Math.sin(a)).toFixed(1) + '"/>';
  }
  return '<svg viewBox="0 0 100 100" style="overflow:visible">' +
    '<g stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' + ticks + "</g>" +
    '<circle cx="50" cy="54" r="40" fill="currentColor"/>' +
    '<path d="M50,15 L59,45 L89,54 L59,63 L50,93 L41,63 L11,54 L41,45 Z" style="fill:var(' + cut + ')"/></svg>';
}

function hydrateIcons(root) {
  (root || document).querySelectorAll("[data-i]").forEach(function (el) {
    const n = el.getAttribute("data-i");
    if (I[n]) el.innerHTML = I[n];
  });
}
