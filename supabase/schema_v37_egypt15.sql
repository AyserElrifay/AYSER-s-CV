-- ═══════════════════════════════════════════════════════════════════
--  مصر في ١٥ سؤال · THE ROUND, FIXED
--
--  Yasmin Elkilany sent thirteen questions and Ayser said: make the
--  round these, and keep two of the funny ones — or write two new ones.
--
--  ── WHY THIS IS A PACK AND NOT AN EDIT ───────────────────────────
--  "Do You Know Egypt?" has fifty-three questions and a room draws
--  fifteen of them at random. So there was no way to make Yasmin's
--  thirteen be the round: the draw would take some and leave others,
--  differently every time. Editing the big pack down to fifteen would
--  have thrown away thirty-eight good questions to get there.
--
--  A pack of exactly fifteen solves it exactly. A room draws fifteen,
--  the pack holds fifteen, so the round IS the list — in a different
--  order each time, which is the only part that should vary.
--
--  Both packs stay. Pick this one for the night you want these
--  questions; pick the big one when you want surprise.
--
--  ── TWELVE OF THESE WERE ALREADY WRITTEN ─────────────────────────
--  Nine of Yasmin's thirteen are already in the Egypt pack, several of
--  them word for word — the sayings, Sinai, the tea, and the four that
--  went in from Sara's list last week. Those are COPIED from what is
--  already there, with their translations and their teaching lines,
--  rather than retyped: retyping is how a French line drifts from the
--  Arabic one it is supposed to match.
--
--  Three are asked the other way round from ours — Yasmin asks whose
--  tomb Carter found, where we asked who found the tomb — so those
--  three are written fresh, in all five languages, with their own
--  notes.
--
--  And the two funny ones Ayser asked to keep are here: the Sphinx,
--  where one of the wrong answers is a penguin, and who founded
--  Alexandria, where one of them is "a man called Alex, obviously".
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions where pack_id = 'aaaa7777-0000-4000-8000-000000000001';
delete from public.game_packs where id = 'aaaa7777-0000-4000-8000-000000000001';

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en,
                               category, country, locale, is_official, visibility) values
 ('aaaa7777-0000-4000-8000-000000000001','مصر في ١٥ سؤال','Egypt in 15',
  'الجولة دي بالظبط — مفيش سحب عشوائي',
  'This exact round, every time — nothing left to the draw.',
  'fun','EG','ar-EG',true,'public');

