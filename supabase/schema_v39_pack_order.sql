-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE SHELF HAS AN ORDER NOW
--
--  Ayser: "Make 15 Egyptian question at the top now."
--
--  The shelf had no order to speak of. Packs came back official-first
--  and then in whatever order the table felt like, and the app moved
--  the player's own country up. So "Egypt in 15" — the pack that IS
--  the round he runs his evenings on — sat wherever it landed.
--
--  ── A COLUMN, NOT A LINE OF CODE ─────────────────────────────────
--  The quick version of this is an id written into fetchPacks with a
--  comment saying "put this one first". Then the next time he wants a
--  different pack at the top it is a code change, a build and a
--  deploy, for something that is genuinely just a preference.
--
--  So the order lives on the pack. Lower comes first, everything
--  unranked sits at 100, and moving a pack up the shelf is one UPDATE.
--
--  ── AND IT BEATS THE COUNTRY SORT ────────────────────────────────
--  The app already moves a player's own country to the top, which was
--  itself a fix: an Egyptian in Cairo opened لمّة and saw three
--  worldwide packs and no Egyptian one. That stays — but it now only
--  decides between packs with the SAME rank. A deliberate choice about
--  what belongs at the top should not be undone by where somebody
--  happens to live, or the pack Ayser pinned would drop for every
--  player outside Egypt: exactly the people he plays with.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_packs add column if not exists sort_order int not null default 100;

create index if not exists game_packs_shelf on public.game_packs (sort_order, is_official desc);

-- The round he actually runs, then the big Egyptian pack behind it,
-- then the green one. Everything else keeps the default and sorts
-- itself out below.
update public.game_packs set sort_order =  0 where id = 'aaaa7777-0000-4000-8000-000000000001'; -- Egypt in 15
update public.game_packs set sort_order = 10 where id = 'eeee5555-0000-4000-8000-000000000001'; -- Do You Know Egypt?
update public.game_packs set sort_order = 20 where id = 'ffff6666-0000-4000-8000-000000000001'; -- Green Minds

notify pgrst, 'reload schema';
