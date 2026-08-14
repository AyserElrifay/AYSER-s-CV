-- ═══════════════════════════════════════════════════════════════════
--  لمّة · PLAYABLE BY PEOPLE WHO ARE NOT EGYPTIAN
--
--  The first three packs are about Egyptian films, Egyptian songs and
--  Egyptian football. They are good packs and they stay. But somebody
--  in Bucharest or Berlin cannot answer a single question in them, and
--  a quiz you cannot answer is not a hard quiz — it is a closed door.
--
--  Two changes:
--
--  1. A QUESTION CAN SPEAK TWO LANGUAGES. text_en beside text_ar, and
--     every option carries both. The app shows whichever the player has
--     chosen and falls back rather than blanking, so no question is
--     ever empty on screen. Nothing is translated automatically — a
--     machine-translated quiz answer is a wrong answer waiting to
--     happen.
--
--  2. THREE PACKS ANYBODY CAN PLAY. World football, European cities,
--     and general knowledge — facts a person in Cairo and a person in
--     Lisbon both have a fair chance at. Not "easy": shared.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.questions add column if not exists text_en text;
alter table public.game_packs add column if not exists description_en text;

-- the constraint has to cover the English side too, for the same reason
alter table public.questions drop constraint if exists questions_text_en_len;
alter table public.questions add constraint questions_text_en_len
  check (text_en is null or char_length(text_en) <= 120);

-- The answer-free view has to carry the English text as well, or an
-- English player gets a blank question.
--
-- DROPPED AND REBUILT, NOT REPLACED. "create or replace view" can only
-- change what the existing columns select — it cannot add one in the
-- middle, and Postgres refuses with "cannot change name of view column".
-- Adding text_en after text_ar is exactly that, so the view goes and
-- comes back. Nothing depends on it in SQL; the app reads it by name.
drop view if exists public.lamma_questions_public;
create view public.lamma_questions_public as
  select id, pack_id, order_index, text_ar, text_en, media_url, media_type,
         timer_ms, options, points_style
    from public.questions;
grant select on public.lamma_questions_public to anon, authenticated;

-- ── English titles for the Egyptian packs ──────────────────────────
update public.game_packs set title_en = 'Egyptian Films',   description_en = 'From black and white to now'
 where id = 'aaaa1111-0000-4000-8000-000000000001';
update public.game_packs set title_en = '90s Songs',        description_en = 'The songs we grew up on'
 where id = 'aaaa1111-0000-4000-8000-000000000002';
update public.game_packs set title_en = 'Egyptian Football', description_en = 'Ahly, Zamalek and the national team'
 where id = 'aaaa1111-0000-4000-8000-000000000003';

-- ═══════════════════════════════════════════════════════════════════
--  THREE PACKS ANYBODY CAN PLAY
-- ═══════════════════════════════════════════════════════════════════
delete from public.game_packs where id in (
  'bbbb2222-0000-4000-8000-000000000001',
  'bbbb2222-0000-4000-8000-000000000002',
  'bbbb2222-0000-4000-8000-000000000003');

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en, category, locale, is_official, visibility) values
 ('bbbb2222-0000-4000-8000-000000000001','كورة عالمية','World Football','من المونديال للدوريات','World Cups, clubs and the big nights','sport','en',true,'public'),
 ('bbbb2222-0000-4000-8000-000000000002','مدن أوروبا','Europe','عواصم وأنهار وجبال','Capitals, rivers and borders','geography','en',true,'public'),
 ('bbbb2222-0000-4000-8000-000000000003','معلومات عامة','General Knowledge','حاجات المفروض كلنا نعرفها','Things most people know, and a few they do not','general','en',true,'public');