update public.game_packs
   set languages = array['ar','en','fr','es','ro']
 where id = 'aaaa7777-0000-4000-8000-000000000001';

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('aaaa7777-0000-4000-8000-000000000001',0,'مقبرة أنهي فرعون لقاها هوارد كارتر كاملة تقريبًا سنة ١٩٢٢؟','Whose tomb did Howard Carter find almost untouched in 1922?',20000,
 '[{"index":0,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun"},{"index":1,"text_ar":"رمسيس الثاني","text_en":"Ramses II"},{"index":2,"text_ar":"تحتمس الثالث","text_en":"Thutmose III"},{"index":3,"text_ar":"سيتي الأول","text_en":"Seti I"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',1,'الملك نارمر أسس أول عاصمة لمصر حوالي سنة ٣١٠٠ ق.م — اسمها كان إيه؟','King Narmer founded Egypt’s first capital around 3100 BCE. What was it called?',20000,
 '[{"index":0,"text_ar":"منف","text_en":"Memphis"},{"index":1,"text_ar":"طيبة","text_en":"Thebes"},{"index":2,"text_ar":"الإسكندرية","text_en":"Alexandria"},{"index":3,"text_ar":"الكرنك","text_en":"Karnak"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',2,'مين إله الشمس عند المصريين القدماء، اللي بيترسم براس صقر وقرص شمس فوقه؟','Who was the sun god of ancient Egypt, drawn with a hawk’s head and a sun disc?',20000,
 '[{"index":0,"text_ar":"رع","text_en":"Ra"},{"index":1,"text_ar":"أوزيريس","text_en":"Osiris"},{"index":2,"text_ar":"أنوبيس","text_en":"Anubis"},{"index":3,"text_ar":"سوبك","text_en":"Sobek"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',3,'الهرم الأكبر في الجيزة اتبنى لمين؟','The Great Pyramid of Giza was built for whom?',20000,
 '[{"index":0,"text_ar":"خوفو","text_en":"Khufu"},{"index":1,"text_ar":"كليوباترا","text_en":"Cleopatra"},{"index":2,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun"},{"index":3,"text_ar":"عميل صعب جدًا","text_en":"A very demanding client"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',4,'أنهي أثر اتلقى سنة ١٧٩٩ وكان مفتاح قراية الهيروغليفية؟','Which object, found in 1799, was the key to reading hieroglyphs?',20000,
 '[{"index":0,"text_ar":"حجر رشيد","text_en":"The Rosetta Stone"},{"index":1,"text_ar":"تمثال نفرتيتي","text_en":"The bust of Nefertiti"},{"index":2,"text_ar":"حجر باليرمو","text_en":"The Palermo Stone"},{"index":3,"text_ar":"قناع توت عنخ آمون","text_en":"The mask of Tutankhamun"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',5,'المصريين القدماء كانوا بيسموا موسم فيضان النيل إيه؟','What did the ancient Egyptians call the season of the Nile flood?',20000,
 '[{"index":0,"text_ar":"آخت","text_en":"Akhet"},{"index":1,"text_ar":"بيريت","text_en":"Peret"},{"index":2,"text_ar":"شيمو","text_en":"Shemu"},{"index":3,"text_ar":"حابي","text_en":"Hapi"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',6,'المصريين القدماء عملوا حاجة زي الورق من نبات بيطلع على النيل — اسمها إيه؟','The ancient Egyptians made a paper-like material from a plant of the Nile. What is it called?',20000,
 '[{"index":0,"text_ar":"البردي","text_en":"Papyrus"},{"index":1,"text_ar":"الرق","text_en":"Parchment"},{"index":2,"text_ar":"الڤيلام","text_en":"Vellum"},{"index":3,"text_ar":"القماش","text_en":"Canvas"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',7,'قناة السويس اتفتحت سنة كام؟','In what year did the Suez Canal open?',20000,
 '[{"index":0,"text_ar":"١٨٦٩","text_en":"1869"},{"index":1,"text_ar":"١٩٠٥","text_en":"1905"},{"index":2,"text_ar":"١٧٩٨","text_en":"1798"},{"index":3,"text_ar":"١٩٥٢","text_en":"1952"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',8,'«اللي فات مات» — معناه إيه؟','“What has passed is dead” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"سيب اللي فات وكمّل","text_en":"Let the past go and carry on"},{"index":1,"text_ar":"التاريخ مش مهم","text_en":"History does not matter"},{"index":2,"text_ar":"ما تسألش عن حد مات","text_en":"Never speak of the dead"},{"index":3,"text_ar":"الوقت بيعدي بسرعة","text_en":"Time passes quickly"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',9,'«الباب اللي يجيلك منه الريح سده واستريح» — معناه إيه؟','“Block the door the wind comes from, and rest” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"اقطع سبب المشكلة من أوله","text_en":"Cut off whatever is causing you trouble"},{"index":1,"text_ar":"اقفل الشبابيك بالليل","text_en":"Close the windows at night"},{"index":2,"text_ar":"النوم أحسن حاجة","text_en":"Sleep is the best thing"},{"index":3,"text_ar":"الهوا مفيد للصحة","text_en":"Fresh air is good for you"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',10,'سينا عبارة عن إيه؟','Sinai is what?',20000,
 '[{"index":0,"text_ar":"شبه جزيرة","text_en":"A peninsula"},{"index":1,"text_ar":"جزيرة","text_en":"An island"},{"index":2,"text_ar":"بحيرة","text_en":"A lake"},{"index":3,"text_ar":"مدينة","text_en":"A city"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',11,'«القرد في عين أمه غزال» — المثل ده معناه إيه؟','“A monkey is a gazelle in his mother’s eyes” — what does this Egyptian saying mean?',20000,
 '[{"index":0,"text_ar":"الأم دايمًا شايفة ابنها أحلى واحد","text_en":"A mother always sees her child as beautiful"},{"index":1,"text_ar":"القرود بتعيش في الغابة","text_en":"Monkeys live in forests"},{"index":2,"text_ar":"لازم تشوف كويس قبل ما تحكم","text_en":"Get your eyes tested before judging"},{"index":3,"text_ar":"الغزال أسرع من القرد","text_en":"A gazelle is faster than a monkey"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',12,'«الشاي مظبوط» يعني إيه؟','In Egypt, tea “mazbout” means what?',20000,
 '[{"index":0,"text_ar":"سكر متوسط","text_en":"Medium sugar"},{"index":1,"text_ar":"من غير سكر","text_en":"No sugar at all"},{"index":2,"text_ar":"بالحليب","text_en":"With milk"},{"index":3,"text_ar":"بارد","text_en":"Cold"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',13,'أبو الهول جسمه جسم إيه؟','The Sphinx has the body of which animal?',20000,
 '[{"index":0,"text_ar":"أسد","text_en":"A lion"},{"index":1,"text_ar":"حصان","text_en":"A horse"},{"index":2,"text_ar":"سمكة","text_en":"A fish"},{"index":3,"text_ar":"بطريق","text_en":"A penguin"}]',0,'standard'),
