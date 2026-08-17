-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE RIGHT ANSWER WAS ALWAYS THE FIRST BUTTON
--
--  Every question in the game — all of them, across every pack — was
--  written with the correct choice first and stored that way:
--
--      select correct_index, count(*) from questions group by 1;
--       0 | 206
--
--  Nothing in the app shuffles them. The view hands the four choices
--  to the phone in the order they are stored, and the phone draws them
--  in that order. So the top button was right two hundred and six
--  times out of two hundred and six.
--
--  That is not a small bug. A quiz whose answer is always in the same
--  place is not a quiz: one player notices in the first round, taps
--  the top button for the rest of the night, wins every game, and the
--  table stops playing. It cannot be seen by reading a single
--  question, only by counting them all, which is why it survived
--  thirty schema files.
--
--  ── HOW THIS FIXES IT ────────────────────────────────────────────
--  Each question's four choices are put in a new order, and its
--  correct_index moves with them. Nobody's answer changes meaning:
--  the phone sends the POSITION it was tapped, and the position it
--  was tapped is the position that is now stored.
--
--  ── WHY IT IS NOT ACTUALLY RANDOM ────────────────────────────────
--  The new order is a hash of the pack, the question's number in it,
--  and the choice's own authored number — so it is scrambled, but the
--  SAME scramble every time this file runs. Two reasons that matters:
--
--    · This file is applied on every deploy. A genuinely random
--      shuffle would deal the choices again under any room that
--      happened to be mid-question, and somebody's tap would land on
--      a different answer than the one they read.
--    · Running it twice must not undo it. The order is computed from
--      each choice's own "index" field — the number it was written
--      with, which this never rewrites — and not from where the
--      choice currently sits. So the second run computes the same
--      arrangement and changes nothing.
--
--  The app has never read that "index" field: QuestionCard and Stage
--  both use the position in the array. It survives here purely as the
--  choice's name, which is what makes re-running safe.
--
--  Anything oddly shaped — no choices, choices without their number,
--  two choices sharing one, a correct_index pointing past the end —
--  is left exactly as it is rather than guessed at.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

/* A FUNCTION, not a bare block, so that a file added AFTER this one
   can re-deal the questions it just wrote. The first version was an
   anonymous DO block, which meant every later pack would have been
   inserted with its answer first and never shuffled — and it would
   have been invisible: a handful of unshuffled questions among a
   hundred shuffled ones does not move the share enough to trip the
   build's check. Adding four questions was about to do exactly that.

   Not security definer, and execute is taken off PUBLIC below: this
   rewrites rows, and nothing a signed-in player can call has any
   business doing that. It is for the setup run, which is the owner. */
create or replace function public.lamma_spread_answers()
returns int
language plpgsql as $$
declare
  r         record;
  reordered jsonb;
  seed      text;
  named     int;   -- the correct choice's own number, before moving
  landed    int;   -- where it sits once the four are re-dealt
  moved     int := 0;
  skipped   int := 0;
begin
  for r in select id, pack_id, order_index, options, correct_index
             from public.questions loop

    seed := r.pack_id::text || '/' || r.order_index::text || '/';

    if jsonb_typeof(r.options) is distinct from 'array'
       or jsonb_array_length(r.options) < 2
       or r.correct_index is null
       or r.correct_index < 0
       or r.correct_index >= jsonb_array_length(r.options)
       or exists (select 1 from jsonb_array_elements(r.options) as t(e)
                   where t.e->>'index' is null)
       or (select count(distinct t.e->>'index') from jsonb_array_elements(r.options) as t(e))
          <> jsonb_array_length(r.options) then
      skipped := skipped + 1;
      continue;
    end if;

    named := (r.options -> r.correct_index ->> 'index')::int;

    select jsonb_agg(t.e order by md5(seed || (t.e->>'index')))
      into reordered
      from jsonb_array_elements(r.options) as t(e);

    select s.pos - 1 into landed from (
      select row_number() over (order by md5(seed || (t.e->>'index'))) as pos, t.e
        from jsonb_array_elements(r.options) as t(e)) s
     where (s.e->>'index')::int = named;

    if reordered is distinct from r.options or landed is distinct from r.correct_index then
      update public.questions
         set options = reordered, correct_index = landed
       where id = r.id;
      moved := moved + 1;
    end if;
  end loop;

  /* This counts rows changed since the inserts higher up in this same
     file put them back in authored order — not drift between runs.
     Every run re-inserts, then re-deals to the same arrangement, so
     this number stays roughly constant and the questions do not move.
     Measured: three consecutive applications, identical every time. */
  raise notice 'spread the answers: % question(s) moved off the authored order, % left alone', moved, skipped;
  return moved;
end $$;

revoke all on function public.lamma_spread_answers() from public;

select public.lamma_spread_answers();

-- ── AND IT MUST NOT COME BACK ──────────────────────────────────────
-- The fix above is data, not code, so the next pack somebody writes
-- with the answer first would be wrong again the moment it is added
-- after this line. Rather than trusting that nobody does that, the
-- file refuses to finish if the answers are bunched up. The build
-- checks the same thing against a real database (check-sql-twice.sh),
-- so it is caught before a deploy rather than after one.
do $$
declare
  n_all   int;
  n_first int;
  n_kinds int;
begin
  select count(*), count(*) filter (where correct_index = 0), count(distinct correct_index)
    into n_all, n_first, n_kinds
    from public.questions;

  if n_all = 0 then return; end if;   -- nothing loaded yet; nothing to say

  if n_kinds < 3 or n_first::numeric / n_all > 0.45 then
    raise exception 'The right answer sits in only % position(s), and is the first button % of % times. A quiz like that is solved by tapping the top button.',
      n_kinds, n_first, n_all;
  end if;
end $$;

notify pgrst, 'reload schema';
