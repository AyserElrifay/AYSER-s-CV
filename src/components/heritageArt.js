/* ─── THE MONUMENTS AND THE TOKENS ────────────────────────────────────
   Both games need to draw the same six places, so the drawing lives in
   one file: the climb paints the monument behind the tower, the crossing
   paints it on the far bank as the thing you are crossing towards.

   All six are ancient, public heritage and every one of them here is
   built out of plain shapes — arcs, triangles, rectangles — written by
   hand. Nothing is traced, copied, or lifted from anyone's artwork.   */

/* ── the monument, drawn from its base ──────────────────────────────
   (x, baseY) is where it meets the ground; s scales the whole thing.
   Two tones per place — a lit face and a shaded one — so it reads as
   architecture in silhouette rather than a flat sticker.            */
export function drawMonument(c, place, x, baseY, s, opts) {
  const o = opts || {};
  const lit = o.lit || place.stone;
  const dark = o.dark || place.stoneDark;
  c.save();
  c.translate(x, baseY);
  c.scale(s, s);
  if (o.alpha != null) c.globalAlpha = o.alpha;

  if (place.id === 'giza') {
    // the small pyramid behind, then the great one, then an obelisk
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(-160, 0); c.lineTo(-92, -96); c.lineTo(-24, 0); c.closePath(); c.fill();
    c.fillStyle = lit;
    c.beginPath(); c.moveTo(-70, 0); c.lineTo(30, -170); c.lineTo(130, 0); c.closePath(); c.fill();
    c.fillStyle = dark;                                   // the shaded east face
    c.beginPath(); c.moveTo(30, -170); c.lineTo(130, 0); c.lineTo(58, 0); c.closePath(); c.fill();
    c.fillStyle = lit;                                    // obelisk
    c.fillRect(150, -110, 15, 110);
    c.beginPath(); c.moveTo(150, -110); c.lineTo(157.5, -132); c.lineTo(165, -110); c.closePath(); c.fill();

  } else if (place.id === 'petra') {
    // a facade carved INTO the cliff: the rock first, the cut second
    c.fillStyle = dark;
    c.fillRect(-150, -230, 300, 230);
    c.fillStyle = lit;
    c.fillRect(-92, -190, 184, 190);                       // the cut face
    c.fillStyle = dark;
    for (let i = 0; i < 6; i++) c.fillRect(-80 + i * 30, -150, 13, 150);   // columns
    c.fillStyle = lit;
    c.beginPath(); c.moveTo(-96, -150); c.lineTo(0, -206); c.lineTo(96, -150); c.closePath(); c.fill();
    c.fillStyle = dark;
    c.fillRect(-16, -78, 32, 78);                          // the doorway
    c.fillStyle = lit;                                     // the urn on the crown
    c.beginPath(); c.ellipse(0, -216, 11, 15, 0, 0, 7); c.fill();
    c.fillRect(-4, -232, 8, 12);

  } else if (place.id === 'marrakech') {
    // a square minaret with arched openings and three finial spheres
    c.fillStyle = lit;
    c.fillRect(-46, -250, 92, 250);
    c.fillStyle = dark;
    c.fillRect(16, -250, 30, 250);                         // shaded side
    c.fillStyle = place.deep;
    for (let i = 0; i < 4; i++) {
      const y = -228 + i * 52;
      c.beginPath(); c.moveTo(-26, y + 30); c.lineTo(-26, y + 8);
      c.arc(-16, y + 8, 10, Math.PI, 0); c.lineTo(-6, y + 30); c.closePath(); c.fill();
    }
    c.fillStyle = lit;
    c.fillRect(-56, -262, 112, 14);                        // the crown
    c.fillStyle = place.accent;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, -276 - i * 15, 9 - i * 2.4, 0, 7); c.fill(); }

  } else if (place.id === 'rome') {
    // three tiers of arches, curved away from the viewer
    for (let tier = 0; tier < 3; tier++) {
      const h = 62, top = -h * (tier + 1);
      c.fillStyle = tier === 2 ? dark : lit;
      c.fillRect(-165, top, 330, h);
      c.fillStyle = place.deep;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const ax = -150 + i * 34;
        const squash = 1 - Math.abs(i - (n - 1) / 2) / (n * 0.9);   // the curve
        c.save();
        c.translate(ax + 11, top + h - 6);
        c.scale(Math.max(0.28, squash), 1);
        c.beginPath();
        c.moveTo(-11, 0); c.lineTo(-11, -22); c.arc(0, -22, 11, Math.PI, 0); c.lineTo(11, 0);
        c.closePath(); c.fill();
        c.restore();
      }
    }
    c.fillStyle = dark;
    c.fillRect(60, -186, 105, 186);                        // the broken half, in shade

  } else if (place.id === 'agra') {
    // an onion dome on a plinth between four slim minarets
    c.fillStyle = lit;
    c.fillRect(-150, -34, 300, 34);                        // plinth
    [-126, -96, 96, 126].forEach((mx, i) => {
      c.fillStyle = i % 2 ? dark : lit;
      c.fillRect(mx - 8, -190, 16, 156);
      c.beginPath(); c.arc(mx, -190, 11, Math.PI, 0); c.fill();
      c.fillRect(mx - 1.5, -216, 3, 18);
    });
    c.fillStyle = lit;
    c.fillRect(-74, -150, 148, 116);                        // the block
    c.fillStyle = place.deep;
    c.beginPath();                                          // the great arch
    c.moveTo(-30, -34); c.lineTo(-30, -104); c.arc(0, -104, 30, Math.PI, 0); c.lineTo(30, -34);
    c.closePath(); c.fill();
    c.fillStyle = lit;                                      // the dome
    c.beginPath();
    c.moveTo(-56, -150);
    c.bezierCurveTo(-62, -214, -30, -238, 0, -240);
    c.bezierCurveTo(30, -238, 62, -214, 56, -150);
    c.closePath(); c.fill();
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(20, -150); c.bezierCurveTo(40, -196, 44, -216, 26, -234);
    c.bezierCurveTo(46, -226, 62, -196, 56, -150);
    c.closePath(); c.fill();
    c.fillStyle = place.accent;
    c.fillRect(-2, -262, 4, 24);

  } else {
    // kyoto — five tiers, each roof wider than the body it sits on
    for (let i = 0; i < 5; i++) {
      const w = 132 - i * 18, y = -46 - i * 46;
      c.fillStyle = i % 2 ? dark : lit;
      c.fillRect(-w / 2 + 12, y, w - 24, 40);               // the storey
      c.fillStyle = place.deep;                              // the eaves, swept up
      c.beginPath();
      c.moveTo(-w / 2 - 14, y);
      c.quadraticCurveTo(0, y - 20, w / 2 + 14, y);
      c.quadraticCurveTo(0, y - 6, -w / 2 - 14, y);
      c.closePath(); c.fill();
    }
    c.fillStyle = place.accent;
    c.fillRect(-2.5, -300, 5, 40);                           // the spire
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0, -292 + i * 9, 6 - i, 0, 7); c.fill(); }
  }

  c.restore();
}