('aaaa7777-0000-4000-8000-000000000001',14,'مين اللي أسّس الإسكندرية؟','Who founded Alexandria?',20000,
 '[{"index":0,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great"},{"index":1,"text_ar":"يوليوس قيصر","text_en":"Julius Caesar"},{"index":2,"text_ar":"نابليون","text_en":"Napoleon"},{"index":3,"text_ar":"راجل اسمه إسكندر، طبعًا","text_en":"A man called Alex, obviously"}]',0,'double');

update public.questions set
  text_i18n = '{"fr":"De quel pharaon Howard Carter a-t-il trouvé la tombe presque intacte en 1922 ?","es":"¿De qué faraón encontró Howard Carter la tumba casi intacta en 1922?","ro":"A cărui faraon i-a găsit Howard Carter mormântul aproape neatins în 1922?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun","text_i18n":{"fr":"Toutânkhamon","es":"Tutankamón","ro":"Tutankhamon"}},{"index":1,"text_ar":"رمسيس الثاني","text_en":"Ramses II","text_i18n":{"fr":"Ramsès II","es":"Ramsés II","ro":"Ramses al II-lea"}},{"index":2,"text_ar":"تحتمس الثالث","text_en":"Thutmose III","text_i18n":{"fr":"Thoutmôsis III","es":"Tutmosis III","ro":"Tutmes al III-lea"}},{"index":3,"text_ar":"سيتي الأول","text_en":"Seti I","text_i18n":{"fr":"Séthi Ier","es":"Seti I","ro":"Seti I"}}]'::jsonb,
  note_ar   = 'كانت المقبرة الوحيدة اللي وصلت شبه كاملة، وعشان كده الدنيا اتقلبت على مصر القديمة.',
  note_en   = 'It was the only royal tomb to survive nearly complete — which is why the world went mad for ancient Egypt.',
  note_i18n = '{"fr":"C’était la seule tombe royale parvenue presque complète : d’où la folie mondiale pour l’Égypte ancienne.","es":"Fue la única tumba real que llegó casi completa: por eso el mundo se volvió loco con el antiguo Egipto.","ro":"A fost singurul mormânt regal păstrat aproape întreg — de aceea lumea a înnebunit după Egiptul antic."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 0;

