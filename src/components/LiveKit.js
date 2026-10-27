/* ─── ONE PIECE FOR THE PLACES PEOPLE MEET ────────────────────────────
   The event page (with its games), the Buddies page and the Lounges
   share the card deck and the live service. Asked for one by one from
   different screens, a piece they share is moved into the first
   download — so they travel together, as one piece that arrives the
   first time any of them is opened (src/lib/lazyScreen.js). Every
   lazy import of these three goes through here. */
export { EventRoom } from './EventRoom';
export { BuddiesSheet } from './BuddiesSheet';
export { LoungesSheet } from './LoungesSheet';
export { StampFlow, StampScanner, StampBook, HostQr } from './StampKit';
// the QR drawer travels here too: the café portal asks for it from this piece, so it is never in the first download
export { Qr, printTableCard } from './biz/Qr';
