/* Moments Black's palette and stylesheet — see black.js for why they exist */

/* MOMENTS BLACK — for Moments Black members, and for now Moments+ too
   (a gift to try it). Ayser: "Pure
   Monochrome": OLED black, pure white, razor-thin neutral-800 lines, and
   the main button inverted — solid white, black label. `purple` is a
   white one step off pure (#FFFFFE) so the stylesheet below can find every
   button painted with it and turn its label black. */
export const BLACK = {
  bg: '#000000', bg2: '#0A0A0A', glass: '#0A0A0A', glassHi: '#141414', line: '#1F1F1F',
  purple: '#FFFFFE', purpleSoft: 'rgba(255,255,255,0.08)', green: '#FFFFFF', greenSoft: 'rgba(255,255,255,0.08)',
  blue: '#FFFFFF', blueSoft: 'rgba(255,255,255,0.06)', coral: '#E5E5E5', coralSoft: 'rgba(255,255,255,0.08)',
  gold: '#FFFFFF', sun: '#FFFFFF', goldSoft: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF', dim: '#A3A3A3', faint: '#737373', ink: '#000000', float: 'rgba(10,10,10,0.96)', floatSolid: '#0A0A0A',
};

const W = 'rgb(255, 255, 254)';
const HUES = ['rgb(124, 58, 237)', 'rgb(91, 33, 182)', 'rgb(109, 40, 217)', 'rgb(43, 16, 85)', 'rgb(255, 194, 51)'];

export function paintBlack() {
  let el = document.getElementById('mm-black');
  const bg = (c) => `[style*="background-color: ${c}"]`;
  const css = HUES.map((c) => `
${bg(c)} { background-color: ${W} !important; }
${bg(c)}:not(#mm-z), ${bg(c)} *:not(#mm-z) { color: #000000 !important; }
[style*="color: ${c}"]:not(${bg(c)}) { color: #FFFFFF !important; }
[style*="border"][style*="${c}"] { border-color: #FFFFFF !important; }
[style*="linear-gradient"][style*="${c}"] { background-image: none !important; background-color: #0A0A0A !important; border: 1px solid #262626; }`).join('') + `
${bg(W)}:hover { background-color: #E5E5E5 !important; }
${bg(W)}:not(#mm-z), ${bg(W)} *:not(#mm-z) { color: #000000 !important; }
html, body { background-color: #000000 !important; }`;
  if (!el) { el = document.createElement('style'); el.id = 'mm-black'; document.head.appendChild(el); }
  el.textContent = css;
}
