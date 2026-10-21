import React from 'react';
import { View, Platform } from 'react-native';
import qrcode from 'qrcode-generator';

/* a QR code drawn as SVG from a link — sharp at any size, printable */
export const qrSvg = (text, { dark = '#141414', light = '#FFFFFF', margin = 2 } = {}) => {
  const q = (qrcode.default || qrcode)(0, 'M');
  q.addData(String(text));
  q.make();
  return q.createSvgTag({ cellSize: 4, margin, scalable: true }).replace(/fill="black"/g, 'fill="' + dark + '"').replace(/fill="white"/g, 'fill="' + light + '"');
};

export const Qr = ({ value, size = 220 }) => {
  if (Platform.OS !== 'web' || !value) return null;
  return (
    <View style={{ width: size, height: size }}>
      {React.createElement('div', { style: { width: size, height: size }, dangerouslySetInnerHTML: { __html: qrSvg(value) } })}
    </View>
  );
};

/* the card for the table: one sheet, opened in a new tab and printed */
export function printTableCard({ name, link, line, sub }) {
  try {
    const w = window.open('', '_blank');
    if (!w) return false;
    const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(name) + ' · Moments</title>'
      + '<style>@page{size:A6;margin:0}body{margin:0;font-family:Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#141414}'
      + '.c{width:105mm;height:148mm;box-sizing:border-box;padding:12mm 10mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}'
      + '.w{font-size:26px;font-weight:800;color:#7C3AED;letter-spacing:-.5px}.s{color:#F5B301}.q{width:62mm;height:62mm}.q svg{width:100%;height:100%}'
      + 'h1{font-size:20px;margin:0;font-weight:800}p{margin:4px 0 0;font-size:12.5px;color:#555;line-height:1.4}.n{font-size:13px;font-weight:700;color:#141414}</style></head><body>'
      + '<div class="c"><div class="w"><span class="s">✦</span> moments</div>'
      + '<div class="q">' + qrSvg(link) + '</div>'
      + '<div><h1>' + esc(line) + '</h1><p>' + esc(sub) + '</p><p class="n">' + esc(name) + '</p></div></div>'
      + '<script>setTimeout(function(){window.print()},400)</script></body></html>');
    w.document.close();
    return true;
  } catch (e) { return false; }
}
