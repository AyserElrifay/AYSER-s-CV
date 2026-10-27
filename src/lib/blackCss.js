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

/* THE WHITE LOOK — the same monochrome turned over (Ayser: the café
   dashboard in two versions, black and white): white ground, black type,
   the main button solid black with a white label. `purple` is a black one
   step off pure (#000001) for the same reason as above. */
export const WHITE = {
  bg: '#FFFFFF', bg2: '#FAFAFA', glass: '#FFFFFF', glassHi: '#F5F5F5', line: '#E5E5E5',
  purple: '#000001', purpleSoft: 'rgba(0,0,0,0.06)', green: '#000000', greenSoft: 'rgba(0,0,0,0.06)',
  blue: '#000000', blueSoft: 'rgba(0,0,0,0.05)', coral: '#262626', coralSoft: 'rgba(0,0,0,0.06)',
  gold: '#000000', sun: '#000000', goldSoft: 'rgba(0,0,0,0.06)',
  text: '#000000', dim: '#525252', faint: '#A3A3A3', ink: '#FFFFFF', float: 'rgba(255,255,255,0.96)', floatSolid: '#FFFFFF',
};
const K1 = 'rgb(0, 0, 1)';
// the white look's stylesheet: the old violet becomes black with white writing; dark grounds keep white writing
function paintWhite(el) {
  const bg = (c) => `[style*="background-color: ${c}"]`;
  const DARKS = [K1, 'rgb(0, 0, 0)', 'rgb(38, 38, 38)'];
  const LIGHTS = ['rgb(255, 255, 255)', 'rgb(250, 250, 250)', 'rgb(245, 245, 245)'];
  el.textContent = HUES.map((c) => `
${bg(c)} { background-color: ${K1} !important; }
[style*="color: ${c}"]:not(${bg(c)}) { color: #000000 !important; }
[style*="border"][style*="${c}"] { border-color: #000000 !important; }
[style*="linear-gradient"][style*="${c}"] { background-image: none !important; background-color: #FAFAFA !important; border: 1px solid #E5E5E5; }`).join('') + `
${bg(K1)}:hover { background-color: #262626 !important; }
${DARKS.concat(HUES).map((c) => `${bg(c)}:not(#mm-z), ${bg(c)} *:not(#mm-z)`).join(', ')} { color: #FFFFFF !important; }
${DARKS.map((c) => LIGHTS.map((d) => `${bg(c)} ${bg(d)}:not(#mm-z):not(#mm-y), ${bg(c)} ${bg(d)} *:not(#mm-z):not(#mm-y)`).join(', ')).join(', ')} { color: #000000 !important; }
${DARKS.map((c) => LIGHTS.map((d) => DARKS.map((e) => `${bg(c)} ${bg(d)} ${bg(e)}:not(#mm-z):not(#mm-y):not(#mm-x), ${bg(c)} ${bg(d)} ${bg(e)} *:not(#mm-z):not(#mm-y):not(#mm-x)`).join(', ')).join(', ')).join(', ')} { color: #FFFFFF !important; }
[role="img"][aria-label="Moments"] { filter: brightness(0); }
html, body { background-color: #FFFFFF !important; }`;
}

const W = 'rgb(255, 255, 254)';
/* a selected chip, a switch or a card painted with any of the palette's
   whites (or the light grey) gets black writing, while anything dark
   inside one keeps white */
const LIGHT = [W, 'rgb(255, 255, 255)', 'rgb(229, 229, 229)'];
const DARK = ['rgb(0, 0, 0)', 'rgb(10, 10, 10)', 'rgb(20, 20, 20)'];
const HUES = ['rgb(124, 58, 237)', 'rgb(91, 33, 182)', 'rgb(109, 40, 217)', 'rgb(43, 16, 85)', 'rgb(255, 194, 51)'];

export function paintBlack(variant) {
  let el = document.getElementById('mm-black');
  if (variant === 'white') {
    if (!el) { el = document.createElement('style'); el.id = 'mm-black'; document.head.appendChild(el); }
    paintWhite(el);
    return;
  }
  const bg = (c) => `[style*="background-color: ${c}"]`;
  const css = HUES.map((c) => `
${bg(c)} { background-color: ${W} !important; }
${bg(c)}:not(#mm-z), ${bg(c)} *:not(#mm-z) { color: #000000 !important; }
[style*="color: ${c}"]:not(${bg(c)}) { color: #FFFFFF !important; }
[style*="border"][style*="${c}"] { border-color: #FFFFFF !important; }
[style*="linear-gradient"][style*="${c}"] { background-image: none !important; background-color: #0A0A0A !important; border: 1px solid #262626; }`).join('') + `
${bg(W)}:hover { background-color: #E5E5E5 !important; }
${LIGHT.map((c) => `${bg(c)}:not(#mm-z), ${bg(c)} *:not(#mm-z)`).join(', ')} { color: #000000 !important; }
${LIGHT.map((c) => DARK.map((d) => `${bg(c)} ${bg(d)}:not(#mm-z):not(#mm-y), ${bg(c)} ${bg(d)} *:not(#mm-z):not(#mm-y)`).join(', ')).join(', ')} { color: #FFFFFF !important; }
${LIGHT.map((c) => DARK.map((d) => LIGHT.map((e) => `${bg(c)} ${bg(d)} ${bg(e)}:not(#mm-z):not(#mm-y):not(#mm-x), ${bg(c)} ${bg(d)} ${bg(e)} *:not(#mm-z):not(#mm-y):not(#mm-x)`).join(', ')).join(', ')).join(', ')} { color: #000000 !important; }
html, body { background-color: #000000 !important; }`;
  if (!el) { el = document.createElement('style'); el.id = 'mm-black'; document.head.appendChild(el); }
  el.textContent = css;
}
