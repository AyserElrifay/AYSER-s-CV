-- ═══════════════════════════════════════════════════════════════════
--  عقول خضرا · GREEN MINDS — the questions
--
--  Ayser: "awesrness about pollution and respecting our differnses
--  and cultures thoughts beleives."
--
--  The green corner already lets somebody start a clean-up and put
--  their name to it. This is the other half he asked for: the part
--  that teaches, without a lecture and without frightening anybody.
--
--  ── HOW THESE ARE WRITTEN ────────────────────────────────────────
--  Every number here is one that is widely published and easy to
--  check — the cigarette end being the most collected item on a
--  beach, the twelve minutes a plastic bag is carried, the ~95% of
--  the energy saved by recycling a can, the third of crops that
--  depend on pollinators. Nothing is invented to sound worse than it
--  is, and no wrong answer is a joke at anybody's expense.
--
--  A third of them are not about rubbish at all. They are about
--  people: what Erasmus is, what the rule is in a reflection circle,
--  what you do when somebody says something you disagree with. Those
--  are the ones Ayser actually asked for, and they are the reason
--  this pack is not just a recycling quiz.
--
--  Sixteen are written; a room draws fifteen. The spare one is why
--  two rounds are not the same round.
--
--  ── AND WHAT IT REFUSES TO DO ────────────────────────────────────
--  It does not tell anybody their country is the problem. Six
--  countries are in the green corner and none of them is the villain
--  of a question here. Pollution is the subject; a nationality never
--  is.
--
--  Written in the five play languages, with the line that teaches
--  underneath each answer, so getting it wrong is still worth
--  something.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions where pack_id = 'ffff6666-0000-4000-8000-000000000001';
delete from public.game_packs where id = 'ffff6666-0000-4000-8000-000000000001';

-- country is null on purpose: this one belongs to nobody's country.
-- The green corner spans six of them, and a pack tagged EG would sort
-- to the bottom of the shelf for everybody outside Egypt — which is
-- exactly the wrong half of the world for these questions.
insert into public.game_packs (id, title_ar, title_en, description_ar, description_en,
                               category, country, is_official, visibility) values
 ('ffff6666-0000-4000-8000-000000000001','عقول خضرا','Green Minds',
  'التلوث والطبيعة واحترام اختلافنا — ١٥ سؤال كل جولة',
  'Pollution, nature and respecting our differences — 15 a round.',
  'fun', null, true, 'public');