update public.questions set
  text_i18n = '{"fr":"Le roi Narmer a fondé la première capitale de l’Égypte vers 3100 av. J.-C. Comment s’appelait-elle ?","es":"El rey Narmer fundó la primera capital de Egipto hacia el 3100 a. C. ¿Cómo se llamaba?","ro":"Regele Narmer a întemeiat prima capitală a Egiptului pe la 3100 î.Hr. Cum se numea?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"منف","text_en":"Memphis","text_i18n":{"fr":"Memphis","es":"Menfis","ro":"Memphis"}},{"index":1,"text_ar":"طيبة","text_en":"Thebes","text_i18n":{"fr":"Thèbes","es":"Tebas","ro":"Teba"}},{"index":2,"text_ar":"الإسكندرية","text_en":"Alexandria","text_i18n":{"fr":"Alexandrie","es":"Alejandría","ro":"Alexandria"}},{"index":3,"text_ar":"الكرنك","text_en":"Karnak","text_i18n":{"fr":"Karnak","es":"Karnak","ro":"Karnak"}}]'::jsonb,
  note_ar   = 'منف قامت عند أول الدلتا، جنب القاهرة النهاردة — وطيبة والإسكندرية جم بعدها بقرون.',
  note_en   = 'Memphis stood where the valley opens into the Delta, beside today’s Cairo. Thebes and Alexandria came centuries later.',
  note_i18n = '{"fr":"Memphis se dressait là où la vallée s’ouvre sur le Delta, près du Caire actuel. Thèbes et Alexandrie sont venues des siècles plus tard.","es":"Menfis estaba donde el valle se abre al Delta, junto al Cairo de hoy. Tebas y Alejandría llegaron siglos después.","ro":"Memphis se afla acolo unde valea se deschide spre Deltă, lângă Cairo de azi. Teba și Alexandria au venit secole mai târziu."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 1;

update public.questions set
  text_i18n = '{"fr":"Qui était le dieu du soleil de l’Égypte ancienne, représenté avec une tête de faucon et un disque solaire ?","es":"¿Quién era el dios del sol del antiguo Egipto, con cabeza de halcón y un disco solar?","ro":"Cine era zeul soarelui în Egiptul antic, înfățișat cu cap de șoim și un disc solar?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"رع","text_en":"Ra","text_i18n":{"fr":"Rê","es":"Ra","ro":"Ra"}},{"index":1,"text_ar":"أوزيريس","text_en":"Osiris","text_i18n":{"fr":"Osiris","es":"Osiris","ro":"Osiris"}},{"index":2,"text_ar":"أنوبيس","text_en":"Anubis","text_i18n":{"fr":"Anubis","es":"Anubis","ro":"Anubis"}},{"index":3,"text_ar":"سوبك","text_en":"Sobek","text_i18n":{"fr":"Sobek","es":"Sobek","ro":"Sobek"}}]'::jsonb,
  note_ar   = 'رع بيعدي السما بالنهار والعالم التاني بالليل. أوزيريس للموتى، وأنوبيس للتحنيط، وسوبك هو التمساح.',
  note_en   = 'Ra crossed the sky by day and the underworld by night. Osiris ruled the dead, Anubis handled mummification, Sobek was the crocodile.',
  note_i18n = '{"fr":"Rê traversait le ciel le jour et le monde souterrain la nuit. Osiris régnait sur les morts, Anubis s’occupait de la momification, Sobek était le crocodile.","es":"Ra cruzaba el cielo de día y el inframundo de noche. Osiris reinaba sobre los muertos, Anubis se ocupaba de la momificación y Sobek era el cocodrilo.","ro":"Ra traversa cerul ziua și lumea de dincolo noaptea. Osiris domnea peste morți, Anubis se ocupa de mumificare, iar Sobek era crocodilul."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 2;

update public.questions set
  text_i18n = '{"fr":"La grande pyramide de Gizeh a été bâtie pour qui ?","es":"¿Para quién se construyó la Gran Pirámide de Guiza?","ro":"Pentru cine a fost construită Marea Piramidă din Giza?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"خوفو","text_en":"Khufu","text_i18n":{"fr":"Khéops","es":"Keops","ro":"Keops"}},{"index":1,"text_ar":"كليوباترا","text_en":"Cleopatra","text_i18n":{"fr":"Cléopâtre","es":"Cleopatra","ro":"Cleopatra"}},{"index":2,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun","text_i18n":{"fr":"Toutânkhamon","es":"Tutankamón","ro":"Tutankhamon"}},{"index":3,"text_ar":"عميل صعب جدًا","text_en":"A very demanding client","text_i18n":{"fr":"Un client très exigeant","es":"Un cliente muy exigente","ro":"Un client foarte pretențios"}}]'::jsonb,
  note_ar   = 'الهرم الأكبر فضل أطول مبنى في الدنيا حوالي ٣٨٠٠ سنة.',
  note_en   = 'The Great Pyramid was the tallest building on earth for about 3,800 years.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 3;

