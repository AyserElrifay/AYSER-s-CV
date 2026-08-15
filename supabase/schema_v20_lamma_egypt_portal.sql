-- ═══════════════════════════════════════════════════════════════════
--  لمّة · EGYPT, IN ONE PACK, PLAYABLE BY ANYONE
--
--  Egypt had eight packs. Now it has one.
--
--  ── WHY THEY WERE MERGED ─────────────────────────────────────────
--  Eight cards for one country is a filing cabinet, not a game. You
--  open لمّة to play, not to choose between "Egyptian Films" and
--  "90s Songs" before you have even started.
--
--  ── WHY MOST OF THE OLD QUESTIONS COULD NOT COME ─────────────────
--  Counted before rewriting: of 63 Egyptian questions, 11 were
--  recognisable outside Egypt. Seventeen per cent. The rest asked what
--  you shout to get off a microbus, what the morning line-up at school
--  starts with, what el-tormay is — questions where somebody in Berlin
--  or Bucharest cannot even make an educated guess. That is not a hard
--  question, it is a closed door, and a room with one Egyptian and
--  three Europeans in it stops being a game.
--
--  So this pack is built from the Egypt the whole world already has a
--  picture of: the pyramids, the Nile, Tutankhamun, Cleopatra, the
--  Sphinx, the Suez Canal, the Red Sea, Alexandria, koshari. A European
--  who has never been can answer most of it. An Egyptian should get
--  every single one — and that asymmetry is the point, because it is
--  their pack.
--
--  ── THE JOKES ────────────────────────────────────────────────────
--  Unchanged rule: the FACT is real, the WRONG answers are the joke.
--  And every wrong answer is CLEARLY wrong. A funny option that might
--  actually be true is not a joke, it is a second right answer — which
--  is why the Sphinx is not offered "a very large cat, which is close
--  enough", and why nobody is asked which continent Egypt is on.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- The eight separate Egyptian packs become one. Questions go with them
-- (questions.pack_id cascades on delete).
delete from public.game_packs where id in (
  'aaaa1111-0000-4000-8000-000000000001',   -- Egyptian Films
  'aaaa1111-0000-4000-8000-000000000002',   -- 90s Songs
  'aaaa1111-0000-4000-8000-000000000003',   -- Egyptian Football
  'cccc3333-0000-4000-8000-000000000001',   -- مصر… بجد؟
  'dddd4444-0000-4000-8000-000000000001',   -- مواصلات مصر
  'dddd4444-0000-4000-8000-000000000002',   -- البيت المصري
  'dddd4444-0000-4000-8000-000000000003',   -- رمضان في مصر
  'dddd4444-0000-4000-8000-000000000004'    -- أيام المدرسة
);