-- The flags on the pack card. Said in its own statement, exactly the
-- way every other pack says it, because that is the one line the
-- build reads to check the claim is true.
update public.game_packs
   set languages = array['ar','en','fr','es','ro']
 where id = 'ffff6666-0000-4000-8000-000000000001';

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('ffff6666-0000-4000-8000-000000000001',0,'أكتر حاجة بتتجمع في تنضيف الشواطئ حول العالم إيه؟','What is the most collected item in beach clean-ups worldwide?',20000,
 '[{"index":0,"text_ar":"أعقاب السجاير","text_en":"Cigarette ends"},{"index":1,"text_ar":"إطارات عربيات","text_en":"Car tyres"},{"index":2,"text_ar":"موبايلات","text_en":"Mobile phones"},{"index":3,"text_ar":"شمسيات","text_en":"Umbrellas"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',1,'كيس البلاستيك بيتستخدم في المتوسط قد إيه قبل ما يترمي؟','How long is a plastic bag used, on average, before it is thrown away?',20000,
 '[{"index":0,"text_ar":"حوالي ١٢ دقيقة","text_en":"About 12 minutes"},{"index":1,"text_ar":"حوالي أسبوع","text_en":"About a week"},{"index":2,"text_ar":"حوالي سنة","text_en":"About a year"},{"index":3,"text_ar":"حوالي عشر سنين","text_en":"About ten years"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',2,'إعادة تدوير علبة ألومنيوم واحدة بتوفر قد إيه من الطاقة؟','Recycling one aluminium can saves roughly how much energy?',20000,
 '[{"index":0,"text_ar":"حوالي ٩٥٪","text_en":"About 95%"},{"index":1,"text_ar":"حوالي ١٠٪","text_en":"About 10%"},{"index":2,"text_ar":"مفيش فرق","text_en":"None at all"},{"index":3,"text_ar":"بتستهلك أكتر","text_en":"It uses more"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',3,'أغلب البلاستيك اللي بيوصل البحر بيجي منين؟','Most of the plastic that reaches the sea arrives how?',20000,
 '[{"index":0,"text_ar":"من الأنهار","text_en":"Down rivers"},{"index":1,"text_ar":"من السفن","text_en":"From ships"},{"index":2,"text_ar":"من المطر","text_en":"With the rain"},{"index":3,"text_ar":"من الطيارات","text_en":"From aeroplanes"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',4,'الأشجار في الشارع بتقلل حرارته بحوالي كام؟','Trees along a street cool it by roughly how much?',20000,
 '[{"index":0,"text_ar":"من ٢ لـ ٨ درجات","text_en":"Between 2 and 8 degrees"},{"index":1,"text_ar":"مفيش فرق","text_en":"Not at all"},{"index":2,"text_ar":"بيسخنوه","text_en":"They warm it up"},{"index":3,"text_ar":"نص درجة","text_en":"Half a degree"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',5,'«إيراسموس» في أوروبا اسم لإيه؟','In Europe, what is “Erasmus”?',20000,
 '[{"index":0,"text_ar":"برنامج بيبعت طلاب وشباب يعيشوا ويتعلموا في بلد تانية","text_en":"A programme that sends students and young people to live and learn in another country"},{"index":1,"text_ar":"نوع من القطارات","text_en":"A kind of train"},{"index":2,"text_ar":"جايزة رياضية","text_en":"A sports prize"},{"index":3,"text_ar":"بنك","text_en":"A bank"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',6,'في «دايرة الاختلاف»، القاعدة الأساسية إيه؟','In a differences circle, what is the basic rule?',20000,
 '[{"index":0,"text_ar":"واحد يتكلم والباقي يسمعوا، من غير جدال","text_en":"One person speaks, the rest listen, and nobody argues"},{"index":1,"text_ar":"اللي يقنع الباقيين يكسب","text_en":"Whoever convinces the others wins"},{"index":2,"text_ar":"ممنوع الكلام عن الثقافة","text_en":"Culture may not be mentioned"},{"index":3,"text_ar":"لازم توافق على كل حاجة","text_en":"You must agree on everything"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',7,'الأكل اللي بيترمي في الزبالة بينتج غاز إيه؟','Food thrown into landfill produces which gas?',20000,
 '[{"index":0,"text_ar":"الميثان","text_en":"Methane"},{"index":1,"text_ar":"الأكسجين","text_en":"Oxygen"},{"index":2,"text_ar":"الهيليوم","text_en":"Helium"},{"index":3,"text_ar":"مفيش","text_en":"None"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',8,'لبس «الموضة السريعة» بيتلبس في المتوسط كام مرة قبل ما يترمي؟','A fast-fashion garment is worn how many times, on average, before being discarded?',20000,
 '[{"index":0,"text_ar":"أقل من عشر مرات","text_en":"Fewer than ten times"},{"index":1,"text_ar":"أكتر من مية مرة","text_en":"More than a hundred times"},{"index":2,"text_ar":"مرة واحدة بالظبط","text_en":"Exactly once"},{"index":3,"text_ar":"كل يوم لمدة سنة","text_en":"Every day for a year"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',9,'التلوث الضوئي بيأثر على مين بشكل مباشر؟','Light pollution most directly affects what?',20000,
 '[{"index":0,"text_ar":"الطيور المهاجرة وصغار السلاحف","text_en":"Migrating birds and baby turtles"},{"index":1,"text_ar":"الصخور","text_en":"Rocks"},{"index":2,"text_ar":"الرمل","text_en":"Sand"},{"index":3,"text_ar":"محدش","text_en":"Nothing at all"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',10,'النحل والحشرات الملقّحة مسؤولين عن حوالي كام من محاصيل الأكل؟','Bees and other pollinators are behind roughly how much of our food crops?',20000,
 '[{"index":0,"text_ar":"حوالي التلت","text_en":"About a third"},{"index":1,"text_ar":"أقل من ١٪","text_en":"Less than 1%"},{"index":2,"text_ar":"كلها","text_en":"All of it"},{"index":3,"text_ar":"ولا حاجة","text_en":"None of it"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',11,'أنهي واحدة فيهم بتتحلل أسرع؟','Which of these breaks down fastest?',20000,
 '[{"index":0,"text_ar":"قشرة موزة","text_en":"A banana skin"},{"index":1,"text_ar":"لبانة","text_en":"Chewing gum"},{"index":2,"text_ar":"كيس بلاستيك","text_en":"A plastic bag"},{"index":3,"text_ar":"علبة زجاج","text_en":"A glass bottle"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',12,'«يوم تنضيف العالم» بيحصل إمتى؟','When does World Cleanup Day happen?',20000,
 '[{"index":0,"text_ar":"كل سنة في سبتمبر","text_en":"Every year, in September"},{"index":1,"text_ar":"مرة كل عشر سنين","text_en":"Once every ten years"},{"index":2,"text_ar":"في يناير","text_en":"In January"},{"index":3,"text_ar":"مش موجود","text_en":"It does not exist"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',13,'لو محدش معاه جوانتيات في تنضيف، أحسن تصرف إيه؟','If nobody has gloves at a clean-up, what is the sensible thing to do?',20000,
 '[{"index":0,"text_ar":"اجمعوا اللي مش خطر بس، وسيبوا الزجاج والإبر للمختصين","text_en":"Pick up only what is safe and leave glass and needles to the professionals"},{"index":1,"text_ar":"اجمعوا كل حاجة بإيديكم","text_en":"Pick everything up bare-handed"},{"index":2,"text_ar":"الغوا اليوم كله","text_en":"Cancel the whole day"},{"index":3,"text_ar":"استنوا حد يجيب معدات","text_en":"Wait for somebody to bring equipment"}]',0,'standard'),