update public.questions set
  text_i18n = '{"fr":"Quel objet, trouvé en 1799, a été la clé pour lire les hiéroglyphes ?","es":"¿Qué objeto, hallado en 1799, fue la clave para leer los jeroglíficos?","ro":"Ce obiect, găsit în 1799, a fost cheia citirii hieroglifelor?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حجر رشيد","text_en":"The Rosetta Stone","text_i18n":{"fr":"La pierre de Rosette","es":"La piedra de Rosetta","ro":"Piatra din Rosetta"}},{"index":1,"text_ar":"تمثال نفرتيتي","text_en":"The bust of Nefertiti","text_i18n":{"fr":"Le buste de Néfertiti","es":"El busto de Nefertiti","ro":"Bustul lui Nefertiti"}},{"index":2,"text_ar":"حجر باليرمو","text_en":"The Palermo Stone","text_i18n":{"fr":"La pierre de Palerme","es":"La piedra de Palermo","ro":"Piatra din Palermo"}},{"index":3,"text_ar":"قناع توت عنخ آمون","text_en":"The mask of Tutankhamun","text_i18n":{"fr":"Le masque de Toutânkhamon","es":"La máscara de Tutankamón","ro":"Masca lui Tutankhamon"}}]'::jsonb,
  note_ar   = 'نفس الكلام مكتوب بتلات كتابات — واللي كان معروف منهم فك اللي مكانش معروف.',
  note_en   = 'The same text in three scripts: the one people could still read unlocked the two they could not.',
  note_i18n = '{"fr":"Le même texte en trois écritures : celle qu’on savait encore lire a ouvert les deux autres.","es":"El mismo texto en tres escrituras: la que aún se sabía leer abrió las otras dos.","ro":"Același text în trei scrieri: cea care se mai citea le-a deschis pe celelalte două."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 4;

update public.questions set
  text_i18n = '{"fr":"Comment les anciens Égyptiens appelaient-ils la saison de la crue du Nil ?","es":"¿Cómo llamaban los antiguos egipcios a la estación de la crecida del Nilo?","ro":"Cum numeau egiptenii antici anotimpul revărsării Nilului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"آخت","text_en":"Akhet","text_i18n":{"fr":"Akhet","es":"Akhet","ro":"Akhet"}},{"index":1,"text_ar":"بيريت","text_en":"Peret","text_i18n":{"fr":"Peret","es":"Peret","ro":"Peret"}},{"index":2,"text_ar":"شيمو","text_en":"Shemu","text_i18n":{"fr":"Chemou","es":"Shemu","ro":"Shemu"}},{"index":3,"text_ar":"حابي","text_en":"Hapi","text_i18n":{"fr":"Hâpi","es":"Hapi","ro":"Hapi"}}]'::jsonb,
  note_ar   = 'السنة كانت تلات مواسم: آخت الفيضان، وبيريت الزرع، وشيمو الحصاد. وحابي ده إله الفيضان نفسه، مش الموسم.',
  note_en   = 'Their year had three seasons: Akhet the flood, Peret the growing, Shemu the harvest. Hapi was the god of the flood, not the season.',
  note_i18n = '{"fr":"Leur année comptait trois saisons : Akhet la crue, Peret les semailles, Chemou la moisson. Hâpi était le dieu de la crue, pas la saison.","es":"Su año tenía tres estaciones: Akhet la crecida, Peret la siembra, Shemu la cosecha. Hapi era el dios de la crecida, no la estación.","ro":"Anul lor avea trei anotimpuri: Akhet — revărsarea, Peret — semănatul, Shemu — recolta. Hapi era zeul revărsării, nu anotimpul."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 5;

