-- ════════════════════════════════════════════════════════════════════
--  THE WEEKS AHEAD · ONE FRIDAY DROP A WEEK, AS DRAFTS (once)
--  Ayser, November 2026: "خلي واحدة بس او اتنين كل أسبوع مفتوحة عشان
--  كل اليوزر يحو فيهم". One fixed day (Friday), the activity changes, the
--  easiest first. Every one is a DRAFT: nobody sees it until the owner
--  opens it in the Studio (Drops → the row → set place/time → Publish →
--  Save). Where the place is not known yet it says so in capitals, so a
--  draft can never go out with a guess in it. Drafts that pass unused are
--  removed by auto_cleanup (rule 3a).
--  Runs once (app_settings 'drops_plan_v1').
-- ════════════════════════════════════════════════════════════════════
do $do$
declare owner uuid; r record; oid uuid; n int := 0;
begin
  if exists (select 1 from public.app_settings where key = 'drops_plan_v1') then
    raise notice 'weekend drops plan: already written';
    return;
  end if;
  select u.id into owner from auth.users u where lower(u.email) = 'ayseryourlifecoach@gmail.com' limit 1;

  for r in select * from (values
    -- week, Cairo time, category, title, title_ar, neighborhood, neighborhood_ar, venue
    (1, '17:00', 'tables',  'Coffee with people you have not met yet', 'قهوة مع ناس لسه ما تعرفهمش', 'Awlad Rizk café — CONFIRM ADDRESS', 'كافيه أولاد رزق — أكّد العنوان', 'Awlad Rizk café'),
    (2, '16:00', 'culture', 'Sunset felucca on the Nile',              'فلوكة في النيل وقت الغروب',    'Nile — SET THE BOAT AND PIER',       'النيل — حدّد المركب والمرسى',     null),
    (3, '15:00', 'culture', 'Drawing in the Fish Garden',              'رسم في حديقة الأسماك',          'Zamalek — Fish Garden',              'الزمالك — حديقة الأسماك',         'Fish Garden (Hadiqat al-Asmak), Zamalek'),
    (4, '18:00', 'tables',  'Escape room night (two rooms)',           'ليلة Escape room (أوضتين)',     'SET THE ESCAPE ROOM',                'حدّد مكان الـ Escape room',       null),
    (5, '08:00', 'culture', 'English circle in Wadi Degla',            'دايرة إنجليزي في وادي دجلة',     'Maadi — Wadi Degla Protectorate',    'المعادي — محمية وادي دجلة',       'Wadi Degla Protectorate'),
    (6, '15:00', 'culture', 'Kayak on the Nile',                       'كاياك في النيل',                'SET THE KAYAK CLUB',                 'حدّد نادي الكاياك',               null),
    (7, '17:00', 'tables',  'Trampoline park',                         'ترامبولين',                     'SET THE TRAMPOLINE PARK',            'حدّد مكان الترامبولين',          null),
    (8, '08:00', 'culture', 'Friday morning run & English coffee',     'جري الجمعة الصبح وقهوة بالإنجليزي', 'El Obour — SET THE MEETING POINT', 'العبور — حدّد مكان التجمّع',   null)
  ) as v(wk, at, cat, title, title_ar, hood, hood_ar, venue)
  loop
    insert into public.offers (kind, status, is_drop, title, title_ar, neighborhood, neighborhood_ar, city, country,
                               starts_at, ends_at, seats, drop_category, price, pay_modes, created_by)
    values ('table', 'draft', true, r.title, r.title_ar, r.hood, r.hood_ar, 'Cairo', 'EG',
            -- week 1 = Friday 13 November 2026, then every Friday, Cairo time
            ((date '2026-11-13' + (r.wk - 1) * 7) + r.at::time) at time zone 'Africa/Cairo',
            ((date '2026-11-13' + (r.wk - 1) * 7) + r.at::time) at time zone 'Africa/Cairo' + interval '2 hours',
            10, r.cat, 0, '{reserve}', owner)
    returning id into oid;
    if r.venue is not null then
      insert into public.drop_venues (offer_id, name) values (oid, r.venue) on conflict (offer_id) do nothing;
    end if;
    n := n + 1;
  end loop;

  insert into public.app_settings (key, value) values ('drops_plan_v1', jsonb_build_object('at', now(), 'drafts', n));
  raise notice 'weekend drops plan: % drafts written', n;
end $do$;