('ffff6666-0000-4000-8000-000000000001',14,'أحسن حاجة تعملها بصور «قبل وبعد» التنضيف؟','What is the best thing to do with before-and-after photographs of a clean-up?',20000,
 '[{"index":0,"text_ar":"تعرضها عشان حد تاني يبدأ واحدة","text_en":"Show them, so somebody else starts one"},{"index":1,"text_ar":"تمسحها","text_en":"Delete them"},{"index":2,"text_ar":"تسيبها في التليفون","text_en":"Leave them on your phone"},{"index":3,"text_ar":"تطبعها بس","text_en":"Only print them"}]',0,'double'),
('ffff6666-0000-4000-8000-000000000001',15,'لو حد في الدايرة قال حاجة إنت مش موافق عليها، إيه أول حاجة تعملها؟','Somebody in the circle says something you disagree with. What comes first?',20000,
 '[{"index":0,"text_ar":"تسمع لآخر الكلام قبل ما ترد","text_en":"Hear the whole thing before answering"},{"index":1,"text_ar":"تقاطعه","text_en":"Interrupt"},{"index":2,"text_ar":"تمشي","text_en":"Walk out"},{"index":3,"text_ar":"تصوّره","text_en":"Film them"}]',0,'standard');

update public.questions set
  text_i18n = '{"fr":"Quel est l’objet le plus ramassé lors des nettoyages de plages ?","es":"¿Cuál es el objeto más recogido en las limpiezas de playas?","ro":"Care e obiectul cel mai des adunat la curățeniile de pe plaje?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أعقاب السجاير","text_en":"Cigarette ends","text_i18n":{"fr":"Les mégots","es":"Las colillas","ro":"Mucurile de țigară"}},{"index":1,"text_ar":"إطارات عربيات","text_en":"Car tyres","text_i18n":{"fr":"Des pneus","es":"Neumáticos","ro":"Anvelope"}},{"index":2,"text_ar":"موبايلات","text_en":"Mobile phones","text_i18n":{"fr":"Des téléphones","es":"Móviles","ro":"Telefoane"}},{"index":3,"text_ar":"شمسيات","text_en":"Umbrellas","text_i18n":{"fr":"Des parapluies","es":"Paraguas","ro":"Umbrele"}}]'::jsonb,
  note_ar   = 'عقب السجارة فيه بلاستيك، وبيفضل في البيئة سنين — وده أكتر شيء بيتجمع في العالم.',
  note_en   = 'A cigarette filter is plastic, and it is the single most collected item on earth.',
  note_i18n = '{"fr":"Un filtre de cigarette est en plastique, et c’est l’objet le plus ramassé au monde.","es":"El filtro de un cigarrillo es plástico, y es el objeto más recogido del mundo.","ro":"Filtrul de țigară e din plastic și e cel mai adunat obiect din lume."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 0;

update public.questions set
  text_i18n = '{"fr":"Combien de temps un sac plastique sert-il en moyenne avant d’être jeté ?","es":"¿Cuánto se usa una bolsa de plástico de media antes de tirarla?","ro":"Cât se folosește o pungă de plastic, în medie, până e aruncată?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حوالي ١٢ دقيقة","text_en":"About 12 minutes","text_i18n":{"fr":"Environ 12 minutes","es":"Unos 12 minutos","ro":"Cam 12 minute"}},{"index":1,"text_ar":"حوالي أسبوع","text_en":"About a week","text_i18n":{"fr":"Environ une semaine","es":"Una semana","ro":"Cam o săptămână"}},{"index":2,"text_ar":"حوالي سنة","text_en":"About a year","text_i18n":{"fr":"Environ un an","es":"Un año","ro":"Cam un an"}},{"index":3,"text_ar":"حوالي عشر سنين","text_en":"About ten years","text_i18n":{"fr":"Environ dix ans","es":"Unos diez años","ro":"Cam zece ani"}}]'::jsonb,
  note_ar   = 'دقايق استخدام، وقرون في الطبيعة — الفرق ده هو كل الحكاية.',
  note_en   = 'Minutes of use, centuries in the environment — that gap is the whole story.',
  note_i18n = '{"fr":"Quelques minutes d’usage, des siècles dans la nature : tout est là.","es":"Minutos de uso, siglos en la naturaleza: ahí está todo.","ro":"Minute de folosire, secole în natură — asta e toată povestea."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 1;

