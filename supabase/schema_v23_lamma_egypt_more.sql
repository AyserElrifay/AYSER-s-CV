-- ═══════════════════════════════════════════════════════════════════
--  لمّة · MORE EGYPT: WHERE IT HAS BEEN, WHERE IT IS, AND WHAT IT SAYS
--
--  Twenty-one more questions in the one portal, in the five languages
--  the pack is written in. Three kinds, and each is there for a reason:
--
--  HISTORY, the parts of it the rest of the world already half knows —
--  Cleopatra and Rome, the Suez Canal, the library at Alexandria, 1952.
--  A question only somebody from Cairo could answer is not a quiz for a
--  mixed room, it is a wall.
--
--  GEOGRAPHY, which is the fastest way for somebody who has never been
--  to end the night knowing where Egypt actually is: which seas, which
--  neighbours, why nearly everybody lives along one river.
--
--  AND THE PROVERBS, which are the reason this is Egyptian and not a
--  textbook. They are translated LITERALLY on purpose — "a monkey is a
--  gazelle in his mother's eyes" lands in French and Romanian exactly
--  the way it lands in Arabic, because the picture inside it is the
--  joke. The question is what it MEANS, so an Egyptian answers from
--  having heard it all their life and everybody else answers by working
--  it out, and both of those are a good moment at a table.
--
--  Nobody is the butt of any of them. They are about mothers, patience,
--  hunger and staying out of other people's marriages.
--
--  The pack is 43 questions now. Written the same two-step way as the
--  first 22 — Arabic and English in the insert, the other three in
--  text_i18n — so the language check reads all of them alike.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index >= 22;

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('eeee5555-0000-4000-8000-000000000001',22,'الأهرامات في الجيزة عمرها حوالي قد إيه؟','Roughly how old are the pyramids of Giza?',20000,
 '[{"index":0,"text_ar":"حوالي ٤٥٠٠ سنة","text_en":"About 4,500 years"},{"index":1,"text_ar":"حوالي ٥٠٠ سنة","text_en":"About 500 years"},{"index":2,"text_ar":"اتبنت في العصر الروماني","text_en":"They were built in Roman times"},{"index":3,"text_ar":"اتبنت في القرن التسعتاشر","text_en":"They were built in the 1800s"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',23,'بعد كليوباترا، مصر بقت جزء من أنهي إمبراطورية؟','After Cleopatra, Egypt became part of which empire?',20000,
 '[{"index":0,"text_ar":"الإمبراطورية الرومانية","text_en":"The Roman Empire"},{"index":1,"text_ar":"الإمبراطورية الفارسية","text_en":"The Persian Empire"},{"index":2,"text_ar":"الإمبراطورية الإسبانية","text_en":"The Spanish Empire"},{"index":3,"text_ar":"مبقتش جزء من حاجة","text_en":"None — it stayed on its own"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',24,'قناة السويس اتفتحت في أنهي قرن؟','In which century did the Suez Canal open?',20000,
 '[{"index":0,"text_ar":"القرن التسعتاشر","text_en":"The 19th century"},{"index":1,"text_ar":"القرن الخمستاشر","text_en":"The 15th century"},{"index":2,"text_ar":"القرن العشرين","text_en":"The 20th century"},{"index":3,"text_ar":"القرن الواحد والعشرين","text_en":"The 21st century"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',25,'مصر بقت جمهورية بعد ثورة سنة كام؟','Egypt became a republic after the revolution of which year?',20000,
 '[{"index":0,"text_ar":"١٩٥٢","text_en":"1952"},{"index":1,"text_ar":"١٧٨٩","text_en":"1789"},{"index":2,"text_ar":"١٨٤٨","text_en":"1848"},{"index":3,"text_ar":"١٩٩١","text_en":"1991"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',26,'مين كان رئيس مصر وقت بناء السد العالي؟','Who was Egypt’s president when the Aswan High Dam was built?',20000,
 '[{"index":0,"text_ar":"جمال عبد الناصر","text_en":"Gamal Abdel Nasser"},{"index":1,"text_ar":"أنور السادات","text_en":"Anwar Sadat"},{"index":2,"text_ar":"محمد علي","text_en":"Muhammad Ali Pasha"},{"index":3,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',27,'أشهر مكتبة في العالم القديم كانت في أنهي مدينة؟','The most famous library of the ancient world was in which city?',20000,
 '[{"index":0,"text_ar":"الإسكندرية","text_en":"Alexandria"},{"index":1,"text_ar":"روما","text_en":"Rome"},{"index":2,"text_ar":"أثينا","text_en":"Athens"},{"index":3,"text_ar":"باريس","text_en":"Paris"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',28,'في التحنيط، الأعضاء كانت بتتحط في إيه؟','In mummification, the organs were kept in what?',20000,
 '[{"index":0,"text_ar":"أواني كانوبية","text_en":"Canopic jars"},{"index":1,"text_ar":"في التابوت مع الجسم","text_en":"In the coffin with the body"},{"index":2,"text_ar":"في النيل","text_en":"In the Nile"},{"index":3,"text_ar":"في صندوق تحت السرير","text_en":"In a box under the bed"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',29,'أنهي بحر شمال مصر؟','Which sea is to the north of Egypt?',20000,
 '[{"index":0,"text_ar":"البحر المتوسط","text_en":"The Mediterranean"},{"index":1,"text_ar":"بحر البلطيق","text_en":"The Baltic"},{"index":2,"text_ar":"البحر الأسود","text_en":"The Black Sea"},{"index":3,"text_ar":"بحر الشمال","text_en":"The North Sea"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',30,'أنهي بحر شرق مصر؟','Which sea is to the east of Egypt?',20000,
 '[{"index":0,"text_ar":"البحر الأحمر","text_en":"The Red Sea"},{"index":1,"text_ar":"البحر الكاريبي","text_en":"The Caribbean"},{"index":2,"text_ar":"بحر قزوين","text_en":"The Caspian"},{"index":3,"text_ar":"البحر الأدرياتيكي","text_en":"The Adriatic"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',31,'سينا عبارة عن إيه؟','Sinai is what?',20000,
 '[{"index":0,"text_ar":"شبه جزيرة","text_en":"A peninsula"},{"index":1,"text_ar":"جزيرة","text_en":"An island"},{"index":2,"text_ar":"بحيرة","text_en":"A lake"},{"index":3,"text_ar":"مدينة","text_en":"A city"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',32,'أنهي بلد غرب مصر؟','Which country borders Egypt to the west?',20000,
 '[{"index":0,"text_ar":"ليبيا","text_en":"Libya"},{"index":1,"text_ar":"المغرب","text_en":"Morocco"},{"index":2,"text_ar":"الجزائر","text_en":"Algeria"},{"index":3,"text_ar":"تونس","text_en":"Tunisia"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',33,'أنهي بلد جنوب مصر؟','Which country borders Egypt to the south?',20000,
 '[{"index":0,"text_ar":"السودان","text_en":"Sudan"},{"index":1,"text_ar":"إثيوبيا","text_en":"Ethiopia"},{"index":2,"text_ar":"كينيا","text_en":"Kenya"},{"index":3,"text_ar":"تشاد","text_en":"Chad"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',34,'النيل قبل ما يصب في البحر بيعمل إيه؟','Before it reaches the sea, the Nile spreads into what?',20000,
 '[{"index":0,"text_ar":"دلتا","text_en":"A delta"},{"index":1,"text_ar":"شلال","text_en":"A waterfall"},{"index":2,"text_ar":"نفق","text_en":"A tunnel"},{"index":3,"text_ar":"بحيرة جليدية","text_en":"A glacier lake"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',35,'أغلب المصريين ساكنين جنب إيه؟','Most Egyptians live close to what?',20000,
 '[{"index":0,"text_ar":"النيل","text_en":"The Nile"},{"index":1,"text_ar":"الحدود الغربية","text_en":"The western border"},{"index":2,"text_ar":"جبال سينا","text_en":"The Sinai mountains"},{"index":3,"text_ar":"الواحات في الصحرا","text_en":"The desert oases"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',36,'«القرد في عين أمه غزال» — المثل ده معناه إيه؟','“A monkey is a gazelle in his mother’s eyes” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"الأم دايمًا شايفة ابنها أحلى واحد","text_en":"A mother always sees her child as beautiful"},{"index":1,"text_ar":"القرود بتعيش في الغابة","text_en":"Monkeys live in forests"},{"index":2,"text_ar":"لازم تشوف كويس قبل ما تحكم","text_en":"Get your eyes tested before judging"},{"index":3,"text_ar":"الغزال أسرع من القرد","text_en":"A gazelle is faster than a monkey"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',37,'«اللي فات مات» — معناه إيه؟','“What has passed is dead” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"سيب اللي فات وكمّل","text_en":"Let the past go and carry on"},{"index":1,"text_ar":"التاريخ مش مهم","text_en":"History does not matter"},{"index":2,"text_ar":"ما تسألش عن حد مات","text_en":"Never speak of the dead"},{"index":3,"text_ar":"الوقت بيعدي بسرعة","text_en":"Time passes quickly"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',38,'«إيد واحدة ما تسقفش» — معناه إيه؟','“One hand does not clap” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"محدش بيعمل حاجة لوحده","text_en":"Nothing gets done alone"},{"index":1,"text_ar":"التصفيق مش مهذب","text_en":"Clapping is rude"},{"index":2,"text_ar":"استخدم إيدك الشمال","text_en":"Use your left hand"},{"index":3,"text_ar":"الموسيقى محتاجة ناس","text_en":"Music needs an audience"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',39,'«الصبر مفتاح الفرج» — معناه إيه؟','“Patience is the key to relief” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"استنى وهتتحل","text_en":"Wait, and things work out"},{"index":1,"text_ar":"خد نسخة من المفتاح","text_en":"Keep a spare key"},{"index":2,"text_ar":"اقفل الباب ورا نفسك","text_en":"Lock the door behind you"},{"index":3,"text_ar":"الاستعجال بيوفر وقت","text_en":"Hurrying saves time"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',40,'«الجعان يحلم بسوق العيش» — معناه إيه؟','“A hungry man dreams of the bread market” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"اللي ناقصك هو اللي بتفكر فيه","text_en":"You think about whatever you are short of"},{"index":1,"text_ar":"الأسواق بتفتح بدري","text_en":"Markets open early"},{"index":2,"text_ar":"العيش أحسن أكل","text_en":"Bread is the best food"},{"index":3,"text_ar":"الأحلام بتتحقق","text_en":"Dreams come true"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',41,'«الباب اللي يجيلك منه الريح سده واستريح» — معناه إيه؟','“Block the door the wind comes from, and rest” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"اقطع سبب المشكلة من أوله","text_en":"Cut off whatever is causing you trouble"},{"index":1,"text_ar":"اقفل الشبابيك بالليل","text_en":"Close the windows at night"},{"index":2,"text_ar":"النوم أحسن حاجة","text_en":"Sleep is the best thing"},{"index":3,"text_ar":"الهوا مفيد للصحة","text_en":"Fresh air is good for you"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',42,'«امشي في جنازة ولا تمشي في جوازة» — معناه إيه؟','“Walk in a funeral rather than arrange a marriage” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"ما تتدخلش في جواز حد، هتتلام","text_en":"Do not get involved in matchmaking — you will get the blame"},{"index":1,"text_ar":"الجنازات أرخص","text_en":"Funerals are cheaper"},{"index":2,"text_ar":"الجواز مش مهم","text_en":"Marriage does not matter"},{"index":3,"text_ar":"امشي كتير عشان صحتك","text_en":"Walking is good for your health"}]',0,'double');

