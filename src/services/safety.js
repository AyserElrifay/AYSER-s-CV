/* ─── WHAT PEOPLE ARE ALLOWED TO SEND EACH OTHER ─────────────────────
   Ayser asked for two things: no nudity, and no sexual talk pushed at
   people who never asked for it. Both are worth doing, and it matters
   to be precise about which parts of that a piece of software can
   actually deliver.

   ── What actually stops unwanted pictures ──
   Not a filter. The protection that works is structural: a stranger
   cannot send you an image at all. Until you accept their request they
   get three lines of text and nothing else — no photo, no moment, no
   game. That is enforced by a trigger on the messages table, so it
   holds against anything, not only against our own screens. Almost
   every unwanted image anybody receives comes from an account they have
   never spoken to, and this closes that door completely without any
   software ever inspecting a single photo.

   ── What a word list can and cannot do ──
   The check below reads text, not images, and only in conversations
   between people who are not mates. It catches unmistakable sexual
   propositioning from a stranger — the overwhelmingly common case —
   and it is deliberately narrow. It will miss things said in ways it
   doesn't know, in dialect, or in transliteration. It is a speed bump
   in front of the worst first messages, not a guarantee, and nothing
   in the app claims otherwise.

   It never runs between people who have accepted each other. Two adults
   who chose to talk to each other are not our business.

   ── Photographs of people ──
   We do not scan them. Judging whether a picture is nude needs an image
   model, and shipping one would mean a few megabytes of download and
   still getting it wrong in both directions — a swimsuit holiday photo
   blocked, something genuinely bad let through. Instead: strangers
   can't send images at all, every photo can be reported in two taps,
   and reported profile pictures can be removed. If Ayser wants real
   automated detection later, that's a deliberate decision with a real
   cost, not something to slip in quietly. */

/* Unambiguous propositioning. Kept short on purpose: every extra word
   is another innocent message wrongly stopped, and being wrongly
   accused is its own harm. */
const EXPLICIT = [
  /\bnudes?\b/i,
  /\bsend +(?:me +)?(?:a +)?(?:pic|pics|photo) +(?:of +)?(?:your|ur) +(?:body|tits|boobs|ass|dick)\b/i,
  /\b(?:tits|boobs|dick|pussy|horny|blowjob|handjob)\b/i,
  /\bsex(?:ting|ual)? +(?:chat|now|please|pls)\b/i,
  /\bwanna +(?:have +)?sex\b/i,
  /\bshow +me +(?:your|ur) +(?:body|boobs|tits|ass)\b/i,
  // Arabic and common transliteration, same threshold: only the
  // unmistakable ones.
  /نيك|كس\s|طيز|سكس|عايز.{0,10}جنس/i,
  /\bs[e3]x\b/i,
  /\bn[e3][gq]s\b/i,
];

/* Is this message an unmistakable sexual advance? Only asked about
   messages to somebody who has not accepted you. */
export function looksExplicit(text) {
  const t = String(text || '');
  if (t.length < 3) return false;
  return EXPLICIT.some((re) => re.test(t));
}

/* What to say when we stop one. Aimed at the sender, not the person
   receiving it, and written to be plain rather than preachy — the goal
   is that the message doesn't get sent, not that anybody is lectured. */
export const EXPLICIT_BLOCKED =
  "That won't send. You haven't met yet, and this isn't the place for it — say hello like a person first.";

/* The line shown wherever a profile picture is chosen. It's a rule
   people should see before they break it, not a punishment after. */
export const PHOTO_RULE =
  'Keep it clothed. Nude or sexual profile pictures get removed and the account with them.';