update public.questions set
  text_i18n = '{"fr":"Recycler une canette en aluminium économise à peu près combien d’énergie ?","es":"Reciclar una lata de aluminio ahorra aproximadamente cuánta energía?","ro":"Reciclarea unei doze de aluminiu economisește cam câtă energie?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حوالي ٩٥٪","text_en":"About 95%","text_i18n":{"fr":"Environ 95 %","es":"Cerca del 95%","ro":"Cam 95%"}},{"index":1,"text_ar":"حوالي ١٠٪","text_en":"About 10%","text_i18n":{"fr":"Environ 10 %","es":"Cerca del 10%","ro":"Cam 10%"}},{"index":2,"text_ar":"مفيش فرق","text_en":"None at all","text_i18n":{"fr":"Aucune","es":"Ninguna","ro":"Deloc"}},{"index":3,"text_ar":"بتستهلك أكتر","text_en":"It uses more","text_i18n":{"fr":"Elle en consomme plus","es":"Consume más","ro":"Consumă mai mult"}}]'::jsonb,
  note_ar   = 'علبة واحدة بتوفر طاقة تشغّل تلفزيون ساعات — وده أسهل تدوير في الدنيا.',
  note_en   = 'One can saves enough energy to run a television for hours — the easiest win there is.',
  note_i18n = '{"fr":"Une canette économise de quoi faire tourner une télé des heures : le gain le plus facile qui soit.","es":"Una lata ahorra energía para tener la tele horas: la victoria más fácil que hay.","ro":"O doză economisește energie cât pentru ore de televizor — cel mai ușor câștig."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 2;

update public.questions set
  text_i18n = '{"fr":"La plupart du plastique qui atteint la mer arrive comment ?","es":"¿Cómo llega al mar la mayoría del plástico?","ro":"Cum ajunge în mare cea mai mare parte a plasticului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"من الأنهار","text_en":"Down rivers","text_i18n":{"fr":"Par les fleuves","es":"Por los ríos","ro":"Pe râuri"}},{"index":1,"text_ar":"من السفن","text_en":"From ships","text_i18n":{"fr":"Des navires","es":"De los barcos","ro":"De pe nave"}},{"index":2,"text_ar":"من المطر","text_en":"With the rain","text_i18n":{"fr":"Avec la pluie","es":"Con la lluvia","ro":"Cu ploaia"}},{"index":3,"text_ar":"من الطيارات","text_en":"From aeroplanes","text_i18n":{"fr":"Des avions","es":"De los aviones","ro":"Din avioane"}}]'::jsonb,
  note_ar   = 'اللي بيترمي في الشارع بيروح للنهر، والنهر بيوديه البحر — والنيل والدانوب من ضمنهم.',
  note_en   = 'What is dropped in a street reaches a river, and the river carries it to the sea.',
  note_i18n = '{"fr":"Ce qui traîne dans une rue rejoint un fleuve, et le fleuve l’emmène à la mer.","es":"Lo que se tira en la calle llega a un río, y el río lo lleva al mar.","ro":"Ce se aruncă pe stradă ajunge într-un râu, iar râul îl duce în mare."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 3;

update public.questions set
  text_i18n = '{"fr":"Les arbres d’une rue la rafraîchissent d’environ combien ?","es":"Los árboles de una calle la refrescan aproximadamente cuánto?","ro":"Copacii de pe o stradă o răcoresc cu aproximativ cât?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"من ٢ لـ ٨ درجات","text_en":"Between 2 and 8 degrees","text_i18n":{"fr":"De 2 à 8 degrés","es":"Entre 2 y 8 grados","ro":"Cu 2 până la 8 grade"}},{"index":1,"text_ar":"مفيش فرق","text_en":"Not at all","text_i18n":{"fr":"Pas du tout","es":"Nada","ro":"Deloc"}},{"index":2,"text_ar":"بيسخنوه","text_en":"They warm it up","text_i18n":{"fr":"Ils la réchauffent","es":"La calientan","ro":"O încălzesc"}},{"index":3,"text_ar":"نص درجة","text_en":"Half a degree","text_i18n":{"fr":"Un demi-degré","es":"Medio grado","ro":"O jumătate de grad"}}]'::jsonb,
  note_ar   = 'الظل والتبخر بيعملوا الفرق — عشان كده الشارع المشجّر بيبان أبرد فعلاً.',
  note_en   = 'Shade and evaporation do it — which is why a tree-lined street really is cooler.',
  note_i18n = '{"fr":"L’ombre et l’évaporation font le travail : une rue plantée est vraiment plus fraîche.","es":"La sombra y la evaporación lo hacen: una calle con árboles es de verdad más fresca.","ro":"Umbra și evaporarea fac treaba — o stradă cu copaci chiar e mai răcoroasă."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 4;