-- ── World Football ─────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('bbbb2222-0000-4000-8000-000000000001',0,'مين كسب كأس العالم 2018؟','Which country won the 2018 World Cup?',20000,'[{"index":0,"text_ar":"فرنسا","text_en":"France"},{"index":1,"text_ar":"كرواتيا","text_en":"Croatia"},{"index":2,"text_ar":"البرازيل","text_en":"Brazil"},{"index":3,"text_ar":"ألمانيا","text_en":"Germany"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',1,'مين كسب كأس العالم 2022؟','Which country won the 2022 World Cup?',20000,'[{"index":0,"text_ar":"الأرجنتين","text_en":"Argentina"},{"index":1,"text_ar":"فرنسا","text_en":"France"},{"index":2,"text_ar":"البرازيل","text_en":"Brazil"},{"index":3,"text_ar":"إسبانيا","text_en":"Spain"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',2,'أكتر نادي كسب دوري أبطال أوروبا؟','Which club has won the most European Cups?',20000,'[{"index":0,"text_ar":"ريال مدريد","text_en":"Real Madrid"},{"index":1,"text_ar":"ميلان","text_en":"AC Milan"},{"index":2,"text_ar":"بايرن ميونخ","text_en":"Bayern Munich"},{"index":3,"text_ar":"ليفربول","text_en":"Liverpool"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',3,'أكتر منتخب كسب كأس العالم؟','Which nation has won the most World Cups?',20000,'[{"index":0,"text_ar":"البرازيل","text_en":"Brazil"},{"index":1,"text_ar":"ألمانيا","text_en":"Germany"},{"index":2,"text_ar":"إيطاليا","text_en":"Italy"},{"index":3,"text_ar":"الأرجنتين","text_en":"Argentina"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',4,'مين كسب يورو 2020؟','Which country won Euro 2020?',20000,'[{"index":0,"text_ar":"إيطاليا","text_en":"Italy"},{"index":1,"text_ar":"إنجلترا","text_en":"England"},{"index":2,"text_ar":"إسبانيا","text_en":"Spain"},{"index":3,"text_ar":"الدنمارك","text_en":"Denmark"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',5,'كأس العالم 1930 كسبها مين؟','Who won the first World Cup, in 1930?',20000,'[{"index":0,"text_ar":"أوروجواي","text_en":"Uruguay"},{"index":1,"text_ar":"الأرجنتين","text_en":"Argentina"},{"index":2,"text_ar":"البرازيل","text_en":"Brazil"},{"index":3,"text_ar":"إيطاليا","text_en":"Italy"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',6,'ستاد الكامب نو في أي مدينة؟','Which city is home to the Camp Nou?',20000,'[{"index":0,"text_ar":"برشلونة","text_en":"Barcelona"},{"index":1,"text_ar":"مدريد","text_en":"Madrid"},{"index":2,"text_ar":"لشبونة","text_en":"Lisbon"},{"index":3,"text_ar":"فالنسيا","text_en":"Valencia"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',7,'ستاد السان سيرو في أي مدينة؟','Which city is home to the San Siro?',20000,'[{"index":0,"text_ar":"ميلانو","text_en":"Milan"},{"index":1,"text_ar":"روما","text_en":"Rome"},{"index":2,"text_ar":"تورينو","text_en":"Turin"},{"index":3,"text_ar":"نابولي","text_en":"Naples"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',8,'كام لاعب في الملعب لكل فريق؟','How many players per team are on the pitch?',20000,'[{"index":0,"text_ar":"11","text_en":"11"},{"index":1,"text_ar":"10","text_en":"10"},{"index":2,"text_ar":"12","text_en":"12"},{"index":3,"text_ar":"9","text_en":"9"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',9,'الكارت الأحمر معناه إيه؟','What does a red card mean?',20000,'[{"index":0,"text_ar":"طرد","text_en":"Sent off"},{"index":1,"text_ar":"إنذار","text_en":"A warning"},{"index":2,"text_ar":"ضربة جزاء","text_en":"A penalty"},{"index":3,"text_ar":"تبديل","text_en":"A substitution"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',10,'الماتش الرسمي مدته كام دقيقة؟','How long is a match, before stoppage time?',20000,'[{"index":0,"text_ar":"90","text_en":"90 minutes"},{"index":1,"text_ar":"80","text_en":"80 minutes"},{"index":2,"text_ar":"100","text_en":"100 minutes"},{"index":3,"text_ar":"60","text_en":"60 minutes"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',11,'البوندسليجا دوري أي بلد؟','The Bundesliga is the top league of which country?',20000,'[{"index":0,"text_ar":"ألمانيا","text_en":"Germany"},{"index":1,"text_ar":"النمسا","text_en":"Austria"},{"index":2,"text_ar":"هولندا","text_en":"Netherlands"},{"index":3,"text_ar":"سويسرا","text_en":"Switzerland"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',12,'ملعب آنفيلد بتاع أي نادي؟','Anfield is the home of which club?',20000,'[{"index":0,"text_ar":"ليفربول","text_en":"Liverpool"},{"index":1,"text_ar":"إيفرتون","text_en":"Everton"},{"index":2,"text_ar":"مانشستر يونايتد","text_en":"Manchester United"},{"index":3,"text_ar":"أرسنال","text_en":"Arsenal"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',13,'يورو 2024 اتلعبت فين؟','Which country hosted Euro 2024?',20000,'[{"index":0,"text_ar":"ألمانيا","text_en":"Germany"},{"index":1,"text_ar":"فرنسا","text_en":"France"},{"index":2,"text_ar":"إنجلترا","text_en":"England"},{"index":3,"text_ar":"إيطاليا","text_en":"Italy"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000001',14,'كأس العالم 2006 اتلعبت فين؟','Which country hosted the 2006 World Cup?',20000,'[{"index":0,"text_ar":"ألمانيا","text_en":"Germany"},{"index":1,"text_ar":"اليابان","text_en":"Japan"},{"index":2,"text_ar":"جنوب أفريقيا","text_en":"South Africa"},{"index":3,"text_ar":"البرازيل","text_en":"Brazil"}]',0,'double');

