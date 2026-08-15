-- ═══════════════════════════════════════════════════════════════════
--  لمّة · MORE EGYPT, AND FUNNIER
--
--  Four new packs, all country = 'EG'. The three original Egyptian
--  packs (films, 90s songs, football) are straight trivia and stay that
--  way — a quiz night needs something you can actually be good at.
--  These four are the other half of the evening.
--
--  ── THE RULE THE JOKES FOLLOW ────────────────────────────────────
--  A quiz still has to have a right answer, so the joke cannot live in
--  the question. Four defensible answers is not funny, it is broken,
--  and the argument afterwards is the bad kind.
--
--  So the FACT is real and the WRONG answers are the joke. You read
--  four options, three of them are ridiculous, and the laugh happens
--  before you tap. Sometimes the true answer is the funny one — the
--  sewing kit in the biscuit tin is a real fact about real Egyptian
--  houses — and that is the best case of all, because the laugh is
--  recognition rather than a punchline.
--
--  ── AND WHO IT IS NEVER AT ───────────────────────────────────────
--  Nothing here is at anybody's expense. No weight, no money, no
--  religion as a target, no families, no accents, no regions, nobody's
--  mother. Egyptians laughing at microbuses, at how long "بكرة" takes
--  and at the tin of biscuits that has never once contained biscuits
--  is a joke everybody in the room is inside. That line is deliberate
--  and it stays.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.game_packs where id in (
  'dddd4444-0000-4000-8000-000000000001',
  'dddd4444-0000-4000-8000-000000000002',
  'dddd4444-0000-4000-8000-000000000003',
  'dddd4444-0000-4000-8000-000000000004'
);

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en, category, country, locale, is_official, visibility) values
 ('dddd4444-0000-4000-8000-000000000001','مواصلات مصر','Getting around Egypt',
  'ميكروباص وتوك توك ومترو','Microbuses, tuk-tuks and one very busy metro.','fun','EG','ar-EG',true,'public'),
 ('dddd4444-0000-4000-8000-000000000002','البيت المصري','An Egyptian house',
  'علبة البسكوت اللي مفيهاش بسكوت','The biscuit tin that has never contained biscuits.','fun','EG','ar-EG',true,'public'),
 ('dddd4444-0000-4000-8000-000000000003','رمضان في مصر','Ramadan in Egypt',
  'فوانيس وقطايف ومدفع','Lanterns, qatayef and a cannon.','fun','EG','ar-EG',true,'public'),
 ('dddd4444-0000-4000-8000-000000000004','أيام المدرسة','School days in Egypt',
  'الطابور والكانتين والحصة الأخيرة','The morning line-up, the canteen, the last period.','fun','EG','ar-EG',true,'public');