update public.questions set
  text_i18n = '{"fr":"Les anciens Égyptiens fabriquaient une matière proche du papier avec une plante du Nil. Son nom ?","es":"Los antiguos egipcios hacían un material parecido al papel con una planta del Nilo. ¿Cómo se llama?","ro":"Egiptenii antici făceau un material asemănător hârtiei dintr-o plantă de pe Nil. Cum se numește?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"البردي","text_en":"Papyrus","text_i18n":{"fr":"Le papyrus","es":"Papiro","ro":"Papirus"}},{"index":1,"text_ar":"الرق","text_en":"Parchment","text_i18n":{"fr":"Le parchemin","es":"Pergamino","ro":"Pergament"}},{"index":2,"text_ar":"الڤيلام","text_en":"Vellum","text_i18n":{"fr":"Le vélin","es":"Vitela","ro":"Veline"}},{"index":3,"text_ar":"القماش","text_en":"Canvas","text_i18n":{"fr":"La toile","es":"Lienzo","ro":"Pânză"}}]'::jsonb,
  note_ar   = 'البردي نبات بيتقطع شرايح وبيتلزق مع بعضه — والرق والڤيلام بيتعملوا من جلد حيوان.',
  note_en   = 'Papyrus is a plant cut into strips and pressed together; parchment and vellum are animal skin.',
  note_i18n = '{"fr":"Le papyrus est une plante coupée en lanières et pressée ; parchemin et vélin sont de la peau.","es":"El papiro es una planta cortada en tiras y prensada; el pergamino y la vitela son piel.","ro":"Papirusul e o plantă tăiată fâșii și presată; pergamentul și velina sunt din piele."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 6;

update public.questions set
  text_i18n = '{"fr":"En quelle année le canal de Suez a-t-il été ouvert ?","es":"¿En qué año se abrió el canal de Suez?","ro":"În ce an a fost deschis Canalul Suez?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"١٨٦٩","text_en":"1869","text_i18n":{"fr":"1869","es":"1869","ro":"1869"}},{"index":1,"text_ar":"١٩٠٥","text_en":"1905","text_i18n":{"fr":"1905","es":"1905","ro":"1905"}},{"index":2,"text_ar":"١٧٩٨","text_en":"1798","text_i18n":{"fr":"1798","es":"1798","ro":"1798"}},{"index":3,"text_ar":"١٩٥٢","text_en":"1952","text_i18n":{"fr":"1952","es":"1952","ro":"1952"}}]'::jsonb,
  note_ar   = 'اتفتحت في نوفمبر ١٨٦٩ بعد عشر سنين حفر، وبقت أقصر طريق بين أوروبا وآسيا.',
  note_en   = 'It opened in November 1869 after ten years of digging, and became the short way between Europe and Asia.',
  note_i18n = '{"fr":"Ouvert en novembre 1869 après dix ans de travaux, il est devenu la route courte entre l’Europe et l’Asie.","es":"Se abrió en noviembre de 1869 tras diez años de obras y se convirtió en el camino corto entre Europa y Asia.","ro":"S-a deschis în noiembrie 1869, după zece ani de săpături, devenind drumul scurt dintre Europa și Asia."}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 7;

update public.questions set
  text_i18n = '{"fr":"« Ce qui est passé est mort » — que veut dire ce proverbe égyptien ?","es":"“Lo que pasó, murió” — ¿qué significa este dicho egipcio?","ro":"„Ce-a trecut a murit” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"سيب اللي فات وكمّل","text_en":"Let the past go and carry on","text_i18n":{"fr":"Laisse le passé et avance","es":"Deja atrás el pasado y sigue","ro":"Lasă trecutul și mergi mai departe"}},{"index":1,"text_ar":"التاريخ مش مهم","text_en":"History does not matter","text_i18n":{"fr":"L’histoire n’a pas d’importance","es":"La historia no importa","ro":"Istoria nu contează"}},{"index":2,"text_ar":"ما تسألش عن حد مات","text_en":"Never speak of the dead","text_i18n":{"fr":"Ne parle jamais des morts","es":"No hables de los muertos","ro":"Nu vorbi despre cei morți"}},{"index":3,"text_ar":"الوقت بيعدي بسرعة","text_en":"Time passes quickly","text_i18n":{"fr":"Le temps passe vite","es":"El tiempo pasa rápido","ro":"Timpul trece repede"}}]'::jsonb,
  note_ar   = 'بيتقال عشان حد يبطل يفكر في اللي راح ويكمّل قدام.',
  note_en   = 'Said to stop somebody chewing over what is already done.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 8;

