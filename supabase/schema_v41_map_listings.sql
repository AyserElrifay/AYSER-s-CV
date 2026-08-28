-- ═══════════════════════════════════════════════════════════════════
--  THE MAP LEARNS TO SHOW A PLACE PROPERLY
--
--  Ayser: "خلي في الخريطه ان يظهر بيوت للاجار و دوس عليها ممكن تشوف
--  البيت ذي بوست كده... و بردو ممكن تكلم صحبه او تحجز في ثواني... و ده
--  للهوتيلز و بردو... خلي اجار عربيات نفس الكلام."
--
--  A venue already existed on the map, and tapping it already opened a
--  booking form that made a real reservation and messaged the owner.
--  What it could not do was let you LOOK at the thing first. A flat
--  with no photograph is not a listing, it is a rumour — and nobody
--  books a rumour.
--
--  ── WHAT THIS ADDS ───────────────────────────────────────────────
--  photos   — the pictures, so a pin opens the way a post opens
--  about    — what it actually is, in the owner's own words
--  link     — where to book it if the owner takes bookings elsewhere
--  city     — so a search can say "stays in Budapest" and mean it
--
--  ── AND TWO NEW KINDS ────────────────────────────────────────────
--  The kind column was free text with a comment listing four values.
--  Hotel and Car join Stay, Food, Sport and Experience. Cars are not
--  a different feature — a car is a thing with photos, a price, an
--  owner and a booking, which is exactly what this table already
--  describes. Building a second system for it would have been the
--  expensive way to get the same screen.
--
--  ── WHAT THIS DELIBERATELY DOES NOT ADD ──────────────────────────
--  Documents. A driving licence is somebody's identity papers, and
--  the right place for it is with the rental company that legally has
--  to check it, not in our database because it was easy. When that
--  arrives it gets its own table, its own retention rule and its own
--  policy — not a column added in passing.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.venues add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.venues add column if not exists about  text;
alter table public.venues add column if not exists link   text;
alter table public.venues add column if not exists city   text;

-- The map asks "what is near here", and it asked it of every row.
create index if not exists venues_live_spot on public.venues (status, lat, lng);
create index if not exists venues_kind      on public.venues (kind);

/* A link is where a booking finishes when the owner already takes
   bookings somewhere real. It has to be a web address and nothing
   else: a phone that is handed a link opens it, and "javascript:" or
   "data:" in that column would be a hole with our name on it. */
alter table public.venues drop constraint if exists venues_link_is_a_url;
alter table public.venues add  constraint venues_link_is_a_url
  check (link is null or link ~ '^https://[^\s]+$');

/* And a listing may not carry more pictures than a phone will draw.
   Eight is more than anybody scrolls, and it stops one owner making
   the map slow for everybody. */
alter table public.venues drop constraint if exists venues_photos_sane;
alter table public.venues add  constraint venues_photos_sane
  check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 8);

notify pgrst, 'reload schema';