-- ── مواصلات مصر ────────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('dddd4444-0000-4000-8000-000000000001',0,'عايز تنزل من الميكروباص، بتقول إيه؟','You want to get off the microbus. What do you say?',20000,
 '[{"index":0,"text_ar":"على جنب لو سمحت","text_en":"Pull over, please"},{"index":1,"text_ar":"افتح يا سمسم","text_en":"Open sesame"},{"index":2,"text_ar":"أنا وصلت، مع السلامة يا جماعة","text_en":"I have arrived, farewell everyone"},{"index":3,"text_ar":"مش هنزل، أنا عايش هنا دلوقتي","text_en":"I am not getting off. I live here now"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',1,'«الأسطى» في الميكروباص هو مين؟','Who is the "usta" on a microbus?',20000,
 '[{"index":0,"text_ar":"السواق","text_en":"The driver"},{"index":1,"text_ar":"أكبر واحد سنًا في العربية","text_en":"The oldest passenger aboard"},{"index":2,"text_ar":"اللي قاعد جنب الشباك","text_en":"Whoever got the window seat"},{"index":3,"text_ar":"محدش، دي رتبة شرفية","text_en":"Nobody. It is an honorary title"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',2,'التوك توك أصله جاي من بلد إيه؟','Which country is the tuk-tuk originally from?',20000,
 '[{"index":0,"text_ar":"الهند","text_en":"India"},{"index":1,"text_ar":"المنصورة","text_en":"Mansoura"},{"index":2,"text_ar":"النرويج","text_en":"Norway"},{"index":3,"text_ar":"اتولد لوحده في شارع","text_en":"It formed spontaneously in a side street"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',3,'الترام في الإسكندرية الناس بتقول عليه إيه؟','What do people in Alexandria call the tram?',20000,
 '[{"index":0,"text_ar":"الترماي","text_en":"El-tormay"},{"index":1,"text_ar":"الصاروخ","text_en":"The rocket"},{"index":2,"text_ar":"المترو الطائر","text_en":"The flying metro"},{"index":3,"text_ar":"الأتوبيس اللي على قضبان","text_en":"The bus that got railings"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',4,'عربية الأجرة القديمة في القاهرة كان لونها إيه؟','What colour were the old Cairo taxis?',20000,
 '[{"index":0,"text_ar":"أبيض وأسود","text_en":"Black and white"},{"index":1,"text_ar":"أحمر ومنقّط","text_en":"Red with spots"},{"index":2,"text_ar":"شفاف","text_en":"Transparent"},{"index":3,"text_ar":"كل واحدة على مزاجها","text_en":"Whatever the driver felt like"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',5,'المترو فيه عربية مخصصة لمين؟','The metro has carriages reserved for whom?',20000,
 '[{"index":0,"text_ar":"السيدات","text_en":"Women"},{"index":1,"text_ar":"اللي معاهم فكة","text_en":"People with exact change"},{"index":2,"text_ar":"اللي صاحيين بدري","text_en":"People who woke up early"},{"index":3,"text_ar":"القطط","text_en":"Cats"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',6,'كوبري قصر النيل عليه تماثيل إيه؟','What statues sit on Qasr El-Nil Bridge?',20000,
 '[{"index":0,"text_ar":"أسود","text_en":"Lions"},{"index":1,"text_ar":"بطاريق","text_en":"Penguins"},{"index":2,"text_ar":"سواقين ميكروباص","text_en":"Microbus drivers"},{"index":3,"text_ar":"مفيش، دي شائعة","text_en":"None. That is a rumour"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',7,'«العدّاد» في التاكسي بيقيس إيه؟','What does a taxi meter measure?',20000,
 '[{"index":0,"text_ar":"المسافة والوقت","text_en":"Distance and time"},{"index":1,"text_ar":"مزاج السواق","text_en":"The driver’s mood"},{"index":2,"text_ar":"صوت الراديو","text_en":"The volume of the radio"},{"index":3,"text_ar":"مفيش، ده للزينة","text_en":"Nothing. It is decorative"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',8,'الطريق الدائري بيلف حوالين إيه؟','What does the Ring Road go around?',20000,
 '[{"index":0,"text_ar":"القاهرة الكبرى","text_en":"Greater Cairo"},{"index":1,"text_ar":"نفسه","text_en":"Itself"},{"index":2,"text_ar":"برج القاهرة بس","text_en":"Just the Cairo Tower"},{"index":3,"text_ar":"محدش يعرف، مفيش حد وصل لآخره","text_en":"Nobody knows. No one has reached the end"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',9,'«اركب يا بلدنا» بيقولها مين؟','Who shouts "erkab ya baladna"?',20000,
 '[{"index":0,"text_ar":"الكمسري أو السواق عشان يجمّع ركاب","text_en":"The conductor or driver, rounding up passengers"},{"index":1,"text_ar":"الراكب لما يفرح","text_en":"A passenger who is happy"},{"index":2,"text_ar":"العدّاد","text_en":"The meter"},{"index":3,"text_ar":"الإشارة الحمرا","text_en":"The red light"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',10,'قناة السويس بتوصل بين أنهي بحرين؟','The Suez Canal connects which two seas?',20000,
 '[{"index":0,"text_ar":"المتوسط والأحمر","text_en":"The Mediterranean and the Red Sea"},{"index":1,"text_ar":"الأحمر والكاريبي","text_en":"The Red Sea and the Caribbean"},{"index":2,"text_ar":"بحر الزحمة وبحر الزحمة","text_en":"The sea of traffic and the sea of traffic"},{"index":3,"text_ar":"مفيش، دي بحيرة طويلة","text_en":"Neither. It is a long lake"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000001',11,'قد إيه بياخد الميكروباص عشان يتحرك؟','How long does a microbus wait before it moves?',20000,
 '[{"index":0,"text_ar":"لحد ما يملا","text_en":"Until it is full"},{"index":1,"text_ar":"دقيقتين بالظبط","text_en":"Exactly two minutes"},{"index":2,"text_ar":"لما السواق يخلص الشاي","text_en":"Until the driver finishes his tea"},{"index":3,"text_ar":"لما ربنا يسهّل","text_en":"Whenever it works out"}]',0,'double');