-- ── Europe ─────────────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('bbbb2222-0000-4000-8000-000000000002',0,'عاصمة البرتغال؟','What is the capital of Portugal?',20000,'[{"index":0,"text_ar":"لشبونة","text_en":"Lisbon"},{"index":1,"text_ar":"بورتو","text_en":"Porto"},{"index":2,"text_ar":"مدريد","text_en":"Madrid"},{"index":3,"text_ar":"براغا","text_en":"Braga"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',1,'أي نهر بيعدي في باريس؟','Which river runs through Paris?',20000,'[{"index":0,"text_ar":"السين","text_en":"The Seine"},{"index":1,"text_ar":"الراين","text_en":"The Rhine"},{"index":2,"text_ar":"الدانوب","text_en":"The Danube"},{"index":3,"text_ar":"اللوار","text_en":"The Loire"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',2,'عاصمة النرويج؟','What is the capital of Norway?',20000,'[{"index":0,"text_ar":"أوسلو","text_en":"Oslo"},{"index":1,"text_ar":"بيرغن","text_en":"Bergen"},{"index":2,"text_ar":"ستوكهولم","text_en":"Stockholm"},{"index":3,"text_ar":"كوبنهاغن","text_en":"Copenhagen"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',3,'بودابست عاصمة أي بلد؟','Budapest is the capital of which country?',20000,'[{"index":0,"text_ar":"المجر","text_en":"Hungary"},{"index":1,"text_ar":"النمسا","text_en":"Austria"},{"index":2,"text_ar":"رومانيا","text_en":"Romania"},{"index":3,"text_ar":"سلوفاكيا","text_en":"Slovakia"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',4,'عاصمة رومانيا؟','What is the capital of Romania?',20000,'[{"index":0,"text_ar":"بوخارست","text_en":"Bucharest"},{"index":1,"text_ar":"كلوج","text_en":"Cluj"},{"index":2,"text_ar":"صوفيا","text_en":"Sofia"},{"index":3,"text_ar":"بلغراد","text_en":"Belgrade"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',5,'أي جبال بتفصل فرنسا عن إسبانيا؟','Which mountains separate France and Spain?',20000,'[{"index":0,"text_ar":"البرانس","text_en":"The Pyrenees"},{"index":1,"text_ar":"الألب","text_en":"The Alps"},{"index":2,"text_ar":"الكاربات","text_en":"The Carpathians"},{"index":3,"text_ar":"الأبنين","text_en":"The Apennines"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',6,'عاصمة كرواتيا؟','What is the capital of Croatia?',20000,'[{"index":0,"text_ar":"زغرب","text_en":"Zagreb"},{"index":1,"text_ar":"سبليت","text_en":"Split"},{"index":2,"text_ar":"ليوبليانا","text_en":"Ljubljana"},{"index":3,"text_ar":"سراييفو","text_en":"Sarajevo"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',7,'أمستردام في أي بلد؟','Amsterdam is in which country?',20000,'[{"index":0,"text_ar":"هولندا","text_en":"The Netherlands"},{"index":1,"text_ar":"بلجيكا","text_en":"Belgium"},{"index":2,"text_ar":"ألمانيا","text_en":"Germany"},{"index":3,"text_ar":"الدنمارك","text_en":"Denmark"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',8,'أي مدينة اسمها «المدينة الخالدة»؟','Which city is known as the Eternal City?',20000,'[{"index":0,"text_ar":"روما","text_en":"Rome"},{"index":1,"text_ar":"أثينا","text_en":"Athens"},{"index":2,"text_ar":"باريس","text_en":"Paris"},{"index":3,"text_ar":"إسطنبول","text_en":"Istanbul"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',9,'عاصمة فنلندا؟','What is the capital of Finland?',20000,'[{"index":0,"text_ar":"هلسنكي","text_en":"Helsinki"},{"index":1,"text_ar":"تامبيري","text_en":"Tampere"},{"index":2,"text_ar":"أوسلو","text_en":"Oslo"},{"index":3,"text_ar":"تالين","text_en":"Tallinn"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',10,'براغ عاصمة أي بلد؟','Prague is the capital of which country?',20000,'[{"index":0,"text_ar":"التشيك","text_en":"Czechia"},{"index":1,"text_ar":"بولندا","text_en":"Poland"},{"index":2,"text_ar":"سلوفاكيا","text_en":"Slovakia"},{"index":3,"text_ar":"النمسا","text_en":"Austria"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',11,'فيينا عاصمة أي بلد؟','Vienna is the capital of which country?',20000,'[{"index":0,"text_ar":"النمسا","text_en":"Austria"},{"index":1,"text_ar":"ألمانيا","text_en":"Germany"},{"index":2,"text_ar":"سويسرا","text_en":"Switzerland"},{"index":3,"text_ar":"المجر","text_en":"Hungary"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',12,'عملة بولندا إيه؟','What is the currency of Poland?',20000,'[{"index":0,"text_ar":"الزلوتي","text_en":"The złoty"},{"index":1,"text_ar":"اليورو","text_en":"The euro"},{"index":2,"text_ar":"الكرونة","text_en":"The krona"},{"index":3,"text_ar":"الفورنت","text_en":"The forint"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',13,'أي مضيق بيفصل أوروبا عن أفريقيا؟','Which strait separates Europe from Africa?',20000,'[{"index":0,"text_ar":"جبل طارق","text_en":"Gibraltar"},{"index":1,"text_ar":"البوسفور","text_en":"The Bosphorus"},{"index":2,"text_ar":"المانش","text_en":"The Channel"},{"index":3,"text_ar":"مسينا","text_en":"Messina"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000002',14,'أي بلدين بيتقاسموا جزيرة أيرلندا؟','Which two states share the island of Ireland?',20000,'[{"index":0,"text_ar":"أيرلندا وبريطانيا","text_en":"Ireland and the UK"},{"index":1,"text_ar":"أيرلندا فقط","text_en":"Ireland only"},{"index":2,"text_ar":"أيرلندا وأيسلندا","text_en":"Ireland and Iceland"},{"index":3,"text_ar":"أيرلندا وفرنسا","text_en":"Ireland and France"}]',0,'double');