update public.questions set
  text_i18n = '{"fr":"En Europe, qu’est-ce qu’« Erasmus » ?","es":"En Europa, ¿qué es “Erasmus”?","ro":"În Europa, ce este „Erasmus”?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"برنامج بيبعت طلاب وشباب يعيشوا ويتعلموا في بلد تانية","text_en":"A programme that sends students and young people to live and learn in another country","text_i18n":{"fr":"Un programme qui envoie étudiants et jeunes vivre et apprendre dans un autre pays","es":"Un programa que envía a estudiantes y jóvenes a vivir y aprender en otro país","ro":"Un program care trimite studenți și tineri să trăiască și să învețe în altă țară"}},{"index":1,"text_ar":"نوع من القطارات","text_en":"A kind of train","text_i18n":{"fr":"Un type de train","es":"Un tipo de tren","ro":"Un fel de tren"}},{"index":2,"text_ar":"جايزة رياضية","text_en":"A sports prize","text_i18n":{"fr":"Un prix sportif","es":"Un premio deportivo","ro":"Un premiu sportiv"}},{"index":3,"text_ar":"بنك","text_en":"A bank","text_i18n":{"fr":"Une banque","es":"Un banco","ro":"O bancă"}}]'::jsonb,
  note_ar   = 'اتسمى على مفكر هولندي عاش في كذا بلد — والفكرة نفسها إنك تتعلم بره بيتك.',
  note_en   = 'Named after a Dutch thinker who lived in several countries — the point is learning away from home.',
  note_i18n = '{"fr":"Nommé d’après un penseur néerlandais qui a vécu dans plusieurs pays : apprendre ailleurs, voilà l’idée.","es":"Lleva el nombre de un pensador neerlandés que vivió en varios países: aprender fuera de casa.","ro":"Poartă numele unui gânditor olandez care a trăit în mai multe țări: să înveți departe de casă."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 5;

update public.questions set
  text_i18n = '{"fr":"Dans un cercle des différences, quelle est la règle de base ?","es":"En un círculo de diferencias, ¿cuál es la regla básica?","ro":"Într-un cerc al diferențelor, care e regula de bază?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"واحد يتكلم والباقي يسمعوا، من غير جدال","text_en":"One person speaks, the rest listen, and nobody argues","text_i18n":{"fr":"Une personne parle, les autres écoutent, personne ne débat","es":"Habla uno, los demás escuchan y nadie discute","ro":"Vorbește unul, ceilalți ascultă, nimeni nu contrazice"}},{"index":1,"text_ar":"اللي يقنع الباقيين يكسب","text_en":"Whoever convinces the others wins","text_i18n":{"fr":"Celui qui convainc les autres gagne","es":"Gana quien convence a los demás","ro":"Câștigă cine îi convinge pe ceilalți"}},{"index":2,"text_ar":"ممنوع الكلام عن الثقافة","text_en":"Culture may not be mentioned","text_i18n":{"fr":"On ne parle pas de culture","es":"No se habla de cultura","ro":"Nu se vorbește despre cultură"}},{"index":3,"text_ar":"لازم توافق على كل حاجة","text_en":"You must agree on everything","text_i18n":{"fr":"Il faut être d’accord sur tout","es":"Hay que estar de acuerdo en todo","ro":"Trebuie să fiți de acord în toate"}}]'::jsonb,
  note_ar   = 'الاختلاف مش موضوع للجدال — الهدف تفهم مش تكسب.',
  note_en   = 'A difference is not a debate: the point is to understand, not to win.',
  note_i18n = '{"fr":"Une différence n’est pas un débat : il s’agit de comprendre, pas de gagner.","es":"Una diferencia no es un debate: se trata de entender, no de ganar.","ro":"O diferență nu e o dezbatere: scopul e să înțelegi, nu să câștigi."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 6;

update public.questions set
  text_i18n = '{"fr":"Les déchets alimentaires enfouis produisent quel gaz ?","es":"La comida que va al vertedero produce qué gas?","ro":"Mâncarea aruncată la groapă produce ce gaz?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الميثان","text_en":"Methane","text_i18n":{"fr":"Du méthane","es":"Metano","ro":"Metan"}},{"index":1,"text_ar":"الأكسجين","text_en":"Oxygen","text_i18n":{"fr":"De l’oxygène","es":"Oxígeno","ro":"Oxigen"}},{"index":2,"text_ar":"الهيليوم","text_en":"Helium","text_i18n":{"fr":"De l’hélium","es":"Helio","ro":"Heliu"}},{"index":3,"text_ar":"مفيش","text_en":"None","text_i18n":{"fr":"Aucun","es":"Ninguno","ro":"Niciunul"}}]'::jsonb,
  note_ar   = 'نفس الأكل لو اتعمل كومبوست بيبقى تربة — نفس القشرة، نتيجتين مختلفين تمامًا.',
  note_en   = 'The same peel composted becomes soil instead — same scrap, opposite outcome.',
  note_i18n = '{"fr":"La même épluchure compostée devient de la terre : même déchet, résultat inverse.","es":"La misma cáscara compostada se hace tierra: mismo resto, resultado opuesto.","ro":"Aceeași coajă, compostată, devine pământ: același rest, rezultat opus."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 7;