update public.questions set
  text_i18n = '{"fr": "Les pyramides de Gizeh ont à peu près quel âge ?", "es": "¿Qué edad tienen más o menos las pirámides de Guiza?", "ro": "Cam ce vechime au piramidele din Giza?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حوالي ٤٥٠٠ سنة","text_en":"About 4,500 years","text_i18n":{"fr":"Environ 4 500 ans","es":"Unos 4.500 años","ro":"Cam 4.500 de ani"}},{"index":1,"text_ar":"حوالي ٥٠٠ سنة","text_en":"About 500 years","text_i18n":{"fr":"Environ 500 ans","es":"Unos 500 años","ro":"Cam 500 de ani"}},{"index":2,"text_ar":"اتبنت في العصر الروماني","text_en":"They were built in Roman times","text_i18n":{"fr":"Elles datent de l’époque romaine","es":"Se construyeron en época romana","ro":"Au fost construite în epoca romană"}},{"index":3,"text_ar":"اتبنت في القرن التسعتاشر","text_en":"They were built in the 1800s","text_i18n":{"fr":"Elles datent du XIXᵉ siècle","es":"Se construyeron en el siglo XIX","ro":"Au fost construite în secolul al XIX-lea"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 22;

update public.questions set
  text_i18n = '{"fr": "Après Cléopâtre, l’Égypte est devenue partie de quel empire ?", "es": "Tras Cleopatra, Egipto pasó a formar parte de qué imperio?", "ro": "După Cleopatra, Egiptul a intrat în ce imperiu?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الإمبراطورية الرومانية","text_en":"The Roman Empire","text_i18n":{"fr":"L’Empire romain","es":"El Imperio romano","ro":"Imperiul Roman"}},{"index":1,"text_ar":"الإمبراطورية الفارسية","text_en":"The Persian Empire","text_i18n":{"fr":"L’Empire perse","es":"El Imperio persa","ro":"Imperiul Persan"}},{"index":2,"text_ar":"الإمبراطورية الإسبانية","text_en":"The Spanish Empire","text_i18n":{"fr":"L’Empire espagnol","es":"El Imperio español","ro":"Imperiul Spaniol"}},{"index":3,"text_ar":"مبقتش جزء من حاجة","text_en":"None — it stayed on its own","text_i18n":{"fr":"Aucun, elle est restée seule","es":"Ninguno, siguió por su cuenta","ro":"Niciunul, a rămas de capul ei"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 23;