update public.questions set
  text_i18n = '{"fr":"« Bouche la porte d’où vient le vent, et repose-toi » — que veut dire ce proverbe égyptien ?","es":"“Tapa la puerta por donde entra el viento y descansa” — ¿qué significa este dicho egipcio?","ro":"„Astupă ușa de unde vine vântul și odihnește-te” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"اقطع سبب المشكلة من أوله","text_en":"Cut off whatever is causing you trouble","text_i18n":{"fr":"Coupe court à ce qui te cause du souci","es":"Corta de raíz lo que te causa problemas","ro":"Taie de la rădăcină ce îți face probleme"}},{"index":1,"text_ar":"اقفل الشبابيك بالليل","text_en":"Close the windows at night","text_i18n":{"fr":"Ferme les fenêtres la nuit","es":"Cierra las ventanas de noche","ro":"Închide ferestrele noaptea"}},{"index":2,"text_ar":"النوم أحسن حاجة","text_en":"Sleep is the best thing","text_i18n":{"fr":"Dormir est ce qu’il y a de mieux","es":"Dormir es lo mejor","ro":"Somnul e cel mai bun lucru"}},{"index":3,"text_ar":"الهوا مفيد للصحة","text_en":"Fresh air is good for you","text_i18n":{"fr":"L’air frais fait du bien","es":"El aire fresco es bueno","ro":"Aerul curat îți face bine"}}]'::jsonb,
  note_ar   = 'نصيحة قديمة: اقطع مصدر التعب من أوله بدل ما تفضل تشيل نتيجته.',
  note_en   = 'Old advice: cut the cause off rather than carrying the consequences forever.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 9;

update public.questions set
  text_i18n = '{"fr":"Le Sinaï, c’est quoi ?","es":"¿Qué es el Sinaí?","ro":"Ce este Sinai?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"شبه جزيرة","text_en":"A peninsula","text_i18n":{"fr":"Une péninsule","es":"Una península","ro":"O peninsulă"}},{"index":1,"text_ar":"جزيرة","text_en":"An island","text_i18n":{"fr":"Une île","es":"Una isla","ro":"O insulă"}},{"index":2,"text_ar":"بحيرة","text_en":"A lake","text_i18n":{"fr":"Un lac","es":"Un lago","ro":"Un lac"}},{"index":3,"text_ar":"مدينة","text_en":"A city","text_i18n":{"fr":"Une ville","es":"Una ciudad","ro":"Un oraș"}}]'::jsonb,
  note_ar   = 'سينا هي الجسر البري الوحيد بين أفريقيا وآسيا، وفيها أعلى جبل في مصر.',
  note_en   = 'Sinai is the only land bridge between Africa and Asia, and holds Egypt’s highest mountain.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 10;

update public.questions set
  text_i18n = '{"fr":"« Un singe est une gazelle aux yeux de sa mère » — que veut dire ce proverbe égyptien ?","es":"“Un mono es una gacela a los ojos de su madre” — ¿qué significa este dicho egipcio?","ro":"„O maimuță e o gazelă în ochii mamei ei” — ce înseamnă proverbul ăsta egiptean?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الأم دايمًا شايفة ابنها أحلى واحد","text_en":"A mother always sees her child as beautiful","text_i18n":{"fr":"Une mère trouve toujours son enfant beau","es":"Una madre siempre ve guapo a su hijo","ro":"O mamă își vede mereu copilul frumos"}},{"index":1,"text_ar":"القرود بتعيش في الغابة","text_en":"Monkeys live in forests","text_i18n":{"fr":"Les singes vivent en forêt","es":"Los monos viven en el bosque","ro":"Maimuțele trăiesc în pădure"}},{"index":2,"text_ar":"لازم تشوف كويس قبل ما تحكم","text_en":"Get your eyes tested before judging","text_i18n":{"fr":"Faites vérifier vos yeux avant de juger","es":"Hazte una revisión de la vista antes de juzgar","ro":"Verifică-ți vederea înainte să judeci"}},{"index":3,"text_ar":"الغزال أسرع من القرد","text_en":"A gazelle is faster than a monkey","text_i18n":{"fr":"La gazelle court plus vite que le singe","es":"La gacela es más rápida que el mono","ro":"Gazela e mai rapidă decât maimuța"}}]'::jsonb,
  note_ar   = 'المثل ده بيتقال لما حد يمدح ابنه قدام الناس — الحب بيعمي عن العيوب.',
  note_en   = 'Said when a parent brags about their child: love does not see the flaws.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 11;