update public.questions set
  text_i18n = '{"fr":"Un vêtement de fast fashion est porté combien de fois en moyenne avant d’être jeté ?","es":"¿Cuántas veces se usa de media una prenda de moda rápida antes de tirarla?","ro":"De câte ori e purtată, în medie, o haină fast-fashion înainte să fie aruncată?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أقل من عشر مرات","text_en":"Fewer than ten times","text_i18n":{"fr":"Moins de dix fois","es":"Menos de diez veces","ro":"De mai puțin de zece ori"}},{"index":1,"text_ar":"أكتر من مية مرة","text_en":"More than a hundred times","text_i18n":{"fr":"Plus de cent fois","es":"Más de cien veces","ro":"De peste o sută de ori"}},{"index":2,"text_ar":"مرة واحدة بالظبط","text_en":"Exactly once","text_i18n":{"fr":"Exactement une fois","es":"Exactamente una vez","ro":"Exact o dată"}},{"index":3,"text_ar":"كل يوم لمدة سنة","text_en":"Every day for a year","text_i18n":{"fr":"Tous les jours pendant un an","es":"A diario durante un año","ro":"Zilnic timp de un an"}}]'::jsonb,
  note_ar   = 'عشان كده تبادل الهدوم فكرة كويسة: نفس القطعة بتعيش عمر تاني عند حد تاني.',
  note_en   = 'Which is why a clothes swap works: the same piece gets a second life with somebody else.',
  note_i18n = '{"fr":"D’où l’intérêt du troc de vêtements : la même pièce a une seconde vie ailleurs.","es":"Por eso funciona un intercambio de ropa: la misma prenda tiene otra vida con otra persona.","ro":"De asta merge un schimb de haine: aceeași piesă are o a doua viață la altcineva."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 8;

update public.questions set
  text_i18n = '{"fr":"La pollution lumineuse touche surtout quoi ?","es":"¿A qué afecta más directamente la contaminación lumínica?","ro":"Poluarea luminoasă afectează cel mai direct ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الطيور المهاجرة وصغار السلاحف","text_en":"Migrating birds and baby turtles","text_i18n":{"fr":"Les oiseaux migrateurs et les bébés tortues","es":"Las aves migratorias y las crías de tortuga","ro":"Păsările migratoare și puii de țestoasă"}},{"index":1,"text_ar":"الصخور","text_en":"Rocks","text_i18n":{"fr":"Les rochers","es":"Las rocas","ro":"Stâncile"}},{"index":2,"text_ar":"الرمل","text_en":"Sand","text_i18n":{"fr":"Le sable","es":"La arena","ro":"Nisipul"}},{"index":3,"text_ar":"محدش","text_en":"Nothing at all","text_i18n":{"fr":"Rien du tout","es":"Nada","ro":"Nimic"}}]'::jsonb,
  note_ar   = 'صغار السلاحف بتتبع ضوء القمر على البحر — وأضواء الشوارع بتوديهم الناحية الغلط.',
  note_en   = 'Baby turtles follow moonlight to the sea; street lights send them the wrong way.',
  note_i18n = '{"fr":"Les bébés tortues suivent la lune vers la mer ; les lampadaires les envoient à l’opposé.","es":"Las crías de tortuga siguen la luna hacia el mar; las farolas las mandan al revés.","ro":"Puii de țestoasă urmează luna spre mare; felinarele îi trimit invers."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 9;

update public.questions set
  text_i18n = '{"fr":"Les abeilles et autres pollinisateurs assurent environ quelle part de nos cultures ?","es":"¿De qué parte de los cultivos son responsables las abejas y otros polinizadores?","ro":"Albinele și ceilalți polenizatori stau în spatele cam cât din culturile noastre?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حوالي التلت","text_en":"About a third","text_i18n":{"fr":"Environ un tiers","es":"Cerca de un tercio","ro":"Cam o treime"}},{"index":1,"text_ar":"أقل من ١٪","text_en":"Less than 1%","text_i18n":{"fr":"Moins de 1 %","es":"Menos del 1%","ro":"Sub 1%"}},{"index":2,"text_ar":"كلها","text_en":"All of it","text_i18n":{"fr":"La totalité","es":"Todos","ro":"Toate"}},{"index":3,"text_ar":"ولا حاجة","text_en":"None of it","text_i18n":{"fr":"Aucune","es":"Ninguno","ro":"Niciuna"}}]'::jsonb,
  note_ar   = 'شوية زرع على بلكونة أو في حديقة بيفرق معاهم أكتر ما تتخيل.',
  note_en   = 'A few flowering plants on a balcony matter to them more than you would think.',
  note_i18n = '{"fr":"Quelques plantes à fleurs sur un balcon comptent plus qu’on ne croit.","es":"Unas cuantas plantas con flor en un balcón les importan más de lo que crees.","ro":"Câteva plante cu flori pe balcon contează mai mult decât ai crede."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 10;