delete from public.game_packs where id = 'eeee5555-0000-4000-8000-000000000001';

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en, category, country, locale, is_official, visibility) values
 ('eeee5555-0000-4000-8000-000000000001','تعرف مصر؟','Do You Know Egypt?',
  'كل حاجة عن مصر في مكان واحد — والعالم كله يقدر يلعبها',
  'All of Egypt in one place — and the whole table can play.',
  'fun','EG','ar-EG',true,'public');

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('eeee5555-0000-4000-8000-000000000001',0,'الأهرامات اتبنت أصلاً عشان إيه؟','What were the pyramids originally built as?',20000,
 '[{"index":0,"text_ar":"مقابر للملوك","text_en":"Tombs for kings"},{"index":1,"text_ar":"مخازن قمح","text_en":"Grain warehouses"},{"index":2,"text_ar":"بيوت للمصيف","text_en":"Holiday homes"},{"index":3,"text_ar":"جراج متعدد الطوابق","text_en":"A multi-storey car park"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',1,'أنهي نهر بيعدي في مصر؟','Which river runs through Egypt?',20000,
 '[{"index":0,"text_ar":"النيل","text_en":"The Nile"},{"index":1,"text_ar":"الأمازون","text_en":"The Amazon"},{"index":2,"text_ar":"التيمز","text_en":"The Thames"},{"index":3,"text_ar":"الدانوب","text_en":"The Danube"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',2,'عاصمة مصر إيه؟','What is the capital of Egypt?',20000,
 '[{"index":0,"text_ar":"القاهرة","text_en":"Cairo"},{"index":1,"text_ar":"الإسكندرية","text_en":"Alexandria"},{"index":2,"text_ar":"الأقصر","text_en":"Luxor"},{"index":3,"text_ar":"شرم الشيخ","text_en":"Sharm El-Sheikh"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',3,'توت عنخ آمون كان مين؟','Who was Tutankhamun?',20000,
 '[{"index":0,"text_ar":"فرعون بقى ملك وهو صغير","text_en":"A pharaoh who became king as a boy"},{"index":1,"text_ar":"شاعر يوناني","text_en":"A Greek poet"},{"index":2,"text_ar":"رحّالة إيطالي","text_en":"An Italian explorer"},{"index":3,"text_ar":"ماركة صنادل","text_en":"A brand of sandals"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',4,'مين اللي لقى مقبرة توت عنخ آمون سنة ١٩٢٢؟','Who found Tutankhamun''s tomb in 1922?',20000,
 '[{"index":0,"text_ar":"هوارد كارتر","text_en":"Howard Carter"},{"index":1,"text_ar":"نابليون","text_en":"Napoleon"},{"index":2,"text_ar":"ماركو بولو","text_en":"Marco Polo"},{"index":3,"text_ar":"لسه محدش لقاها","text_en":"Nobody. It is still missing"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',5,'كليوباترا كانت آخر إيه؟','Cleopatra was the last what?',20000,
 '[{"index":0,"text_ar":"حاكمة لمصر القديمة","text_en":"Ruler of ancient Egypt"},{"index":1,"text_ar":"إمبراطورة رومانية","text_en":"Roman empress"},{"index":2,"text_ar":"ملكة إسبانيا","text_en":"Queen of Spain"},{"index":3,"text_ar":"واحدة ترد على الرسايل","text_en":"Person to answer her messages"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',6,'أبو الهول جسمه جسم إيه؟','The Sphinx has the body of which animal?',20000,
 '[{"index":0,"text_ar":"أسد","text_en":"A lion"},{"index":1,"text_ar":"حصان","text_en":"A horse"},{"index":2,"text_ar":"سمكة","text_en":"A fish"},{"index":3,"text_ar":"بطريق","text_en":"A penguin"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',7,'الهيروغليفية إيه؟','What are hieroglyphs?',20000,
 '[{"index":0,"text_ar":"كتابة مصرية قديمة","text_en":"Ancient Egyptian writing"},{"index":1,"text_ar":"نوع مكرونة","text_en":"A kind of pasta"},{"index":2,"text_ar":"رقصة","text_en":"A dance"},{"index":3,"text_ar":"آلة موسيقية","text_en":"A musical instrument"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',8,'حجر رشيد ساعد العلماء في إيه؟','What did the Rosetta Stone help scholars do?',20000,
 '[{"index":0,"text_ar":"يقروا الهيروغليفية","text_en":"Read hieroglyphs"},{"index":1,"text_ar":"يبنوا الأهرامات","text_en":"Build the pyramids"},{"index":2,"text_ar":"يلاقوا منبع النيل","text_en":"Find the source of the Nile"},{"index":3,"text_ar":"يحلوا خلاف على ماتش","text_en":"Settle an argument about a football match"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',9,'قناة السويس بتوصل بين إيه وإيه؟','The Suez Canal connects what to what?',20000,
 '[{"index":0,"text_ar":"البحر المتوسط والبحر الأحمر","text_en":"The Mediterranean and the Red Sea"},{"index":1,"text_ar":"الأطلنطي والهادي","text_en":"The Atlantic and the Pacific"},{"index":2,"text_ar":"بحيرتين","text_en":"Two lakes"},{"index":3,"text_ar":"مفيش، دي للزينة","text_en":"Nothing. It is decorative"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',10,'شرم الشيخ مشهورة بإيه؟','What is Sharm El-Sheikh famous for?',20000,
 '[{"index":0,"text_ar":"الغطس في البحر الأحمر","text_en":"Diving in the Red Sea"},{"index":1,"text_ar":"التزلج على الجليد","text_en":"Skiing"},{"index":2,"text_ar":"غاباتها المطيرة","text_en":"Its rainforests"},{"index":3,"text_ar":"الشفق القطبي","text_en":"The northern lights"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',11,'مين اللي أسّس الإسكندرية؟','Who founded Alexandria?',20000,
 '[{"index":0,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great"},{"index":1,"text_ar":"يوليوس قيصر","text_en":"Julius Caesar"},{"index":2,"text_ar":"نابليون","text_en":"Napoleon"},{"index":3,"text_ar":"راجل اسمه إسكندر، طبعًا","text_en":"A man called Alex, obviously"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',12,'فنار الإسكندرية القديم كان واحد من إيه؟','The ancient Lighthouse of Alexandria was one of what?',20000,
 '[{"index":0,"text_ar":"عجائب الدنيا السبع القديمة","text_en":"The Seven Wonders of the Ancient World"},{"index":1,"text_ar":"جبال الألب","text_en":"The Alps"},{"index":2,"text_ar":"الأهرامات","text_en":"The pyramids"},{"index":3,"text_ar":"سلسلة فنادق","text_en":"A chain of hotels"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',13,'محمد صلاح بيلعب لمنتخب أنهي بلد؟','Mohamed Salah plays for which national team?',20000,
 '[{"index":0,"text_ar":"مصر","text_en":"Egypt"},{"index":1,"text_ar":"البرازيل","text_en":"Brazil"},{"index":2,"text_ar":"البرتغال","text_en":"Portugal"},{"index":3,"text_ar":"كل بلد على حسب اليوم","text_en":"A different one each week"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',14,'الكشري فيه إيه؟','What is in koshari, Egypt''s national dish?',20000,
 '[{"index":0,"text_ar":"رز وعدس ومكرونة","text_en":"Rice, lentils and pasta"},{"index":1,"text_ar":"سوشي وصويا","text_en":"Sushi and soy sauce"},{"index":2,"text_ar":"جبنة وريحان","text_en":"Cheese and basil"},{"index":3,"text_ar":"أي حاجة لقيتها في المطبخ","text_en":"Whatever was in the kitchen"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',15,'البردي كان بيتعمل منه إيه؟','What was papyrus used to make?',20000,
 '[{"index":0,"text_ar":"ورق للكتابة","text_en":"Paper to write on"},{"index":1,"text_ar":"زجاج","text_en":"Glass"},{"index":2,"text_ar":"حديد","text_en":"Iron"},{"index":3,"text_ar":"مطر","text_en":"Rain"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',16,'أغلب أرض مصر عبارة عن إيه؟','Most of Egypt''s land is what?',20000,
 '[{"index":0,"text_ar":"صحرا","text_en":"Desert"},{"index":1,"text_ar":"غابات","text_en":"Forest"},{"index":2,"text_ar":"جليد","text_en":"Ice"},{"index":3,"text_ar":"مدن ملاهي مائية","text_en":"Water parks"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',17,'السد العالي في أسوان عمل إيه؟','What did the Aswan High Dam create?',20000,
 '[{"index":0,"text_ar":"بحيرة ناصر","text_en":"Lake Nasser"},{"index":1,"text_ar":"نهر النيل","text_en":"The river Nile"},{"index":2,"text_ar":"البحر الأحمر","text_en":"The Red Sea"},{"index":3,"text_ar":"زحمة لسه مخلصتش","text_en":"A traffic jam that never ended"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',18,'معابد أبو سمبل اتبنت لمين؟','The temples at Abu Simbel were built for whom?',20000,
 '[{"index":0,"text_ar":"رمسيس التاني","text_en":"Ramses II"},{"index":1,"text_ar":"نابليون","text_en":"Napoleon"},{"index":2,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great"},{"index":3,"text_ar":"أول واحد طلب","text_en":"Whoever asked first"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',19,'عملة مصر اسمها إيه؟','What is Egypt''s currency called?',20000,
 '[{"index":0,"text_ar":"الجنيه المصري","text_en":"The Egyptian pound"},{"index":1,"text_ar":"اليورو","text_en":"The euro"},{"index":2,"text_ar":"الين","text_en":"The yen"},{"index":3,"text_ar":"جمال، بالكيلو","text_en":"Camels, by weight"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',20,'الهرم الأكبر في الجيزة اتبنى لمين؟','The Great Pyramid of Giza was built for whom?',20000,
 '[{"index":0,"text_ar":"خوفو","text_en":"Khufu"},{"index":1,"text_ar":"كليوباترا","text_en":"Cleopatra"},{"index":2,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun"},{"index":3,"text_ar":"عميل صعب جدًا","text_en":"A very demanding client"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',21,'اللغة الرسمية في مصر إيه؟','What is the official language of Egypt?',20000,
 '[{"index":0,"text_ar":"العربية","text_en":"Arabic"},{"index":1,"text_ar":"اللاتينية","text_en":"Latin"},{"index":2,"text_ar":"الهيروغليفية، لسه","text_en":"Hieroglyphs, still"},{"index":3,"text_ar":"الإيموچي","text_en":"Emoji"}]',0,'double');

notify pgrst, 'reload schema';
