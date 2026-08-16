-- ═══════════════════════════════════════════════════════════════════
--  أخضر · GREEN MINDS
--
--  Ayser asked for a green corner of Moments: clean-ups, nature
--  reflection circles, art and culture, Erasmus-style projects, in
--  Egypt, France, Spain, Moldova, Hungary and Czechia — and for it to
--  be inspiring, chic, and a SAFE place where differences of culture,
--  thought and belief are respected.
--
--  ── THE ONE DECISION EVERYTHING ELSE FOLLOWS FROM ────────────────
--  Nothing in here is invented. There are no seeded "events" with
--  made-up dates, made-up organisers and made-up numbers of people
--  going, because a wall of plausible-looking gatherings that do not
--  exist is a lie the first person to turn up finds out about — alone,
--  by a canal, on a Saturday morning.
--
--  So the section has two halves, and they never pretend to be each
--  other:
--
--    GATHERINGS  real, created by real people, with a real place and a
--                real hour. Empty until somebody makes one. Joining is
--                a row with a name on it.
--
--    SPARKS      ideas. "Here is a thing you could start, here is what
--                it needs, here is roughly how long it takes." They
--                carry no date, no location and no attendance, and the
--                screen calls them ideas — because that is what they
--                are. Six countries' worth, written to be startable by
--                one person with no budget.
--
--  ── AND THE CARE CODE ────────────────────────────────────────────
--  Every gathering carries the same short code, and the person
--  creating one agrees to it: come as you are, leave the place better,
--  differences of culture and belief are welcome and not up for
--  debate, nobody is photographed without asking, and anybody may
--  leave at any time without explaining. It is stored WITH the
--  gathering rather than in an app policy somewhere, so it is read at
--  the moment it matters.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── WHAT KIND OF THING IT IS ───────────────────────────────────────
--   cleanup   a clean-up: a beach, a park, a riverbank, a street
--   circle    a reflection circle: sitting outside, talking, listening
--   art       art and culture: a walk, a sketch afternoon, a swap
--   project   the Erasmus-shaped thing: a group with a plan and a term
create table if not exists public.green_gatherings (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  title       text not null,
  about       text,
  country     text not null,                 -- ISO code: EG, FR, ES, MD, HU, CZ…
  city        text,
  place_name  text,
  lat         double precision,
  lng         double precision,
  starts_at   timestamptz not null,
  minutes     int,                           -- how long it is meant to take
  capacity    int,                           -- null = as many as turn up
  host_id     uuid not null references public.profiles(id) on delete cascade,
  language    text,                          -- what it will mostly be held in
  cancelled_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists green_gatherings_when_idx on public.green_gatherings (country, starts_at);

do $$ begin
  alter table public.green_gatherings drop constraint if exists green_gatherings_kind_check;
  alter table public.green_gatherings add constraint green_gatherings_kind_check
    check (kind in ('cleanup','circle','art','project')) not valid;
exception when others then null; end $$;

create table if not exists public.green_joins (
  gathering_id uuid not null references public.green_gatherings(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (gathering_id, user_id)
);

-- ── THE IDEAS ──────────────────────────────────────────────────────
-- No date, no place, no attendance: a spark is a thing to start, and
-- the columns make that impossible to confuse with a gathering.
create table if not exists public.green_sparks (
  id        uuid primary key default gen_random_uuid(),
  kind      text not null,
  country   text,                            -- null = anywhere
  title_ar  text not null,
  title_en  text not null,
  title_i18n jsonb,
  about_ar  text,
  about_en  text,
  about_i18n jsonb,
  minutes   int,
  people    text,                            -- "2–10", as text, because it is a hint
  sort      int not null default 0
);

alter table public.green_gatherings enable row level security;
alter table public.green_joins      enable row level security;
alter table public.green_sparks     enable row level security;

drop policy if exists "gatherings are public" on public.green_gatherings;
create policy "gatherings are public" on public.green_gatherings for select using (true);

drop policy if exists "you host your own gatherings" on public.green_gatherings;
create policy "you host your own gatherings" on public.green_gatherings
  for insert with check (host_id = auth.uid());

drop policy if exists "a host edits their own" on public.green_gatherings;
create policy "a host edits their own" on public.green_gatherings
  for update using (host_id = auth.uid());

drop policy if exists "who is coming is public" on public.green_joins;
create policy "who is coming is public" on public.green_joins for select using (true);

drop policy if exists "you speak for yourself" on public.green_joins;
create policy "you speak for yourself" on public.green_joins
  for insert with check (user_id = auth.uid());

drop policy if exists "and you may leave" on public.green_joins;
create policy "and you may leave" on public.green_joins
  for delete using (user_id = auth.uid());

drop policy if exists "sparks are for everybody" on public.green_sparks;
create policy "sparks are for everybody" on public.green_sparks for select using (true);

-- ── WHAT IS ON NEAR YOU ────────────────────────────────────────────
-- Upcoming only, cancelled ones excluded, with the count of people
-- coming and whether you are one of them. A country of null means
-- everywhere, because somebody in Prague may want to see what Cairo
-- is doing.
create or replace function public.green_list(p_country text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.starts_at), '[]'::jsonb)
    from (
      select g.id, g.kind, g.title, g.about, g.country, g.city, g.place_name,
             g.lat, g.lng, g.starts_at, g.minutes, g.capacity, g.language,
             g.host_id, p.name as host_name,
             (select count(*) from public.green_joins j where j.gathering_id = g.id) as going,
             exists (select 1 from public.green_joins j
                      where j.gathering_id = g.id and j.user_id = auth.uid()) as im_going
        from public.green_gatherings g
        left join public.profiles p on p.id = g.host_id
       where g.cancelled_at is null
         and g.starts_at > now() - interval '3 hours'      -- still on if it just started
         and (p_country is null or g.country = p_country)
       order by g.starts_at
       limit 60
    ) x;
$$;

grant execute on function public.green_list(text) to anon, authenticated;

-- ── STARTING ONE ───────────────────────────────────────────────────
-- The checks are here rather than on the phone: a gathering with no
-- title, in the past, or of a kind nobody recognises is refused.
create or replace function public.green_create(
  p_kind text, p_title text, p_about text, p_country text, p_city text,
  p_place text, p_lat double precision, p_lng double precision,
  p_starts_at timestamptz, p_minutes int, p_capacity int, p_language text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.green_gatherings%rowtype;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if p_kind not in ('cleanup','circle','art','project') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;
  if coalesce(length(btrim(p_title)), 0) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'no_title');
  end if;
  if p_starts_at is null or p_starts_at < now() - interval '1 hour' then
    return jsonb_build_object('ok', false, 'reason', 'in_the_past');
  end if;
  if coalesce(length(btrim(p_country)), 0) <> 2 then
    return jsonb_build_object('ok', false, 'reason', 'no_country');
  end if;

  insert into public.green_gatherings
    (kind, title, about, country, city, place_name, lat, lng, starts_at, minutes, capacity, host_id, language)
  values
    (p_kind, btrim(p_title), nullif(btrim(coalesce(p_about, '')), ''), upper(btrim(p_country)),
     nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_place, '')), ''),
     p_lat, p_lng, p_starts_at, p_minutes, p_capacity, me, p_language)
  returning * into g;

  -- the host is the first person coming; a gathering of nobody is a plan
  insert into public.green_joins (gathering_id, user_id) values (g.id, me)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'id', g.id);