update public.questions set
  text_i18n = '{"fr":"En Égypte, un thé « mazbout », c’est quoi ?","es":"En Egipto, un té “mazbout” ¿qué es?","ro":"În Egipt, un ceai „mazbout” înseamnă ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"سكر متوسط","text_en":"Medium sugar","text_i18n":{"fr":"Sucré comme il faut","es":"Con azúcar medio","ro":"Cu zahăr potrivit"}},{"index":1,"text_ar":"من غير سكر","text_en":"No sugar at all","text_i18n":{"fr":"Sans sucre","es":"Sin azúcar","ro":"Fără zahăr"}},{"index":2,"text_ar":"بالحليب","text_en":"With milk","text_i18n":{"fr":"Avec du lait","es":"Con leche","ro":"Cu lapte"}},{"index":3,"text_ar":"بارد","text_en":"Cold","text_i18n":{"fr":"Froid","es":"Frío","ro":"Rece"}}]'::jsonb,
  note_ar   = 'مظبوط، سكر زيادة، وعلى الريحة — تلات درجات للسكر لهم أسماء.',
  note_en   = 'Mazbout, ziyada and “ala er-reeha” — three named levels of sugar.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 12;

update public.questions set
  text_i18n = '{"fr":"Le Sphinx a le corps de quel animal ?","es":"¿El cuerpo de la Esfinge es de qué animal?","ro":"Sfinxul are corpul cărui animal?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أسد","text_en":"A lion","text_i18n":{"fr":"Un lion","es":"Un león","ro":"Un leu"}},{"index":1,"text_ar":"حصان","text_en":"A horse","text_i18n":{"fr":"Un cheval","es":"Un caballo","ro":"Un cal"}},{"index":2,"text_ar":"سمكة","text_en":"A fish","text_i18n":{"fr":"Un poisson","es":"Un pez","ro":"Un pește"}},{"index":3,"text_ar":"بطريق","text_en":"A penguin","text_i18n":{"fr":"Un pingouin","es":"Un pingüino","ro":"Un pinguin"}}]'::jsonb,
  note_ar   = 'أبو الهول منحوت من صخرة واحدة، طوله حوالي ٧٣ متر، وله وش إنسان وجسم أسد.',
  note_en   = 'The Sphinx is carved from one piece of rock — about 73 metres of lion with a human head.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 13;

update public.questions set
  text_i18n = '{"fr":"Qui a fondé Alexandrie ?","es":"¿Quién fundó Alejandría?","ro":"Cine a fondat Alexandria?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great","text_i18n":{"fr":"Alexandre le Grand","es":"Alejandro Magno","ro":"Alexandru cel Mare"}},{"index":1,"text_ar":"يوليوس قيصر","text_en":"Julius Caesar","text_i18n":{"fr":"Jules César","es":"Julio César","ro":"Iulius Cezar"}},{"index":2,"text_ar":"نابليون","text_en":"Napoleon","text_i18n":{"fr":"Napoléon","es":"Napoleón","ro":"Napoleon"}},{"index":3,"text_ar":"راجل اسمه إسكندر، طبعًا","text_en":"A man called Alex, obviously","text_i18n":{"fr":"Un type qui s''appelait Alex, évidemment","es":"Un tal Alex, claro","ro":"Un tip pe nume Alex, evident"}}]'::jsonb,
  note_ar   = 'الإسكندر بنى الإسكندرية سنة ٣٣١ قبل الميلاد وسماها على اسمه.',
  note_en   = 'Alexander founded Alexandria in 331 BC and named it after himself.',
  note_i18n = '{}'::jsonb
 where pack_id = 'aaaa7777-0000-4000-8000-000000000001' and order_index = 14;

-- These fifteen were written with the right answer first, like every
-- other question in the game. Deal them.
select public.lamma_spread_answers();

notify pgrst, 'reload schema';