-- ── General Knowledge ──────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('bbbb2222-0000-4000-8000-000000000003',0,'كام قارة في العالم؟','How many continents are there?',20000,'[{"index":0,"text_ar":"7","text_en":"7"},{"index":1,"text_ar":"5","text_en":"5"},{"index":2,"text_ar":"6","text_en":"6"},{"index":3,"text_ar":"8","text_en":"8"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',1,'أكبر محيط في العالم؟','What is the largest ocean?',20000,'[{"index":0,"text_ar":"الهادي","text_en":"The Pacific"},{"index":1,"text_ar":"الأطلنطي","text_en":"The Atlantic"},{"index":2,"text_ar":"الهندي","text_en":"The Indian"},{"index":3,"text_ar":"المتجمد الشمالي","text_en":"The Arctic"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',2,'أي كوكب اسمه «الكوكب الأحمر»؟','Which planet is called the Red Planet?',20000,'[{"index":0,"text_ar":"المريخ","text_en":"Mars"},{"index":1,"text_ar":"الزهرة","text_en":"Venus"},{"index":2,"text_ar":"المشتري","text_en":"Jupiter"},{"index":3,"text_ar":"عطارد","text_en":"Mercury"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',3,'الرمز الكيميائي للذهب؟','What is the chemical symbol for gold?',20000,'[{"index":0,"text_ar":"Au","text_en":"Au"},{"index":1,"text_ar":"Ag","text_en":"Ag"},{"index":2,"text_ar":"Go","text_en":"Go"},{"index":3,"text_ar":"Gd","text_en":"Gd"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',4,'الجيتار العادي فيه كام وتر؟','How many strings does a standard guitar have?',20000,'[{"index":0,"text_ar":"6","text_en":"6"},{"index":1,"text_ar":"4","text_en":"4"},{"index":2,"text_ar":"7","text_en":"7"},{"index":3,"text_ar":"12","text_en":"12"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',5,'أعلى قمة فوق سطح البحر؟','What is the highest mountain above sea level?',20000,'[{"index":0,"text_ar":"إيفرست","text_en":"Everest"},{"index":1,"text_ar":"K2","text_en":"K2"},{"index":2,"text_ar":"مونت بلانك","text_en":"Mont Blanc"},{"index":3,"text_ar":"كليمنجارو","text_en":"Kilimanjaro"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',6,'المسدس له كام ضلع؟ السداسي يعني','How many sides does a hexagon have?',20000,'[{"index":0,"text_ar":"6","text_en":"6"},{"index":1,"text_ar":"5","text_en":"5"},{"index":2,"text_ar":"7","text_en":"7"},{"index":3,"text_ar":"8","text_en":"8"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',7,'أكبر كائن ثديي؟','What is the largest mammal?',20000,'[{"index":0,"text_ar":"الحوت الأزرق","text_en":"The blue whale"},{"index":1,"text_ar":"الفيل","text_en":"The elephant"},{"index":2,"text_ar":"الزرافة","text_en":"The giraffe"},{"index":3,"text_ar":"وحيد القرن","text_en":"The rhino"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',8,'النباتات بتمتص أي غاز؟','Which gas do plants absorb?',20000,'[{"index":0,"text_ar":"ثاني أكسيد الكربون","text_en":"Carbon dioxide"},{"index":1,"text_ar":"الأكسجين","text_en":"Oxygen"},{"index":2,"text_ar":"النيتروجين","text_en":"Nitrogen"},{"index":3,"text_ar":"الهيدروجين","text_en":"Hydrogen"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',9,'كام لاعب في فريق السلة في الملعب؟','How many basketball players per team are on court?',20000,'[{"index":0,"text_ar":"5","text_en":"5"},{"index":1,"text_ar":"6","text_en":"6"},{"index":2,"text_ar":"7","text_en":"7"},{"index":3,"text_ar":"4","text_en":"4"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',10,'المياه بتتجمد عند كام درجة مئوية؟','Water freezes at what temperature in Celsius?',20000,'[{"index":0,"text_ar":"0","text_en":"0"},{"index":1,"text_ar":"10","text_en":"10"},{"index":2,"text_ar":"-10","text_en":"-10"},{"index":3,"text_ar":"32","text_en":"32"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',11,'أكبر صحراء حارة في العالم؟','What is the largest hot desert in the world?',20000,'[{"index":0,"text_ar":"الصحراء الكبرى","text_en":"The Sahara"},{"index":1,"text_ar":"جوبي","text_en":"The Gobi"},{"index":2,"text_ar":"كالاهاري","text_en":"The Kalahari"},{"index":3,"text_ar":"أتاكاما","text_en":"The Atacama"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',12,'قوس قزح فيه كام لون تقليدياً؟','How many colours are traditionally in a rainbow?',20000,'[{"index":0,"text_ar":"7","text_en":"7"},{"index":1,"text_ar":"5","text_en":"5"},{"index":2,"text_ar":"6","text_en":"6"},{"index":3,"text_ar":"9","text_en":"9"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',13,'عاصمة اليابان؟','What is the capital of Japan?',20000,'[{"index":0,"text_ar":"طوكيو","text_en":"Tokyo"},{"index":1,"text_ar":"أوساكا","text_en":"Osaka"},{"index":2,"text_ar":"كيوتو","text_en":"Kyoto"},{"index":3,"text_ar":"سيول","text_en":"Seoul"}]',0,'standard'),
('bbbb2222-0000-4000-8000-000000000003',14,'البيتزا أصلها من أي بلد؟','Pizza originated in which country?',20000,'[{"index":0,"text_ar":"إيطاليا","text_en":"Italy"},{"index":1,"text_ar":"اليونان","text_en":"Greece"},{"index":2,"text_ar":"فرنسا","text_en":"France"},{"index":3,"text_ar":"إسبانيا","text_en":"Spain"}]',0,'double');

notify pgrst, 'reload schema';