update public.questions set
  text_i18n = '{"fr": "Le canal de Suez a été ouvert à quel siècle ?", "es": "¿En qué siglo se abrió el canal de Suez?", "ro": "În ce secol a fost deschis Canalul Suez?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"القرن التسعتاشر","text_en":"The 19th century","text_i18n":{"fr":"Le XIXᵉ siècle","es":"El siglo XIX","ro":"Secolul al XIX-lea"}},{"index":1,"text_ar":"القرن الخمستاشر","text_en":"The 15th century","text_i18n":{"fr":"Le XVᵉ siècle","es":"El siglo XV","ro":"Secolul al XV-lea"}},{"index":2,"text_ar":"القرن العشرين","text_en":"The 20th century","text_i18n":{"fr":"Le XXᵉ siècle","es":"El siglo XX","ro":"Secolul al XX-lea"}},{"index":3,"text_ar":"القرن الواحد والعشرين","text_en":"The 21st century","text_i18n":{"fr":"Le XXIᵉ siècle","es":"El siglo XXI","ro":"Secolul al XXI-lea"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 24;

update public.questions set
  text_i18n = '{"fr": "L’Égypte est devenue une république après la révolution de quelle année ?", "es": "Egipto se hizo república tras la revolución de qué año?", "ro": "Egiptul a devenit republică după revoluția din ce an?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"١٩٥٢","text_en":"1952","text_i18n":{"fr":"1952","es":"1952","ro":"1952"}},{"index":1,"text_ar":"١٧٨٩","text_en":"1789","text_i18n":{"fr":"1789","es":"1789","ro":"1789"}},{"index":2,"text_ar":"١٨٤٨","text_en":"1848","text_i18n":{"fr":"1848","es":"1848","ro":"1848"}},{"index":3,"text_ar":"١٩٩١","text_en":"1991","text_i18n":{"fr":"1991","es":"1991","ro":"1991"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 25;