-- ── البيت المصري ───────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('dddd4444-0000-4000-8000-000000000002',0,'علبة البسكوت المعدنية اللي في البيت جوّاها إيه؟','What is inside the metal biscuit tin at home?',20000,
 '[{"index":0,"text_ar":"خيط وإبر","text_en":"Thread and needles"},{"index":1,"text_ar":"بسكوت","text_en":"Biscuits"},{"index":2,"text_ar":"علبة بسكوت أصغر","text_en":"A smaller biscuit tin"},{"index":3,"text_ar":"محدش فتحها من ٢٠٠٤","text_en":"Nobody has opened it since 2004"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',1,'الفوط الحلوة في الدولاب بتتستعمل إمتى؟','When do the nice towels come out of the cupboard?',20000,
 '[{"index":0,"text_ar":"لما ييجي ضيوف","text_en":"When guests come"},{"index":1,"text_ar":"كل يوم عادي","text_en":"Every ordinary day"},{"index":2,"text_ar":"في الأعياد بس","text_en":"Only on holidays"},{"index":3,"text_ar":"أبدًا، دي للعرض","text_en":"Never. They are for display"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',2,'الشنطة البلاستيك اللي في المطبخ جوّاها إيه؟','What is in the plastic bag in the kitchen?',20000,
 '[{"index":0,"text_ar":"شنط بلاستيك تانية","text_en":"More plastic bags"},{"index":1,"text_ar":"فلوس","text_en":"Money"},{"index":2,"text_ar":"الريموت","text_en":"The remote"},{"index":3,"text_ar":"خريطة كنز","text_en":"A treasure map"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',3,'«الصالون» في البيت المصري بيتقعد فيه إمتى؟','When does anyone sit in the formal living room?',20000,
 '[{"index":0,"text_ar":"لما ييجي ضيوف مهمين","text_en":"When important guests come"},{"index":1,"text_ar":"كل يوم","text_en":"Every day"},{"index":2,"text_ar":"الصبح بس","text_en":"Only in the morning"},{"index":3,"text_ar":"ممنوع دخوله نهائي","text_en":"Entry is strictly forbidden"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',4,'الشاي المصري بيتقدّم إزاي غالبًا؟','How is Egyptian tea usually served?',20000,
 '[{"index":0,"text_ar":"في كوباية صغيرة وسكر","text_en":"In a small glass, with sugar"},{"index":1,"text_ar":"بارد في زجاجة","text_en":"Cold, in a bottle"},{"index":2,"text_ar":"في طبق","text_en":"On a plate"},{"index":3,"text_ar":"مع شوكة","text_en":"With a fork"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',5,'الكنبة اللي عليها «الكوفرتة» بتتغطي ليه؟','Why is the sofa kept under a cover?',20000,
 '[{"index":0,"text_ar":"عشان تفضل نضيفة","text_en":"To keep it clean"},{"index":1,"text_ar":"عشان تنام","text_en":"So it can sleep"},{"index":2,"text_ar":"عشان محدش يشوف لونها","text_en":"So nobody learns its colour"},{"index":3,"text_ar":"دي مش كنبة أصلاً","text_en":"It is not a sofa at all"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',6,'«الشبشب» بيتستعمل في إيه؟','What are slippers used for?',20000,
 '[{"index":0,"text_ar":"المشي في البيت","text_en":"Walking around the house"},{"index":1,"text_ar":"الرياضة","text_en":"Sport"},{"index":2,"text_ar":"الزينة","text_en":"Decoration"},{"index":3,"text_ar":"محدش يعرف","text_en":"Nobody knows"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',7,'الملوخية بتتاكل مع إيه غالبًا؟','What is molokhia usually eaten with?',20000,
 '[{"index":0,"text_ar":"رز وفراخ","text_en":"Rice and chicken"},{"index":1,"text_ar":"آيس كريم","text_en":"Ice cream"},{"index":2,"text_ar":"كورن فليكس","text_en":"Cornflakes"},{"index":3,"text_ar":"لوحدها بالشوكة","text_en":"On its own, with a fork"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',8,'لما الكهربا تقطع، أول حاجة بتحصل إيه؟','When the power cuts, what happens first?',20000,
 '[{"index":0,"text_ar":"الكل يقول «آآه» في نفس اللحظة","text_en":"Everyone says “aah” at the same instant"},{"index":1,"text_ar":"سكوت تام","text_en":"Total silence"},{"index":2,"text_ar":"الكل ينام","text_en":"Everyone goes to sleep"},{"index":3,"text_ar":"محدش يلاحظ","text_en":"Nobody notices"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',9,'«العيش» في مصر معناه إيه بالظبط؟','What does "eish" mean in Egypt?',20000,
 '[{"index":0,"text_ar":"الخبز — وكمان الحياة","text_en":"Bread — and also life"},{"index":1,"text_ar":"الميّة","text_en":"Water"},{"index":2,"text_ar":"الشباك","text_en":"A window"},{"index":3,"text_ar":"نوع عربية","text_en":"A kind of car"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',10,'البقّال بيكتب الحساب فين؟','Where does the corner shop keep your tab?',20000,
 '[{"index":0,"text_ar":"في كشكول","text_en":"In a notebook"},{"index":1,"text_ar":"في تطبيق","text_en":"In an app"},{"index":2,"text_ar":"على الحيطة","text_en":"On the wall"},{"index":3,"text_ar":"في دماغه بس","text_en":"Purely from memory"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000002',11,'«تعالى اتغدى معانا» معناها إيه؟','What does "come and have lunch with us" mean?',20000,
 '[{"index":0,"text_ar":"دعوة حقيقية، وهتاكل","text_en":"A real invitation, and you will be fed"},{"index":1,"text_ar":"مجاملة بس","text_en":"Politeness, nothing more"},{"index":2,"text_ar":"تحية زي صباح الخير","text_en":"A greeting, like good morning"},{"index":3,"text_ar":"معناها امشي","text_en":"It means please leave"}]',0,'double');