update public.questions set
  text_i18n = '{"fr":"Lequel se décompose le plus vite ?","es":"¿Cuál de estos se descompone más rápido?","ro":"Care dintre acestea se descompune cel mai repede?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"قشرة موزة","text_en":"A banana skin","text_i18n":{"fr":"Une peau de banane","es":"Una cáscara de plátano","ro":"O coajă de banană"}},{"index":1,"text_ar":"لبانة","text_en":"Chewing gum","text_i18n":{"fr":"Un chewing-gum","es":"Un chicle","ro":"O gumă de mestecat"}},{"index":2,"text_ar":"كيس بلاستيك","text_en":"A plastic bag","text_i18n":{"fr":"Un sac plastique","es":"Una bolsa de plástico","ro":"O pungă de plastic"}},{"index":3,"text_ar":"علبة زجاج","text_en":"A glass bottle","text_i18n":{"fr":"Une bouteille en verre","es":"Una botella de vidrio","ro":"O sticlă"}}]'::jsonb,
  note_ar   = 'اللبانة مطاط صناعي، والزجاج ممكن يفضل آلاف السنين — والموزة أسابيع.',
  note_en   = 'Gum is synthetic rubber and glass can last millennia; the banana skin takes weeks.',
  note_i18n = '{"fr":"Le chewing-gum est du caoutchouc synthétique et le verre peut durer des millénaires ; la banane, des semaines.","es":"El chicle es caucho sintético y el vidrio puede durar milenios; el plátano, semanas.","ro":"Guma e cauciuc sintetic, iar sticla poate dura milenii; coaja de banană, săptămâni."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 11;

update public.questions set
  text_i18n = '{"fr":"Quand a lieu le World Cleanup Day ?","es":"¿Cuándo es el Día Mundial de la Limpieza?","ro":"Când are loc Ziua Mondială a Curățeniei?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"كل سنة في سبتمبر","text_en":"Every year, in September","text_i18n":{"fr":"Chaque année, en septembre","es":"Cada año, en septiembre","ro":"În fiecare an, în septembrie"}},{"index":1,"text_ar":"مرة كل عشر سنين","text_en":"Once every ten years","text_i18n":{"fr":"Une fois tous les dix ans","es":"Una vez cada diez años","ro":"O dată la zece ani"}},{"index":2,"text_ar":"في يناير","text_en":"In January","text_i18n":{"fr":"En janvier","es":"En enero","ro":"În ianuarie"}},{"index":3,"text_ar":"مش موجود","text_en":"It does not exist","text_i18n":{"fr":"Il n’existe pas","es":"No existe","ro":"Nu există"}}]'::jsonb,
  note_ar   = 'ملايين بيطلعوا في نفس اليوم في أكتر من ١٩٠ بلد — وممكن تبقى واحد منهم.',
  note_en   = 'Millions turn out on the same day in more than 190 countries — you can be one of them.',
  note_i18n = '{"fr":"Des millions de gens sortent le même jour dans plus de 190 pays. Vous pouvez en être.","es":"Millones salen el mismo día en más de 190 países. Puedes ser uno.","ro":"Milioane de oameni ies în aceeași zi în peste 190 de țări — poți fi unul dintre ei."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 12;