update public.questions set
  text_i18n = '{"fr": "Qui était président de l’Égypte quand le haut barrage d’Assouan a été construit ?", "es": "¿Quién era presidente de Egipto cuando se construyó la presa de Asuán?", "ro": "Cine era președintele Egiptului când s-a construit Barajul Aswan?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"جمال عبد الناصر","text_en":"Gamal Abdel Nasser","text_i18n":{"fr":"Gamal Abdel Nasser","es":"Gamal Abdel Nasser","ro":"Gamal Abdel Nasser"}},{"index":1,"text_ar":"أنور السادات","text_en":"Anwar Sadat","text_i18n":{"fr":"Anouar el-Sadate","es":"Anwar el-Sadat","ro":"Anwar Sadat"}},{"index":2,"text_ar":"محمد علي","text_en":"Muhammad Ali Pasha","text_i18n":{"fr":"Méhémet Ali","es":"Mehmet Alí","ro":"Mehmet Ali"}},{"index":3,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun","text_i18n":{"fr":"Toutânkhamon","es":"Tutankamón","ro":"Tutankhamon"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 26;

update public.questions set
  text_i18n = '{"fr": "La plus célèbre bibliothèque de l’Antiquité était dans quelle ville ?", "es": "¿En qué ciudad estaba la biblioteca más famosa del mundo antiguo?", "ro": "Cea mai faimoasă bibliotecă a lumii antice era în ce oraș?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الإسكندرية","text_en":"Alexandria","text_i18n":{"fr":"Alexandrie","es":"Alejandría","ro":"Alexandria"}},{"index":1,"text_ar":"روما","text_en":"Rome","text_i18n":{"fr":"Rome","es":"Roma","ro":"Roma"}},{"index":2,"text_ar":"أثينا","text_en":"Athens","text_i18n":{"fr":"Athènes","es":"Atenas","ro":"Atena"}},{"index":3,"text_ar":"باريس","text_en":"Paris","text_i18n":{"fr":"Paris","es":"París","ro":"Paris"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 27;

