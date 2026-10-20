import { reportProblem } from './problems';

/* ─── WHAT WENT WRONG, IN WORDS A PERSON USES ────────────────────────
   Postgres and PostgREST write for whoever is on call, not for whoever
   is holding the phone. "Could not find the table 'public.posts' in the
   schema cache" was appearing on the home feed underneath "Couldn't load
   moments" — a sentence naming a table, a schema and a cache, to
   somebody who only wanted to see their friends.

   So a failure gets sorted into one of three, and the screen picks its
   own sentence:

     setup       something has not been switched on yet — nobody's fault,
                 and nothing the person reading it can do
     permission  the rules said no
     offline     the connection did, or the server never answered

   The distinction is not cosmetic. "Try again" is right for the third
   and useless for the first, and a screen that cannot tell them apart
   ends up lying in one direction or the other.                       */
export function explain(e) {
  const msg = String((e && (e.message || e.hint)) || '');
  const code = e && e.code;
  /* the first two are ours to fix, so the Studio hears about them */
  if (code === '42P01' || code === 'PGRST205' || /does not exist|schema cache|could not find/i.test(msg)) { reportProblem('setup', e); return 'setup'; }
  if (code === '42501' || /row-level security|policy|permission denied/i.test(msg)) { reportProblem('permission', e); return 'permission'; }
  if (/more than one relationship|PGRST20[01]|violates|syntax error|invalid input/i.test(msg + ' ' + (code || ''))) reportProblem('query', e);
  return 'offline';
}