end;
$$;

grant execute on function public.green_create(text, text, text, text, text, text,
                                              double precision, double precision,
                                              timestamptz, int, int, text) to authenticated;

-- ── COMING, OR NOT COMING AFTER ALL ────────────────────────────────
-- Leaving needs no reason and no message to anybody. That is part of
-- what makes it a place people will come back to.
create or replace function public.green_join(p_id uuid, p_going boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g  public.green_gatherings%rowtype;
  n  int;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into g from public.green_gatherings where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_gathering'); end if;
  if g.cancelled_at is not null then return jsonb_build_object('ok', false, 'reason', 'cancelled'); end if;

  if coalesce(p_going, true) then
    if g.capacity is not null then
      select count(*) into n from public.green_joins where gathering_id = p_id;
      if n >= g.capacity and not exists (
        select 1 from public.green_joins where gathering_id = p_id and user_id = me
      ) then
        return jsonb_build_object('ok', false, 'reason', 'full');
      end if;
    end if;
    insert into public.green_joins (gathering_id, user_id) values (p_id, me) on conflict do nothing;
  else
    delete from public.green_joins where gathering_id = p_id and user_id = me;
  end if;

  select count(*) into n from public.green_joins where gathering_id = p_id;
  return jsonb_build_object('ok', true, 'going', n, 'im_going', coalesce(p_going, true));
end;
$$;

grant execute on function public.green_join(uuid, boolean) to authenticated;

-- ── AND CALLING IT OFF, WHICH IS ALSO ALLOWED ──────────────────────
create or replace function public.green_cancel(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  update public.green_gatherings set cancelled_at = now()
   where id = p_id and host_id = me and cancelled_at is null;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_yours'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.green_cancel(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ── THE IDEAS THEMSELVES ───────────────────────────────────────────
-- Replaced whole each time this runs, because they are OURS: nothing
-- anybody typed is in this table, so there is nothing here to lose.
delete from public.green_sparks;
insert into public.green_sparks
  (kind, country, title_ar, title_en, title_i18n, about_ar, about_en, about_i18n, minutes, people, sort)
values
('cleanup','EG','ساعة على النيل','An hour on the Nile','{"fr": "Une heure au bord du Nil", "es": "Una hora junto al Nilo", "ro": "O oră pe malul Nilului"}'::jsonb,'اتفقوا على مكان على الكورنيش، هاتوا أكياس وجوانتيات، ونضفوا ساعة واحدة وصوّروا قبل وبعد.','Pick a spot on the corniche, bring bags and gloves, clean for one hour, photograph before and after.','{"fr": "Choisissez un coin de la corniche, apportez sacs et gants, nettoyez une heure, photo avant et après.", "es": "Elegid un punto del paseo, llevad bolsas y guantes, limpiad una hora, foto antes y después.", "ro": "Alegeți un loc pe faleză, luați saci și mănuși, curățați o oră, poză înainte și după."}'::jsonb,60,'3–15',0),
('circle','EG','قعدة غروب','A sunset circle','{"fr": "Un cercle au coucher du soleil", "es": "Un círculo al atardecer", "ro": "Un cerc la apus"}'::jsonb,'اقعدوا دايرة على المغرب، وكل واحد يجاوب على سؤال واحد: إيه اللي مديك أمل الأسبوع ده؟','Sit in a circle at sunset; everyone answers one question: what gave you hope this week?','{"fr": "Asseyez-vous en cercle au coucher du soleil ; chacun répond à une question : qu’est-ce qui t’a donné de l’espoir cette semaine ?", "es": "Sentaos en círculo al atardecer; cada uno responde a una pregunta: ¿qué te dio esperanza esta semana?", "ro": "Stați în cerc la apus; fiecare răspunde la o întrebare: ce ți-a dat speranță săptămâna asta?"}'::jsonb,45,'4–10',1),
('cleanup','FR','ساعة على ضفة القناة','An hour on the canal bank','{"fr": "Une heure au bord du canal", "es": "Una hora en la orilla del canal", "ro": "O oră pe malul canalului"}'::jsonb,'اختاروا جزء من الضفة، نضفوه، وافرزوا الزجاج والبلاستيك — ووزنوا اللي جمعتوه.','Take one stretch of bank, clear it, sort glass from plastic — and weigh what you collected.','{"fr": "Prenez un tronçon de berge, nettoyez-le, triez verre et plastique — et pesez votre récolte.", "es": "Coged un tramo de orilla, limpiadlo, separad vidrio y plástico y pesad lo recogido.", "ro": "Luați o porțiune de mal, curățați-o, separați sticla de plastic — și cântăriți ce ați strâns."}'::jsonb,60,'2–12',2),
('art','FR','مشوار رسم: عشر تفاصيل','A sketch walk: ten details','{"fr": "Balade croquis : dix détails", "es": "Paseo de bocetos: diez detalles", "ro": "Plimbare cu schițe: zece detalii"}'::jsonb,'امشوا ساعة ونص، وكل واحد يرسم عشر تفاصيل صغيرة محدش بياخد باله منها، وتتفرجوا عليها في الآخر.','Walk for ninety minutes; each person sketches ten small details nobody notices, then you share them.','{"fr": "Marchez une heure et demie ; chacun croque dix petits détails que personne ne remarque, puis on partage.", "es": "Caminad noventa minutos; cada uno dibuja diez detalles que nadie mira, y luego los compartís.", "ro": "Mergeți nouăzeci de minute; fiecare schițează zece detalii pe care nu le observă nimeni, apoi le arătați."}'::jsonb,90,'2–8',3),
('cleanup','ES','ساعة على الشاطئ','An hour on the beach','{"fr": "Une heure sur la plage", "es": "Una hora en la playa", "ro": "O oră pe plajă"}'::jsonb,'روحوا بدري قبل الزحمة، ونضفوا شريط واحد من الرمل — وعدّوا أعقاب السجاير، الرقم بيصدم.','Go early, clean one strip of sand — and count the cigarette ends; the number is the shock.','{"fr": "Allez-y tôt, nettoyez une bande de sable — et comptez les mégots : le chiffre est le choc.", "es": "Id temprano, limpiad una franja de arena y contad las colillas: el número impresiona.", "ro": "Mergeți devreme, curățați o fâșie de nisip — și numărați mucurile; numărul e șocul."}'::jsonb,60,'3–20',4),
('art','ES','تبادل: أكلة وأغنية','A swap: one dish, one song','{"fr": "Un échange : un plat, une chanson", "es": "Un intercambio: un plato, una canción", "ro": "Un schimb: un fel de mâncare, un cântec"}'::jsonb,'كل واحد يجيب أكلة من بلده وأغنية، ويحكي في تلات جمل ليه هي مهمة عنده.','Everyone brings one dish from home and one song, and says in three sentences why it matters to them.','{"fr": "Chacun apporte un plat de chez lui et une chanson, et dit en trois phrases pourquoi ça compte.", "es": "Cada uno trae un plato de su tierra y una canción, y cuenta en tres frases por qué le importa.", "ro": "Fiecare aduce un fel de mâncare de acasă și un cântec și spune în trei fraze de ce contează."}'::jsonb,120,'4–15',5),
('cleanup','MD','تنضيف ضفة النهر','A riverbank clean-up','{"fr": "Nettoyage de la berge", "es": "Limpieza de la ribera", "ro": "Curățenie pe malul râului"}'::jsonb,'اختاروا جزء من الضفة أو الغابة القريبة، واتفقوا فين تحطوا الزبالة قبل ما تبدأوا.','Pick a stretch of bank or nearby wood, and agree where the bags go before you start.','{"fr": "Choisissez un bout de berge ou de bois, et décidez où iront les sacs avant de commencer.", "es": "Elegid un tramo de ribera o de bosque y acordad dónde irán las bolsas antes de empezar.", "ro": "Alegeți o porțiune de mal sau de pădure și stabiliți unde ajung sacii înainte să începeți."}'::jsonb,90,'4–20',6),
('project','MD','تبادل بذور وشتلات','A seed and seedling swap','{"fr": "Un troc de graines et de plants", "es": "Un intercambio de semillas y plantones", "ro": "Un schimb de semințe și răsaduri"}'::jsonb,'كل واحد يجيب اللي عنده زيادة ويمشي باللي محتاجه — ومعاه ورقة صغيرة بترعى إزاي.','Everyone brings what they have spare and leaves with what they need — plus a note on how to grow it.','{"fr": "Chacun apporte son surplus et repart avec ce qu’il lui faut, avec un mot sur comment le cultiver.", "es": "Cada uno trae lo que le sobra y se lleva lo que necesita, con una nota de cómo cuidarlo.", "ro": "Fiecare aduce ce-i prisosește și pleacă cu ce-i trebuie — plus un bilet despre cum se îngrijește."}'::jsonb,null,'5–25',7),
('cleanup','HU','ساعة على الدانوب','An hour on the Danube','{"fr": "Une heure au bord du Danube", "es": "Una hora junto al Danubio", "ro": "O oră pe malul Dunării"}'::jsonb,'نضفوا جزء من الضفة، وشوفوا أكتر حاجة اتكررت — دي اللي تستاهل تتحكي بعد كده.','Clean a stretch of bank and note the single most common item — that is the story worth telling after.','{"fr": "Nettoyez un bout de berge et notez l’objet le plus fréquent : c’est lui qui raconte l’histoire.", "es": "Limpiad un tramo de orilla y anotad el objeto más repetido: esa es la historia que contar.", "ro": "Curățați o porțiune de mal și notați obiectul cel mai des întâlnit — asta e povestea."}'::jsonb,60,'3–15',8),
('project','HU','مقهى التصليح','A repair café','{"fr": "Un café réparation", "es": "Un café de reparaciones", "ro": "O cafenea a reparațiilor"}'::jsonb,'اقعدوا سوا ساعتين وصلّحوا حاجات مكسورة بدل ما ترموها — وكل واحد يعلّم اللي جنبه حاجة.','Sit together for two hours mending broken things instead of binning them — and teach each other as you go.','{"fr": "Deux heures ensemble à réparer au lieu de jeter — et chacun apprend quelque chose à son voisin.", "es": "Dos horas juntos arreglando cosas rotas en vez de tirarlas, enseñándoos unos a otros.", "ro": "Două ore împreună, reparând lucruri stricate în loc să le aruncați — și învățându-vă unii pe alții."}'::jsonb,null,'4–12',9),
('cleanup','CZ','مشوار غابة بكيس','A forest walk with a bag','{"fr": "Balade en forêt avec un sac", "es": "Paseo por el bosque con una bolsa", "ro": "O plimbare în pădure cu un sac"}'::jsonb,'امشوا المسار المعتاد ومعاكم كيس، والقاعدة الوحيدة: مترجعوش وهو فاضي.','Walk the usual trail carrying a bag; the only rule is that you do not come back with it empty.','{"fr": "Marchez le sentier habituel avec un sac ; seule règle : ne pas revenir les mains vides.", "es": "Recorred el sendero de siempre con una bolsa; la única regla es no volver con ella vacía.", "ro": "Mergeți pe traseul obișnuit cu un sac; singura regulă e să nu vă întoarceți cu el gol."}'::jsonb,90,'2–15',10),
('circle','CZ','دايرة الاختلاف','The differences circle','{"fr": "Le cercle des différences", "es": "El círculo de las diferencias", "ro": "Cercul diferențelor"}'::jsonb,'كل واحد يحكي حاجة من ثقافته الناس بتفهمها غلط — والباقي بيسمعوا بس، من غير جدال.','Each person names one thing from their culture that outsiders misread — and the rest only listen, no debate.','{"fr": "Chacun cite une chose de sa culture souvent mal comprise — les autres écoutent, sans débat.", "es": "Cada uno nombra algo de su cultura que se malinterpreta, y los demás solo escuchan, sin debate.", "ro": "Fiecare spune un lucru din cultura lui care e înțeles greșit — ceilalți doar ascultă, fără dezbatere."}'::jsonb,45,'4–10',11),
('project',null,'نفس اليوم، بلدين','Same day, two countries','{"fr": "Le même jour, deux pays", "es": "El mismo día, dos países", "ro": "Aceeași zi, două țări"}'::jsonb,'اتفقوا مع مجموعة في بلد تانية تعملوا نفس التنضيف في نفس اليوم، وتتبادلوا الصور والأرقام بعده.','Agree with a group in another country to clean on the same day, then swap photographs and numbers after.','{"fr": "Convenez avec un groupe d’un autre pays de nettoyer le même jour, puis échangez photos et chiffres.", "es": "Acordad con un grupo de otro país limpiar el mismo día y luego intercambiad fotos y cifras.", "ro": "Puneți-vă de acord cu un grup din altă țară să curățați în aceeași zi, apoi faceți schimb de poze și cifre."}'::jsonb,null,'6–30',12),
('cleanup',null,'قاعدة الربع ساعة','The quarter-hour rule','{"fr": "La règle du quart d’heure", "es": "La regla del cuarto de hora", "ro": "Regula sfertului de oră"}'::jsonb,'في أي مكان إنت فيه: ربع ساعة، كيس واحد، وامشي. أصغر حاجة ممكن تبدأ بيها.','Wherever you already are: fifteen minutes, one bag, then go. The smallest possible start.','{"fr": "Là où vous êtes déjà : quinze minutes, un sac, et voilà. Le plus petit début possible.", "es": "Donde ya estés: quince minutos, una bolsa, y ya. El comienzo más pequeño posible.", "ro": "Oriunde ești deja: cincisprezece minute, un sac, atât. Cel mai mic început posibil."}'::jsonb,15,'1–3',13),
('art',null,'صور: قبل وبعد','Before and after, on a wall','{"fr": "Avant / après, sur un mur", "es": "Antes y después, en una pared", "ro": "Înainte și după, pe un perete"}'::jsonb,'اعملوا معرض صغير من صور قبل وبعد التنضيفات — في مقهى، في مدرسة، أو على حيطة.','Make a small show of before-and-after photographs from your clean-ups: a café, a school, a wall.','{"fr": "Montez une petite expo de photos avant/après de vos nettoyages : un café, une école, un mur.", "es": "Montad una pequeña muestra de fotos antes y después de vuestras limpiezas: un café, una escuela, un muro.", "ro": "Faceți o mică expoziție cu poze înainte/după de la curățenii: o cafenea, o școală, un perete."}'::jsonb,60,'3–12',14);

notify pgrst, 'reload schema';