update public.questions set
  text_i18n = '{"fr": "Lors de la momification, les organes étaient conservés dans quoi ?", "es": "En la momificación, ¿dónde se guardaban los órganos?", "ro": "La mumificare, organele erau păstrate în ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أواني كانوبية","text_en":"Canopic jars","text_i18n":{"fr":"Des vases canopes","es":"Vasos canopos","ro":"Vase canope"}},{"index":1,"text_ar":"في التابوت مع الجسم","text_en":"In the coffin with the body","text_i18n":{"fr":"Dans le cercueil avec le corps","es":"En el ataúd con el cuerpo","ro":"În sicriu, lângă corp"}},{"index":2,"text_ar":"في النيل","text_en":"In the Nile","text_i18n":{"fr":"Dans le Nil","es":"En el Nilo","ro":"În Nil"}},{"index":3,"text_ar":"في صندوق تحت السرير","text_en":"In a box under the bed","text_i18n":{"fr":"Dans une boîte sous le lit","es":"En una caja bajo la cama","ro":"Într-o cutie sub pat"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 28;

update public.questions set
  text_i18n = '{"fr": "Quelle mer se trouve au nord de l’Égypte ?", "es": "¿Qué mar está al norte de Egipto?", "ro": "Ce mare este la nord de Egipt?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"البحر المتوسط","text_en":"The Mediterranean","text_i18n":{"fr":"La Méditerranée","es":"El Mediterráneo","ro":"Marea Mediterană"}},{"index":1,"text_ar":"بحر البلطيق","text_en":"The Baltic","text_i18n":{"fr":"La Baltique","es":"El Báltico","ro":"Marea Baltică"}},{"index":2,"text_ar":"البحر الأسود","text_en":"The Black Sea","text_i18n":{"fr":"La mer Noire","es":"El mar Negro","ro":"Marea Neagră"}},{"index":3,"text_ar":"بحر الشمال","text_en":"The North Sea","text_i18n":{"fr":"La mer du Nord","es":"El mar del Norte","ro":"Marea Nordului"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 29;

update public.questions set
  text_i18n = '{"fr": "Quelle mer se trouve à l’est de l’Égypte ?", "es": "¿Qué mar está al este de Egipto?", "ro": "Ce mare este la est de Egipt?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"البحر الأحمر","text_en":"The Red Sea","text_i18n":{"fr":"La mer Rouge","es":"El mar Rojo","ro":"Marea Roșie"}},{"index":1,"text_ar":"البحر الكاريبي","text_en":"The Caribbean","text_i18n":{"fr":"La mer des Caraïbes","es":"El Caribe","ro":"Marea Caraibilor"}},{"index":2,"text_ar":"بحر قزوين","text_en":"The Caspian","text_i18n":{"fr":"La mer Caspienne","es":"El Caspio","ro":"Marea Caspică"}},{"index":3,"text_ar":"البحر الأدرياتيكي","text_en":"The Adriatic","text_i18n":{"fr":"L’Adriatique","es":"El Adriático","ro":"Marea Adriatică"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 30;

update public.questions set
  text_i18n = '{"fr": "Le Sinaï, c’est quoi ?", "es": "¿Qué es el Sinaí?", "ro": "Ce este Sinai?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"شبه جزيرة","text_en":"A peninsula","text_i18n":{"fr":"Une péninsule","es":"Una península","ro":"O peninsulă"}},{"index":1,"text_ar":"جزيرة","text_en":"An island","text_i18n":{"fr":"Une île","es":"Una isla","ro":"O insulă"}},{"index":2,"text_ar":"بحيرة","text_en":"A lake","text_i18n":{"fr":"Un lac","es":"Un lago","ro":"Un lac"}},{"index":3,"text_ar":"مدينة","text_en":"A city","text_i18n":{"fr":"Une ville","es":"Una ciudad","ro":"Un oraș"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 31;