/* ── the collectible of the place ───────────────────────────────────
   Not a coin with a flag on it — the actual object you would be handed
   or shown there. Drawn centred on (x, y), r is roughly its radius.  */
export function drawToken(c, kind, x, y, r, t) {
  const bob = Math.sin((t || 0) * 0.005 + x * 0.05) * 2;
  c.save();
  c.translate(x, y + bob);
  c.scale(r / 14, r / 14);

  // the glow that says "this is worth having"
  const g = c.createRadialGradient(0, 0, 2, 0, 0, 22);
  g.addColorStop(0, 'rgba(255,210,63,0.35)');
  g.addColorStop(1, 'rgba(255,210,63,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, 22, 0, 7); c.fill();

  if (kind === 'scarab') {
    c.fillStyle = '#1B7F6B';
    c.beginPath(); c.ellipse(0, 1, 9, 11, 0, 0, 7); c.fill();
    c.fillStyle = '#FFD23F';
    c.beginPath(); c.ellipse(0, -8, 5.5, 4.5, 0, 0, 7); c.fill();     // head
    c.strokeStyle = '#0E4C40'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 11); c.stroke();       // wing split
    c.strokeStyle = '#FFD23F'; c.lineWidth = 1.4;
    [-1, 1].forEach((s) => {
      c.beginPath(); c.moveTo(s * 8, -4); c.lineTo(s * 13, -8); c.stroke();
      c.beginPath(); c.moveTo(s * 9, 3); c.lineTo(s * 14, 4); c.stroke();
    });

  } else if (kind === 'urn') {
    c.fillStyle = '#E9A46A';
    c.beginPath();
    c.moveTo(-7, -6); c.bezierCurveTo(-12, 4, -8, 12, 0, 12);
    c.bezierCurveTo(8, 12, 12, 4, 7, -6);
    c.closePath(); c.fill();
    c.fillStyle = '#C2624A';
    c.fillRect(-8, -10, 16, 4);
    c.strokeStyle = '#C2624A'; c.lineWidth = 2;
    [-1, 1].forEach((s) => { c.beginPath(); c.arc(s * 8, -1, 5, -1.2, 1.2, s < 0); c.stroke(); });

  } else if (kind === 'tea') {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.moveTo(-7, -9); c.lineTo(-5, 11); c.lineTo(5, 11); c.lineTo(7, -9); c.closePath(); c.fill();
    c.fillStyle = '#C8912F';
    c.beginPath(); c.moveTo(-6, -2); c.lineTo(-5, 10); c.lineTo(5, 10); c.lineTo(6, -2); c.closePath(); c.fill();
    c.fillStyle = '#2FBFA0';                                   // the mint
    c.beginPath(); c.ellipse(-2, -11, 4.5, 3, -0.5, 0, 7); c.fill();
    c.beginPath(); c.ellipse(3, -12, 4, 2.6, 0.4, 0, 7); c.fill();

  } else if (kind === 'laurel') {
    c.strokeStyle = '#4C9A4A'; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 0, 9, 0.5, Math.PI - 0.5); c.stroke();
    c.beginPath(); c.arc(0, 0, 9, Math.PI + 0.5, -0.5); c.stroke();
    c.fillStyle = '#69C46A';
    for (let i = 0; i < 10; i++) {
      const a = 0.6 + i * 0.55;
      c.save(); c.rotate(a); c.translate(0, -10);
      c.beginPath(); c.ellipse(0, 0, 2.2, 4.2, 0, 0, 7); c.fill();
      c.restore();
    }

  } else if (kind === 'lotus') {
    c.fillStyle = '#F49FC8';
    for (let i = -2; i <= 2; i++) {
      c.save(); c.rotate(i * 0.42);
      c.beginPath(); c.ellipse(0, -6, 3.4, 10, 0, 0, 7); c.fill();
      c.restore();
    }
    c.fillStyle = '#FFD23F';
    c.beginPath(); c.arc(0, 1, 4, 0, 7); c.fill();

  } else {
    // a folded paper crane: two wings, a neck and a tail, all triangles
    c.fillStyle = '#FFFFFF';
    c.beginPath(); c.moveTo(-12, -2); c.lineTo(0, -10); c.lineTo(2, 4); c.closePath(); c.fill();
    c.fillStyle = '#E6ECF5';
    c.beginPath(); c.moveTo(12, -3); c.lineTo(0, -10); c.lineTo(2, 4); c.closePath(); c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath(); c.moveTo(0, -9); c.lineTo(-9, -14); c.lineTo(-4, -6); c.closePath(); c.fill();   // neck
    c.beginPath(); c.moveTo(1, -6); c.lineTo(11, -13); c.lineTo(7, -2); c.closePath(); c.fill();     // tail
  }

  c.restore();
}