-- ── رمضان في مصر ───────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('dddd4444-0000-4000-8000-000000000003',0,'المسحراتي بيصحّي الناس عشان إيه؟','Why does the mesaharaty wake people up?',20000,
 '[{"index":0,"text_ar":"السحور","text_en":"For suhoor"},{"index":1,"text_ar":"عشان يسلّم عليهم","text_en":"To say hello"},{"index":2,"text_ar":"عشان محدش يفوّت الشغل","text_en":"So nobody is late for work"},{"index":3,"text_ar":"مالوش سبب","text_en":"No reason at all"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',1,'مدفع الإفطار بيضرب إمتى؟','When does the iftar cannon fire?',20000,
 '[{"index":0,"text_ar":"عند المغرب","text_en":"At sunset"},{"index":1,"text_ar":"الساعة ٣ الفجر","text_en":"At 3 in the morning"},{"index":2,"text_ar":"لما الأكل يخلص","text_en":"When the food runs out"},{"index":3,"text_ar":"كل ساعة","text_en":"Every hour"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',2,'القطايف بتتحشى بإيه غالبًا؟','What is qatayef usually filled with?',20000,
 '[{"index":0,"text_ar":"مكسرات أو قشطة","text_en":"Nuts or cream"},{"index":1,"text_ar":"مكرونة","text_en":"Pasta"},{"index":2,"text_ar":"شوربة","text_en":"Soup"},{"index":3,"text_ar":"قطايف أصغر","text_en":"Smaller qatayef"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',3,'مائدة الرحمن إيه؟','What is a maidet rahman?',20000,
 '[{"index":0,"text_ar":"إفطار مجاني للناس في الشارع","text_en":"A free street iftar for anyone"},{"index":1,"text_ar":"مطعم غالي","text_en":"An expensive restaurant"},{"index":2,"text_ar":"نوع حلويات","text_en":"A kind of dessert"},{"index":3,"text_ar":"برنامج تليفزيوني","text_en":"A television show"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',4,'الفانوس بيتعلق فين؟','Where does the fanous get hung?',20000,
 '[{"index":0,"text_ar":"في البلكونة والشارع","text_en":"On balconies and in the street"},{"index":1,"text_ar":"في التلاجة","text_en":"In the fridge"},{"index":2,"text_ar":"تحت السرير","text_en":"Under the bed"},{"index":3,"text_ar":"في الشنطة","text_en":"In a bag"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',5,'ياميش رمضان فيه إيه؟','What is in yamish Ramadan?',20000,
 '[{"index":0,"text_ar":"تمر ومكسرات وقمر الدين","text_en":"Dates, nuts and apricot sheets"},{"index":1,"text_ar":"جبنة رومي بس","text_en":"Only Roumi cheese"},{"index":2,"text_ar":"شيبسي","text_en":"Crisps"},{"index":3,"text_ar":"بطاطس محمرة","text_en":"Fried potatoes"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',6,'الزحمة في الشارع بتوصل لأقصاها إمتى؟','When does the traffic peak?',20000,
 '[{"index":0,"text_ar":"قبل المغرب بشوية","text_en":"Just before sunset"},{"index":1,"text_ar":"الفجر","text_en":"At dawn"},{"index":2,"text_ar":"وقت الإفطار بالظبط","text_en":"Exactly at iftar time"},{"index":3,"text_ar":"مفيش زحمة في رمضان","text_en":"There is no traffic in Ramadan"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',7,'الكنافة بتتعمل من إيه؟','What is konafa made from?',20000,
 '[{"index":0,"text_ar":"عجينة رفيعة زي الشعر","text_en":"Fine, hair-like pastry"},{"index":1,"text_ar":"رز","text_en":"Rice"},{"index":2,"text_ar":"خيط حقيقي","text_en":"Actual thread"},{"index":3,"text_ar":"مكرونة اسباجتي","text_en":"Spaghetti"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',8,'«وحوي يا وحوي» دي إيه؟','What is "wahawi ya wahawi"?',20000,
 '[{"index":0,"text_ar":"أغنية رمضان قديمة للأطفال","text_en":"An old Ramadan children’s song"},{"index":1,"text_ar":"نوع أكل","text_en":"A kind of food"},{"index":2,"text_ar":"اسم شارع","text_en":"A street name"},{"index":3,"text_ar":"تحية بين السواقين","text_en":"A greeting between drivers"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',9,'الخشاف معمول من إيه؟','What is khoshaf made of?',20000,
 '[{"index":0,"text_ar":"فواكه مجففة منقوعة","text_en":"Soaked dried fruit"},{"index":1,"text_ar":"لبن وشيكولاتة","text_en":"Milk and chocolate"},{"index":2,"text_ar":"شوربة عدس","text_en":"Lentil soup"},{"index":3,"text_ar":"ميّة وسكر بس","text_en":"Just water and sugar"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',10,'المسلسلات بتتعرض بكثافة إمتى؟','When are all the TV series shown?',20000,
 '[{"index":0,"text_ar":"في رمضان","text_en":"In Ramadan"},{"index":1,"text_ar":"في الصيف","text_en":"In the summer"},{"index":2,"text_ar":"يوم الجمعة بس","text_en":"Only on Fridays"},{"index":3,"text_ar":"مرة كل سنتين","text_en":"Once every two years"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000003',11,'بعد الإفطار مباشرة بيحصل إيه في أغلب البيوت؟','Right after iftar, what happens in most homes?',20000,
 '[{"index":0,"text_ar":"شاي وحلويات وقعدة","text_en":"Tea, sweets and sitting around"},{"index":1,"text_ar":"الجري في الشارع","text_en":"Running laps outside"},{"index":2,"text_ar":"امتحان مفاجئ","text_en":"A surprise exam"},{"index":3,"text_ar":"إفطار تاني","text_en":"A second iftar"}]',0,'double');