update public.questions set
  text_i18n = '{"fr": "Quel pays borde l’Égypte à l’ouest ?", "es": "¿Qué país limita con Egipto al oeste?", "ro": "Ce țară se învecinează cu Egiptul la vest?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"ليبيا","text_en":"Libya","text_i18n":{"fr":"La Libye","es":"Libia","ro":"Libia"}},{"index":1,"text_ar":"المغرب","text_en":"Morocco","text_i18n":{"fr":"Le Maroc","es":"Marruecos","ro":"Maroc"}},{"index":2,"text_ar":"الجزائر","text_en":"Algeria","text_i18n":{"fr":"L’Algérie","es":"Argelia","ro":"Algeria"}},{"index":3,"text_ar":"تونس","text_en":"Tunisia","text_i18n":{"fr":"La Tunisie","es":"Túnez","ro":"Tunisia"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 32;

update public.questions set
  text_i18n = '{"fr": "Quel pays borde l’Égypte au sud ?", "es": "¿Qué país limita con Egipto al sur?", "ro": "Ce țară se învecinează cu Egiptul la sud?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"السودان","text_en":"Sudan","text_i18n":{"fr":"Le Soudan","es":"Sudán","ro":"Sudan"}},{"index":1,"text_ar":"إثيوبيا","text_en":"Ethiopia","text_i18n":{"fr":"L’Éthiopie","es":"Etiopía","ro":"Etiopia"}},{"index":2,"text_ar":"كينيا","text_en":"Kenya","text_i18n":{"fr":"Le Kenya","es":"Kenia","ro":"Kenya"}},{"index":3,"text_ar":"تشاد","text_en":"Chad","text_i18n":{"fr":"Le Tchad","es":"Chad","ro":"Ciad"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 33;

update public.questions set
  text_i18n = '{"fr": "Avant d’atteindre la mer, le Nil forme quoi ?", "es": "Antes de llegar al mar, el Nilo forma qué?", "ro": "Înainte să ajungă la mare, Nilul formează ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"دلتا","text_en":"A delta","text_i18n":{"fr":"Un delta","es":"Un delta","ro":"O deltă"}},{"index":1,"text_ar":"شلال","text_en":"A waterfall","text_i18n":{"fr":"Une cascade","es":"Una cascada","ro":"O cascadă"}},{"index":2,"text_ar":"نفق","text_en":"A tunnel","text_i18n":{"fr":"Un tunnel","es":"Un túnel","ro":"Un tunel"}},{"index":3,"text_ar":"بحيرة جليدية","text_en":"A glacier lake","text_i18n":{"fr":"Un lac glaciaire","es":"Un lago glaciar","ro":"Un lac glaciar"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 34;

update public.questions set
  text_i18n = '{"fr": "La plupart des Égyptiens vivent près de quoi ?", "es": "¿Cerca de qué vive la mayoría de los egipcios?", "ro": "Cei mai mulți egipteni locuiesc aproape de ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"النيل","text_en":"The Nile","text_i18n":{"fr":"Le Nil","es":"El Nilo","ro":"Nil"}},{"index":1,"text_ar":"الحدود الغربية","text_en":"The western border","text_i18n":{"fr":"La frontière ouest","es":"La frontera occidental","ro":"Granița de vest"}},{"index":2,"text_ar":"جبال سينا","text_en":"The Sinai mountains","text_i18n":{"fr":"Les montagnes du Sinaï","es":"Las montañas del Sinaí","ro":"Munții Sinai"}},{"index":3,"text_ar":"الواحات في الصحرا","text_en":"The desert oases","text_i18n":{"fr":"Les oasis du désert","es":"Los oasis del desierto","ro":"Oazele din deșert"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 35;

update public.questions set
  text_i18n = '{"fr": "« Un singe est une gazelle aux yeux de sa mère » — que veut dire ce proverbe égyptien ?", "es": "“Un mono es una gacela a los ojos de su madre” — ¿qué significa este dicho egipcio?", "ro": "„O maimuță e o gazelă în ochii mamei ei” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الأم دايمًا شايفة ابنها أحلى واحد","text_en":"A mother always sees her child as beautiful","text_i18n":{"fr":"Une mère trouve toujours son enfant beau","es":"Una madre siempre ve guapo a su hijo","ro":"O mamă își vede mereu copilul frumos"}},{"index":1,"text_ar":"القرود بتعيش في الغابة","text_en":"Monkeys live in forests","text_i18n":{"fr":"Les singes vivent en forêt","es":"Los monos viven en el bosque","ro":"Maimuțele trăiesc în pădure"}},{"index":2,"text_ar":"لازم تشوف كويس قبل ما تحكم","text_en":"Get your eyes tested before judging","text_i18n":{"fr":"Faites vérifier vos yeux avant de juger","es":"Hazte una revisión de la vista antes de juzgar","ro":"Verifică-ți vederea înainte să judeci"}},{"index":3,"text_ar":"الغزال أسرع من القرد","text_en":"A gazelle is faster than a monkey","text_i18n":{"fr":"La gazelle court plus vite que le singe","es":"La gacela es más rápida que el mono","ro":"Gazela e mai rapidă decât maimuța"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 36;

