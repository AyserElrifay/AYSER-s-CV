/* a YouTube link (watch, youtu.be, embed, shorts, live) or a bare id → the 11-character id, or null.
   Its own small file so a screen can read a link without loading the player (components/lamma/YtKaraoke). */
export const ytId = (s) => {
  const t = String(s || '').trim();
  const m = t.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/) || t.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
};