update public.questions set
  text_i18n = '{"fr":"Si personne n’a de gants lors d’un nettoyage, que faire ?","es":"Si nadie tiene guantes en una limpieza, ¿qué es lo sensato?","ro":"Dacă nimeni nu are mănuși la o curățenie, ce e de făcut?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"اجمعوا اللي مش خطر بس، وسيبوا الزجاج والإبر للمختصين","text_en":"Pick up only what is safe and leave glass and needles to the professionals","text_i18n":{"fr":"Ramassez seulement ce qui est sûr et laissez le verre et les seringues aux professionnels","es":"Recoged solo lo seguro y dejad el vidrio y las agujas a los profesionales","ro":"Adunați doar ce e sigur și lăsați sticla și acele profesioniștilor"}},{"index":1,"text_ar":"اجمعوا كل حاجة بإيديكم","text_en":"Pick everything up bare-handed","text_i18n":{"fr":"Tout ramasser à mains nues","es":"Recogerlo todo con las manos","ro":"Adunați totul cu mâna goală"}},{"index":2,"text_ar":"الغوا اليوم كله","text_en":"Cancel the whole day","text_i18n":{"fr":"Tout annuler","es":"Cancelar el día","ro":"Anulați ziua"}},{"index":3,"text_ar":"استنوا حد يجيب معدات","text_en":"Wait for somebody to bring equipment","text_i18n":{"fr":"Attendre que quelqu’un apporte du matériel","es":"Esperar a que alguien traiga material","ro":"Așteptați să aducă cineva echipament"}}]'::jsonb,
  note_ar   = 'التنضيف مش لازم يكون كامل عشان يفرق — والأمان أهم من الرقم.',
  note_en   = 'A clean-up does not have to be complete to matter, and safety beats the total.',
  note_i18n = '{"fr":"Un nettoyage n’a pas besoin d’être complet pour compter ; la sécurité passe avant le chiffre.","es":"Una limpieza no tiene que ser completa para valer; la seguridad va antes que la cifra.","ro":"O curățenie nu trebuie să fie completă ca să conteze; siguranța trece înaintea cifrei."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 13;

update public.questions set
  text_i18n = '{"fr":"Que faire de mieux avec les photos avant/après d’un nettoyage ?","es":"¿Qué es lo mejor que puedes hacer con las fotos de antes y después?","ro":"Ce e cel mai bine să faci cu pozele dinainte și de după?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"تعرضها عشان حد تاني يبدأ واحدة","text_en":"Show them, so somebody else starts one","text_i18n":{"fr":"Les montrer, pour que quelqu’un d’autre se lance","es":"Enseñarlas, para que otro empiece una","ro":"Să le arăți, ca să înceapă și altcineva"}},{"index":1,"text_ar":"تمسحها","text_en":"Delete them","text_i18n":{"fr":"Les effacer","es":"Borrarlas","ro":"Să le ștergi"}},{"index":2,"text_ar":"تسيبها في التليفون","text_en":"Leave them on your phone","text_i18n":{"fr":"Les laisser sur le téléphone","es":"Dejarlas en el móvil","ro":"Să le lași în telefon"}},{"index":3,"text_ar":"تطبعها بس","text_en":"Only print them","text_i18n":{"fr":"Seulement les imprimer","es":"Solo imprimirlas","ro":"Doar să le printezi"}}]'::jsonb,
  note_ar   = 'أغلب اللي بيشاركوا أول مرة بيجوا لأنهم شافوا حد يعرفوه عمل كده.',
  note_en   = 'Most first-timers come because they saw somebody they know do it.',
  note_i18n = '{"fr":"La plupart des débutants viennent parce qu’ils ont vu quelqu’un qu’ils connaissent le faire.","es":"La mayoría de los novatos vienen porque vieron a alguien conocido hacerlo.","ro":"Cei mai mulți vin prima dată pentru că au văzut pe cineva cunoscut făcând-o."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 14;

update public.questions set
  text_i18n = '{"fr":"Quelqu’un dit dans le cercle une chose avec laquelle vous n’êtes pas d’accord. On fait quoi d’abord ?","es":"Alguien en el círculo dice algo con lo que no estás de acuerdo. ¿Qué va primero?","ro":"Cineva din cerc spune ceva cu care nu ești de acord. Ce faci întâi?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"تسمع لآخر الكلام قبل ما ترد","text_en":"Hear the whole thing before answering","text_i18n":{"fr":"Écouter jusqu’au bout avant de répondre","es":"Escuchar hasta el final antes de responder","ro":"Asculți până la capăt înainte să răspunzi"}},{"index":1,"text_ar":"تقاطعه","text_en":"Interrupt","text_i18n":{"fr":"L’interrompre","es":"Interrumpir","ro":"Îl întrerupi"}},{"index":2,"text_ar":"تمشي","text_en":"Walk out","text_i18n":{"fr":"Partir","es":"Irte","ro":"Pleci"}},{"index":3,"text_ar":"تصوّره","text_en":"Film them","text_i18n":{"fr":"Le filmer","es":"Grabarlo","ro":"Îl filmezi"}}]'::jsonb,
  note_ar   = 'السماع لآخره مش موافقة — هو بس الفرق بين حوار وخناقة.',
  note_en   = 'Hearing somebody out is not agreeing with them; it is the difference between a talk and a row.',
  note_i18n = '{"fr":"Écouter jusqu’au bout n’est pas approuver : c’est la différence entre une conversation et une dispute.","es":"Escuchar hasta el final no es estar de acuerdo: es la diferencia entre una charla y una bronca.","ro":"Să asculți până la capăt nu înseamnă să fii de acord: e diferența dintre discuție și ceartă."}'::jsonb
 where pack_id = 'ffff6666-0000-4000-8000-000000000001' and order_index = 15;

notify pgrst, 'reload schema';