update public.questions set
  text_i18n = '{"fr": "« Ce qui est passé est mort » — que veut dire ce proverbe égyptien ?", "es": "“Lo que pasó, murió” — ¿qué significa este dicho egipcio?", "ro": "„Ce-a trecut a murit” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"سيب اللي فات وكمّل","text_en":"Let the past go and carry on","text_i18n":{"fr":"Laisse le passé et avance","es":"Deja atrás el pasado y sigue","ro":"Lasă trecutul și mergi mai departe"}},{"index":1,"text_ar":"التاريخ مش مهم","text_en":"History does not matter","text_i18n":{"fr":"L’histoire n’a pas d’importance","es":"La historia no importa","ro":"Istoria nu contează"}},{"index":2,"text_ar":"ما تسألش عن حد مات","text_en":"Never speak of the dead","text_i18n":{"fr":"Ne parle jamais des morts","es":"No hables de los muertos","ro":"Nu vorbi despre cei morți"}},{"index":3,"text_ar":"الوقت بيعدي بسرعة","text_en":"Time passes quickly","text_i18n":{"fr":"Le temps passe vite","es":"El tiempo pasa rápido","ro":"Timpul trece repede"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 37;

update public.questions set
  text_i18n = '{"fr": "« Une seule main n’applaudit pas » — que veut dire ce proverbe égyptien ?", "es": "“Una sola mano no aplaude” — ¿qué significa este dicho egipcio?", "ro": "„O singură mână nu aplaudă” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"محدش بيعمل حاجة لوحده","text_en":"Nothing gets done alone","text_i18n":{"fr":"On ne fait rien tout seul","es":"Solo no se consigue nada","ro":"Singur nu faci nimic"}},{"index":1,"text_ar":"التصفيق مش مهذب","text_en":"Clapping is rude","text_i18n":{"fr":"Applaudir est impoli","es":"Aplaudir es de mala educación","ro":"Aplauzele sunt nepoliticoase"}},{"index":2,"text_ar":"استخدم إيدك الشمال","text_en":"Use your left hand","text_i18n":{"fr":"Utilise ta main gauche","es":"Usa la mano izquierda","ro":"Folosește mâna stângă"}},{"index":3,"text_ar":"الموسيقى محتاجة ناس","text_en":"Music needs an audience","text_i18n":{"fr":"La musique a besoin de public","es":"La música necesita público","ro":"Muzica are nevoie de public"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 38;

update public.questions set
  text_i18n = '{"fr": "« La patience est la clé du soulagement » — que veut dire ce proverbe égyptien ?", "es": "“La paciencia es la llave del alivio” — ¿qué significa este dicho egipcio?", "ro": "„Răbdarea e cheia ușurării” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"استنى وهتتحل","text_en":"Wait, and things work out","text_i18n":{"fr":"Patiente, et les choses s’arrangent","es":"Espera y las cosas se arreglan","ro":"Ai răbdare și lucrurile se rezolvă"}},{"index":1,"text_ar":"خد نسخة من المفتاح","text_en":"Keep a spare key","text_i18n":{"fr":"Garde un double des clés","es":"Ten una copia de la llave","ro":"Ține o cheie de rezervă"}},{"index":2,"text_ar":"اقفل الباب ورا نفسك","text_en":"Lock the door behind you","text_i18n":{"fr":"Ferme la porte derrière toi","es":"Cierra la puerta al salir","ro":"Închide ușa după tine"}},{"index":3,"text_ar":"الاستعجال بيوفر وقت","text_en":"Hurrying saves time","text_i18n":{"fr":"Se dépêcher fait gagner du temps","es":"Correr ahorra tiempo","ro":"Graba economisește timp"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 39;