-- ── أيام المدرسة ───────────────────────────────────────────────────
insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('dddd4444-0000-4000-8000-000000000004',0,'طابور الصباح بيبدأ بإيه؟','How does the morning line-up start?',20000,
 '[{"index":0,"text_ar":"السلام الوطني","text_en":"The national anthem"},{"index":1,"text_ar":"أغنية مهرجانات","text_en":"A mahraganat track"},{"index":2,"text_ar":"امتحان","text_en":"An exam"},{"index":3,"text_ar":"مفيش، الكل بيدخل على طول","text_en":"It does not. Everyone just walks in"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',1,'الكانتين بيبيع إيه أكتر حاجة؟','What does the school canteen sell most of?',20000,
 '[{"index":0,"text_ar":"شيبسي وسندوتشات","text_en":"Crisps and sandwiches"},{"index":1,"text_ar":"كتب","text_en":"Books"},{"index":2,"text_ar":"تذاكر طيران","text_en":"Plane tickets"},{"index":3,"text_ar":"نصايح","text_en":"Advice"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',2,'«الحصة الأخيرة» مشهورة بإيه؟','What is the last period famous for?',20000,
 '[{"index":0,"text_ar":"إن محدش مركّز فيها","text_en":"Nobody concentrating in it"},{"index":1,"text_ar":"إنها أطول حصة","text_en":"Being the longest period"},{"index":2,"text_ar":"إنها بالإنجليزي دايمًا","text_en":"Always being in English"},{"index":3,"text_ar":"إنها اختيارية","text_en":"Being optional"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',3,'الكشكول بيتستعمل في إيه؟','What is a kashkool used for?',20000,
 '[{"index":0,"text_ar":"الكتابة","text_en":"Writing"},{"index":1,"text_ar":"المروحة","text_en":"Fanning yourself"},{"index":2,"text_ar":"الأكل","text_en":"Eating"},{"index":3,"text_ar":"القعدة عليه","text_en":"Sitting on it"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',4,'المسطرة بتتستعمل في إيه أكتر حاجة جوّا الفصل؟','What does a ruler mostly get used for in class?',20000,
 '[{"index":0,"text_ar":"رسم خطوط","text_en":"Drawing straight lines"},{"index":1,"text_ar":"قياس الفصل","text_en":"Measuring the classroom"},{"index":2,"text_ar":"الطبخ","text_en":"Cooking"},{"index":3,"text_ar":"محدش استعملها ولا مرة","text_en":"Nobody has ever used one"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',5,'الثانوية العامة بتيجي في أنهي سنة؟','Which year is the Thanaweya Amma?',20000,
 '[{"index":0,"text_ar":"آخر سنة في الثانوي","text_en":"The final year of secondary school"},{"index":1,"text_ar":"أول سنة ابتدائي","text_en":"The first year of primary"},{"index":2,"text_ar":"بعد الجامعة","text_en":"After university"},{"index":3,"text_ar":"كل سنة","text_en":"Every single year"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',6,'«الحضور والغياب» بيتعمل إمتى؟','When is the register taken?',20000,
 '[{"index":0,"text_ar":"أول الحصة","text_en":"At the start of the lesson"},{"index":1,"text_ar":"بعد ما الكل يمشي","text_en":"After everyone has left"},{"index":2,"text_ar":"مرة في السنة","text_en":"Once a year"},{"index":3,"text_ar":"في البيت","text_en":"At home"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',7,'الفسحة بتتستعمل في إيه؟','What is break time for?',20000,
 '[{"index":0,"text_ar":"الأكل واللعب","text_en":"Eating and playing"},{"index":1,"text_ar":"حصة زيادة","text_en":"An extra lesson"},{"index":2,"text_ar":"النوم في الفصل","text_en":"Sleeping in class"},{"index":3,"text_ar":"مفيش فسحة","text_en":"There is no break"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',8,'«الشنطة» يوم الأحد بتبقى إزاي؟','How heavy is the bag on Sunday?',20000,
 '[{"index":0,"text_ar":"أتقل يوم في الأسبوع","text_en":"The heaviest day of the week"},{"index":1,"text_ar":"فاضية","text_en":"Empty"},{"index":2,"text_ar":"بتطير","text_en":"It floats"},{"index":3,"text_ar":"زي أي يوم","text_en":"Same as any other day"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',9,'الكتاب المدرسي بيتغلّف بإيه؟','What do you cover a schoolbook with?',20000,
 '[{"index":0,"text_ar":"ورق لاصق أو ورق بني","text_en":"Sticky film or brown paper"},{"index":1,"text_ar":"قماش","text_en":"Cloth"},{"index":2,"text_ar":"ألومنيوم","text_en":"Foil"},{"index":3,"text_ar":"محدش بيغلّف","text_en":"Nobody covers them"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',10,'أجازة نص السنة بتيجي إمتى؟','When is the mid-year holiday?',20000,
 '[{"index":0,"text_ar":"في الشتا","text_en":"In winter"},{"index":1,"text_ar":"في أغسطس","text_en":"In August"},{"index":2,"text_ar":"في رمضان دايمًا","text_en":"Always in Ramadan"},{"index":3,"text_ar":"مفيش أجازة نص سنة","text_en":"There is no mid-year holiday"}]',0,'standard'),
('dddd4444-0000-4000-8000-000000000004',11,'«الجرس» لما يرن آخر اليوم بيحصل إيه؟','What happens when the final bell rings?',20000,
 '[{"index":0,"text_ar":"الكل يقوم في نفس اللحظة","text_en":"Everyone stands up at the same instant"},{"index":1,"text_ar":"محدش يتحرك","text_en":"Nobody moves"},{"index":2,"text_ar":"تبدأ حصة جديدة","text_en":"A new lesson begins"},{"index":3,"text_ar":"الجرس بيرن تاني","text_en":"The bell rings again"}]',0,'double');

notify pgrst, 'reload schema';
