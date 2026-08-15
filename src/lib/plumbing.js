import { STRINGS } from '../constants/i18n';

/* ─── THE APP'S PLUMBING IS NOT FOR THE PEOPLE USING IT ───────────────
   Fifteen screens were telling whoever was holding the phone to "run
   supabase/RUN_ME.sql in the Supabase SQL Editor". One of them told
   them to "ping Ayser to switch it on". These are notes from a
   developer to himself that ended up printed on strangers' screens: a
   file they cannot open, a tool they do not have, and a name they do
   not know.

   The sentence is not wrong, it is just addressed to the wrong person.
   So it goes to the right one. Ayser opens the same screen and reads
   the real instruction, because he is the only person who can act on
   it; everybody else reads that this part is still being set up, which
   is both true and all they need.

   Groups already worked this way (SearchModal passes owner={…}); this
   is that idea in one place, so a screen does not have to be holding a
   user object to get it right.

   ── WHY IT IS NOT A HOOK ──
   These sentences are chosen inside catch blocks, service calls and
   callbacks — places with no component around them to call useAuth or
   useLang from. So the two providers publish here whenever they change,
   and everything else just asks. */

let viewerIsOwner = false;
let lang = 'en';

/* Called by AuthContext when the session changes, and by
   LanguageContext when the language does. Nothing else should call
   these. */
export const publishViewerIsOwner = (v) => { viewerIsOwner = !!v; };
export const publishLang = (l) => { if (l && STRINGS[l]) lang = l; };

const tr = (key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;

/* Something has not been switched on yet.

   ownerHint is the real instruction — keep it exact and technical,
   because the one person who sees it is the one who has to carry it
   out. Everyone else gets `plain` when a screen has a better sentence
   for its own situation ("Groups aren't switched on yet"), and the
   general one otherwise. */
export const setupNotice = (ownerHint, plain) =>
  (viewerIsOwner && ownerHint ? ownerHint : (plain || tr('load_err_setup')));

/* True only for Ayser. For the rare screen that wants to show a whole
   extra panel rather than swap one sentence. */
export const viewerIsTheOwner = () => viewerIsOwner;