update public.questions set
  text_i18n = '{"fr": "« L’affamé rêve du marché au pain » — que veut dire ce proverbe égyptien ?", "es": "“El hambriento sueña con el mercado del pan” — ¿qué significa este dicho egipcio?", "ro": "„Flămândul visează piața de pâine” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"اللي ناقصك هو اللي بتفكر فيه","text_en":"You think about whatever you are short of","text_i18n":{"fr":"On pense à ce qui nous manque","es":"Piensas en lo que te falta","ro":"Te gândești la ce îți lipsește"}},{"index":1,"text_ar":"الأسواق بتفتح بدري","text_en":"Markets open early","text_i18n":{"fr":"Les marchés ouvrent tôt","es":"Los mercados abren temprano","ro":"Piețele se deschid devreme"}},{"index":2,"text_ar":"العيش أحسن أكل","text_en":"Bread is the best food","text_i18n":{"fr":"Le pain est le meilleur des aliments","es":"El pan es la mejor comida","ro":"Pâinea e cea mai bună mâncare"}},{"index":3,"text_ar":"الأحلام بتتحقق","text_en":"Dreams come true","text_i18n":{"fr":"Les rêves se réalisent","es":"Los sueños se cumplen","ro":"Visele se împlinesc"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 40;

update public.questions set
  text_i18n = '{"fr": "« Bouche la porte d’où vient le vent, et repose-toi » — que veut dire ce proverbe égyptien ?", "es": "“Tapa la puerta por donde entra el viento y descansa” — ¿qué significa este dicho egipcio?", "ro": "„Astupă ușa de unde vine vântul și odihnește-te” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"اقطع سبب المشكلة من أوله","text_en":"Cut off whatever is causing you trouble","text_i18n":{"fr":"Coupe court à ce qui te cause du souci","es":"Corta de raíz lo que te causa problemas","ro":"Taie de la rădăcină ce îți face probleme"}},{"index":1,"text_ar":"اقفل الشبابيك بالليل","text_en":"Close the windows at night","text_i18n":{"fr":"Ferme les fenêtres la nuit","es":"Cierra las ventanas de noche","ro":"Închide ferestrele noaptea"}},{"index":2,"text_ar":"النوم أحسن حاجة","text_en":"Sleep is the best thing","text_i18n":{"fr":"Dormir est ce qu’il y a de mieux","es":"Dormir es lo mejor","ro":"Somnul e cel mai bun lucru"}},{"index":3,"text_ar":"الهوا مفيد للصحة","text_en":"Fresh air is good for you","text_i18n":{"fr":"L’air frais fait du bien","es":"El aire fresco es bueno","ro":"Aerul curat îți face bine"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 41;

update public.questions set
  text_i18n = '{"fr": "« Marche dans un enterrement plutôt que d’arranger un mariage » — que veut dire ce proverbe égyptien ?", "es": "“Ve a un funeral antes que arreglar una boda” — ¿qué significa este dicho egipcio?", "ro": "„Mai bine mergi la o înmormântare decât să pui la cale o nuntă” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"ما تتدخلش في جواز حد، هتتلام","text_en":"Do not get involved in matchmaking — you will get the blame","text_i18n":{"fr":"Ne joue pas les entremetteurs : on t’en tiendra rigueur","es":"No hagas de casamentero: te echarán la culpa","ro":"Nu te băga pețitor — tot pe tine dau vina"}},{"index":1,"text_ar":"الجنازات أرخص","text_en":"Funerals are cheaper","text_i18n":{"fr":"Les enterrements coûtent moins cher","es":"Los funerales son más baratos","ro":"Înmormântările sunt mai ieftine"}},{"index":2,"text_ar":"الجواز مش مهم","text_en":"Marriage does not matter","text_i18n":{"fr":"Le mariage n’a pas d’importance","es":"El matrimonio no importa","ro":"Căsătoria nu contează"}},{"index":3,"text_ar":"امشي كتير عشان صحتك","text_en":"Walking is good for your health","text_i18n":{"fr":"Marcher est bon pour la santé","es":"Caminar es bueno para la salud","ro":"Mersul pe jos e bun pentru sănătate"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 42;

-- ── AND THE SHELF SAYS WHAT IS IN IT ───────────────────────────────
-- "From the pharaohs to Mo Salah" was true of 22 questions. It is now
-- three times the evening, and the card should say so before somebody
-- starts a room expecting five minutes.
update public.game_packs set
  description_ar = 'تاريخ وجغرافيا وأكل وكورة وأمثال — ٤٣ سؤال',
  description_en = 'History, geography, food, football and the sayings — 43 questions'
 where id = 'eeee5555-0000-4000-8000-000000000001';

notify pgrst, 'reload schema';
