-- ═══════════════════════════════════════════════════════════════════
--  لمّة · EGYPT IN SIX LANGUAGES, AND A HONEST SCORE OUT OF IT
--
--  ── THE PROBLEM ──────────────────────────────────────────────────
--  "Do You Know Egypt?" existed in Arabic and English. A room with a
--  Romanian, a Spaniard and a French speaker in it played in their
--  second or third language, against Egyptians playing in their first.
--  That is not a hard game, it is an unfair one, and the fun goes out
--  of it by question three.
--
--  So the whole pack — every question and all four options of each —
--  is now written in French, Spanish and Romanian too. Written, not
--  machine-translated: a quiz option that drifts a shade in meaning is
--  a second right answer, and the argument afterwards is the bad kind.
--
--  Six choices, and why there are not seven: Moldova's official
--  language IS Romanian. Offering "Moldovan" as a separate button
--  would show the identical words twice and pretend otherwise, so the
--  Romanian option is labelled for both and means it.
--
--  ── HOW A LANGUAGE IS STORED ─────────────────────────────────────
--  text_ar and text_en are columns because they came first and half
--  the app reads them by name. Everything after them lives in one
--  jsonb — text_i18n {"fr":…,"es":…,"ro":…} — on the question and
--  inside each option. A seventh language is then a row update and no
--  migration at all, which is the whole point.
--
--  Resolution order, in the app: your language → English → Arabic.
--  A pack written in only one language still PLAYS rather than showing
--  a blank question over four blank tiles.
--
--  ── AND THE RANKING HE ASKED FOR ─────────────────────────────────
--  lamma_room_results returns, for everybody in the room, how many
--  they actually got RIGHT out of how many the pack asked. Not the
--  score — the score rewards being fast, and being fast is not the
--  same as being Egyptian. Right answers out of total questions, from
--  answers.is_correct, which the server wrote and no phone can touch.
--
--  Missing a question counts against you, because the denominator is
--  the pack and not what you happened to answer. Walking in late
--  should not make you more Egyptian.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- ── A LANGUAGE IS A KEY, NOT A COLUMN ──────────────────────────────
alter table public.questions add column if not exists text_i18n jsonb;

update public.questions set
  text_i18n = '{"fr": "À quoi servaient les pyramides à l''origine ?", "es": "¿Para qué se construyeron las pirámides?", "ro": "Pentru ce au fost construite piramidele?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"مقابر للملوك","text_en":"Tombs for kings","text_i18n":{"fr":"Des tombeaux pour les rois","es":"Tumbas para los reyes","ro":"Morminte pentru regi"}},{"index":1,"text_ar":"مخازن قمح","text_en":"Grain warehouses","text_i18n":{"fr":"Des entrepôts à grain","es":"Almacenes de grano","ro":"Depozite de grâne"}},{"index":2,"text_ar":"بيوت للمصيف","text_en":"Holiday homes","text_i18n":{"fr":"Des maisons de vacances","es":"Casas de vacaciones","ro":"Case de vacanță"}},{"index":3,"text_ar":"جراج متعدد الطوابق","text_en":"A multi-storey car park","text_i18n":{"fr":"Un parking à étages","es":"Un aparcamiento de varias plantas","ro":"O parcare supraetajată"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 0;

update public.questions set
  text_i18n = '{"fr": "Quel fleuve traverse l''Égypte ?", "es": "¿Qué río pasa por Egipto?", "ro": "Ce râu trece prin Egipt?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"النيل","text_en":"The Nile","text_i18n":{"fr":"Le Nil","es":"El Nilo","ro":"Nilul"}},{"index":1,"text_ar":"الأمازون","text_en":"The Amazon","text_i18n":{"fr":"L''Amazone","es":"El Amazonas","ro":"Amazonul"}},{"index":2,"text_ar":"التيمز","text_en":"The Thames","text_i18n":{"fr":"La Tamise","es":"El Támesis","ro":"Tamisa"}},{"index":3,"text_ar":"الدانوب","text_en":"The Danube","text_i18n":{"fr":"Le Danube","es":"El Danubio","ro":"Dunărea"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 1;

update public.questions set
  text_i18n = '{"fr": "Quelle est la capitale de l''Égypte ?", "es": "¿Cuál es la capital de Egipto?", "ro": "Care e capitala Egiptului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"القاهرة","text_en":"Cairo","text_i18n":{"fr":"Le Caire","es":"El Cairo","ro":"Cairo"}},{"index":1,"text_ar":"الإسكندرية","text_en":"Alexandria","text_i18n":{"fr":"Alexandrie","es":"Alejandría","ro":"Alexandria"}},{"index":2,"text_ar":"الأقصر","text_en":"Luxor","text_i18n":{"fr":"Louxor","es":"Luxor","ro":"Luxor"}},{"index":3,"text_ar":"شرم الشيخ","text_en":"Sharm El-Sheikh","text_i18n":{"fr":"Charm el-Cheikh","es":"Sharm el-Sheij","ro":"Sharm El-Sheikh"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 2;

update public.questions set
  text_i18n = '{"fr": "Qui était Toutânkhamon ?", "es": "¿Quién fue Tutankamón?", "ro": "Cine a fost Tutankhamon?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"فرعون بقى ملك وهو صغير","text_en":"A pharaoh who became king as a boy","text_i18n":{"fr":"Un pharaon devenu roi enfant","es":"Un faraón que fue rey siendo niño","ro":"Un faraon care a devenit rege de copil"}},{"index":1,"text_ar":"شاعر يوناني","text_en":"A Greek poet","text_i18n":{"fr":"Un poète grec","es":"Un poeta griego","ro":"Un poet grec"}},{"index":2,"text_ar":"رحّالة إيطالي","text_en":"An Italian explorer","text_i18n":{"fr":"Un explorateur italien","es":"Un explorador italiano","ro":"Un explorator italian"}},{"index":3,"text_ar":"ماركة صنادل","text_en":"A brand of sandals","text_i18n":{"fr":"Une marque de sandales","es":"Una marca de sandalias","ro":"O marcă de sandale"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 3;

update public.questions set
  text_i18n = '{"fr": "Qui a trouvé le tombeau de Toutânkhamon en 1922 ?", "es": "¿Quién encontró la tumba de Tutankamón en 1922?", "ro": "Cine a găsit mormântul lui Tutankhamon în 1922?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"هوارد كارتر","text_en":"Howard Carter","text_i18n":{"fr":"Howard Carter","es":"Howard Carter","ro":"Howard Carter"}},{"index":1,"text_ar":"نابليون","text_en":"Napoleon","text_i18n":{"fr":"Napoléon","es":"Napoleón","ro":"Napoleon"}},{"index":2,"text_ar":"ماركو بولو","text_en":"Marco Polo","text_i18n":{"fr":"Marco Polo","es":"Marco Polo","ro":"Marco Polo"}},{"index":3,"text_ar":"لسه محدش لقاها","text_en":"Nobody. It is still missing","text_i18n":{"fr":"Personne, il manque toujours","es":"Nadie, sigue perdida","ro":"Nimeni, încă lipsește"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 4;

update public.questions set
  text_i18n = '{"fr": "Cléopâtre fut la dernière quoi ?", "es": "¿Cleopatra fue la última qué?", "ro": "Cleopatra a fost ultima ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"حاكمة لمصر القديمة","text_en":"Ruler of ancient Egypt","text_i18n":{"fr":"Souveraine de l''Égypte antique","es":"Gobernante del antiguo Egipto","ro":"Conducătoare a Egiptului antic"}},{"index":1,"text_ar":"إمبراطورة رومانية","text_en":"Roman empress","text_i18n":{"fr":"Impératrice romaine","es":"Emperatriz romana","ro":"Împărăteasă romană"}},{"index":2,"text_ar":"ملكة إسبانيا","text_en":"Queen of Spain","text_i18n":{"fr":"Reine d''Espagne","es":"Reina de España","ro":"Regină a Spaniei"}},{"index":3,"text_ar":"واحدة ترد على الرسايل","text_en":"Person to answer her messages","text_i18n":{"fr":"Personne à répondre à ses messages","es":"Persona en responder sus mensajes","ro":"Persoană care să-și citească mesajele"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 5;

update public.questions set
  text_i18n = '{"fr": "Le Sphinx a le corps de quel animal ?", "es": "¿El cuerpo de la Esfinge es de qué animal?", "ro": "Sfinxul are corpul cărui animal?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أسد","text_en":"A lion","text_i18n":{"fr":"Un lion","es":"Un león","ro":"Un leu"}},{"index":1,"text_ar":"حصان","text_en":"A horse","text_i18n":{"fr":"Un cheval","es":"Un caballo","ro":"Un cal"}},{"index":2,"text_ar":"سمكة","text_en":"A fish","text_i18n":{"fr":"Un poisson","es":"Un pez","ro":"Un pește"}},{"index":3,"text_ar":"بطريق","text_en":"A penguin","text_i18n":{"fr":"Un pingouin","es":"Un pingüino","ro":"Un pinguin"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 6;

update public.questions set
  text_i18n = '{"fr": "Que sont les hiéroglyphes ?", "es": "¿Qué son los jeroglíficos?", "ro": "Ce sunt hieroglifele?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"كتابة مصرية قديمة","text_en":"Ancient Egyptian writing","text_i18n":{"fr":"L''écriture de l''Égypte antique","es":"La escritura del antiguo Egipto","ro":"Scrierea Egiptului antic"}},{"index":1,"text_ar":"نوع مكرونة","text_en":"A kind of pasta","text_i18n":{"fr":"Une sorte de pâtes","es":"Un tipo de pasta","ro":"Un fel de paste"}},{"index":2,"text_ar":"رقصة","text_en":"A dance","text_i18n":{"fr":"Une danse","es":"Un baile","ro":"Un dans"}},{"index":3,"text_ar":"آلة موسيقية","text_en":"A musical instrument","text_i18n":{"fr":"Un instrument de musique","es":"Un instrumento musical","ro":"Un instrument muzical"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 7;

update public.questions set
  text_i18n = '{"fr": "À quoi la pierre de Rosette a-t-elle servi ?", "es": "¿Para qué sirvió la piedra de Rosetta?", "ro": "La ce a ajutat Piatra din Rosetta?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"يقروا الهيروغليفية","text_en":"Read hieroglyphs","text_i18n":{"fr":"À lire les hiéroglyphes","es":"A leer los jeroglíficos","ro":"La citirea hieroglifelor"}},{"index":1,"text_ar":"يبنوا الأهرامات","text_en":"Build the pyramids","text_i18n":{"fr":"À bâtir les pyramides","es":"A construir las pirámides","ro":"La construirea piramidelor"}},{"index":2,"text_ar":"يلاقوا منبع النيل","text_en":"Find the source of the Nile","text_i18n":{"fr":"À trouver la source du Nil","es":"A hallar la fuente del Nilo","ro":"La găsirea izvorului Nilului"}},{"index":3,"text_ar":"يحلوا خلاف على ماتش","text_en":"Settle an argument about a football match","text_i18n":{"fr":"À trancher une dispute sur un match","es":"A zanjar una discusión sobre un partido","ro":"La încheierea unei certe despre un meci"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 8;

update public.questions set
  text_i18n = '{"fr": "Le canal de Suez relie quoi à quoi ?", "es": "¿El canal de Suez conecta qué con qué?", "ro": "Canalul Suez leagă ce de ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"البحر المتوسط والبحر الأحمر","text_en":"The Mediterranean and the Red Sea","text_i18n":{"fr":"La Méditerranée et la mer Rouge","es":"El Mediterráneo y el mar Rojo","ro":"Marea Mediterană și Marea Roșie"}},{"index":1,"text_ar":"الأطلنطي والهادي","text_en":"The Atlantic and the Pacific","text_i18n":{"fr":"L''Atlantique et le Pacifique","es":"El Atlántico y el Pacífico","ro":"Atlanticul și Pacificul"}},{"index":2,"text_ar":"بحيرتين","text_en":"Two lakes","text_i18n":{"fr":"Deux lacs","es":"Dos lagos","ro":"Două lacuri"}},{"index":3,"text_ar":"مفيش، دي للزينة","text_en":"Nothing. It is decorative","text_i18n":{"fr":"Rien, c''est décoratif","es":"Nada, es decorativo","ro":"Nimic, e decorativ"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 9;

update public.questions set
  text_i18n = '{"fr": "Charm el-Cheikh est connue pour quoi ?", "es": "¿Por qué es famosa Sharm el-Sheij?", "ro": "Pentru ce e cunoscut Sharm El-Sheikh?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الغطس في البحر الأحمر","text_en":"Diving in the Red Sea","text_i18n":{"fr":"La plongée en mer Rouge","es":"El buceo en el mar Rojo","ro":"Scufundările în Marea Roșie"}},{"index":1,"text_ar":"التزلج على الجليد","text_en":"Skiing","text_i18n":{"fr":"Le ski","es":"El esquí","ro":"Schi"}},{"index":2,"text_ar":"غاباتها المطيرة","text_en":"Its rainforests","text_i18n":{"fr":"Ses forêts tropicales","es":"Sus selvas tropicales","ro":"Pădurile ei tropicale"}},{"index":3,"text_ar":"الشفق القطبي","text_en":"The northern lights","text_i18n":{"fr":"Les aurores boréales","es":"Las auroras boreales","ro":"Aurora boreală"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 10;

update public.questions set
  text_i18n = '{"fr": "Qui a fondé Alexandrie ?", "es": "¿Quién fundó Alejandría?", "ro": "Cine a fondat Alexandria?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great","text_i18n":{"fr":"Alexandre le Grand","es":"Alejandro Magno","ro":"Alexandru cel Mare"}},{"index":1,"text_ar":"يوليوس قيصر","text_en":"Julius Caesar","text_i18n":{"fr":"Jules César","es":"Julio César","ro":"Iulius Cezar"}},{"index":2,"text_ar":"نابليون","text_en":"Napoleon","text_i18n":{"fr":"Napoléon","es":"Napoleón","ro":"Napoleon"}},{"index":3,"text_ar":"راجل اسمه إسكندر، طبعًا","text_en":"A man called Alex, obviously","text_i18n":{"fr":"Un type qui s''appelait Alex, évidemment","es":"Un tal Alex, claro","ro":"Un tip pe nume Alex, evident"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 11;

update public.questions set
  text_i18n = '{"fr": "Le phare d''Alexandrie était l''une de quoi ?", "es": "¿El faro de Alejandría era una de qué?", "ro": "Farul din Alexandria era una dintre ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"عجائب الدنيا السبع القديمة","text_en":"The Seven Wonders of the Ancient World","text_i18n":{"fr":"Les sept merveilles du monde antique","es":"Las siete maravillas del mundo antiguo","ro":"Cele șapte minuni ale lumii antice"}},{"index":1,"text_ar":"جبال الألب","text_en":"The Alps","text_i18n":{"fr":"Les Alpes","es":"Los Alpes","ro":"Alpii"}},{"index":2,"text_ar":"الأهرامات","text_en":"The pyramids","text_i18n":{"fr":"Les pyramides","es":"Las pirámides","ro":"Piramidele"}},{"index":3,"text_ar":"سلسلة فنادق","text_en":"A chain of hotels","text_i18n":{"fr":"Une chaîne d''hôtels","es":"Una cadena de hoteles","ro":"Un lanț de hoteluri"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 12;

update public.questions set
  text_i18n = '{"fr": "Mohamed Salah joue pour quelle sélection ?", "es": "¿Mohamed Salah juega en qué selección?", "ro": "Mohamed Salah joacă la ce națională?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"مصر","text_en":"Egypt","text_i18n":{"fr":"L''Égypte","es":"Egipto","ro":"Egipt"}},{"index":1,"text_ar":"البرازيل","text_en":"Brazil","text_i18n":{"fr":"Le Brésil","es":"Brasil","ro":"Brazilia"}},{"index":2,"text_ar":"البرتغال","text_en":"Portugal","text_i18n":{"fr":"Le Portugal","es":"Portugal","ro":"Portugalia"}},{"index":3,"text_ar":"كل بلد على حسب اليوم","text_en":"A different one each week","text_i18n":{"fr":"Une différente chaque semaine","es":"Una distinta cada semana","ro":"Alta în fiecare săptămână"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 13;

update public.questions set
  text_i18n = '{"fr": "Que contient le koshari, le plat national ?", "es": "¿Qué lleva el koshari, el plato nacional?", "ro": "Ce conține koshari, felul național?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"رز وعدس ومكرونة","text_en":"Rice, lentils and pasta","text_i18n":{"fr":"Du riz, des lentilles et des pâtes","es":"Arroz, lentejas y pasta","ro":"Orez, linte și paste"}},{"index":1,"text_ar":"سوشي وصويا","text_en":"Sushi and soy sauce","text_i18n":{"fr":"Des sushis et de la sauce soja","es":"Sushi y salsa de soja","ro":"Sushi și sos de soia"}},{"index":2,"text_ar":"جبنة وريحان","text_en":"Cheese and basil","text_i18n":{"fr":"Du fromage et du basilic","es":"Queso y albahaca","ro":"Brânză și busuioc"}},{"index":3,"text_ar":"أي حاجة لقيتها في المطبخ","text_en":"Whatever was in the kitchen","text_i18n":{"fr":"Ce qui traînait dans la cuisine","es":"Lo que hubiera en la cocina","ro":"Ce era prin bucătărie"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 14;

update public.questions set
  text_i18n = '{"fr": "À quoi servait le papyrus ?", "es": "¿Para qué se usaba el papiro?", "ro": "La ce se folosea papirusul?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"ورق للكتابة","text_en":"Paper to write on","text_i18n":{"fr":"À faire du papier pour écrire","es":"Para hacer papel de escribir","ro":"La făcut hârtie de scris"}},{"index":1,"text_ar":"زجاج","text_en":"Glass","text_i18n":{"fr":"Du verre","es":"Vidrio","ro":"Sticlă"}},{"index":2,"text_ar":"حديد","text_en":"Iron","text_i18n":{"fr":"Du fer","es":"Hierro","ro":"Fier"}},{"index":3,"text_ar":"مطر","text_en":"Rain","text_i18n":{"fr":"De la pluie","es":"Lluvia","ro":"Ploaie"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 15;

update public.questions set
  text_i18n = '{"fr": "La plus grande partie de l''Égypte, c''est quoi ?", "es": "¿La mayor parte de Egipto es qué?", "ro": "Cea mai mare parte a Egiptului este ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"صحرا","text_en":"Desert","text_i18n":{"fr":"Du désert","es":"Desierto","ro":"Deșert"}},{"index":1,"text_ar":"غابات","text_en":"Forest","text_i18n":{"fr":"De la forêt","es":"Bosque","ro":"Pădure"}},{"index":2,"text_ar":"جليد","text_en":"Ice","text_i18n":{"fr":"De la glace","es":"Hielo","ro":"Gheață"}},{"index":3,"text_ar":"مدن ملاهي مائية","text_en":"Water parks","text_i18n":{"fr":"Des parcs aquatiques","es":"Parques acuáticos","ro":"Parcuri acvatice"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 16;

update public.questions set
  text_i18n = '{"fr": "Qu''a créé le haut barrage d''Assouan ?", "es": "¿Qué creó la presa de Asuán?", "ro": "Ce a creat Barajul Aswan?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"بحيرة ناصر","text_en":"Lake Nasser","text_i18n":{"fr":"Le lac Nasser","es":"El lago Nasser","ro":"Lacul Nasser"}},{"index":1,"text_ar":"نهر النيل","text_en":"The river Nile","text_i18n":{"fr":"Le Nil","es":"El río Nilo","ro":"Râul Nil"}},{"index":2,"text_ar":"البحر الأحمر","text_en":"The Red Sea","text_i18n":{"fr":"La mer Rouge","es":"El mar Rojo","ro":"Marea Roșie"}},{"index":3,"text_ar":"زحمة لسه مخلصتش","text_en":"A traffic jam that never ended","text_i18n":{"fr":"Un embouteillage sans fin","es":"Un atasco que no terminó nunca","ro":"Un ambuteiaj care nu s-a mai terminat"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 17;

update public.questions set
  text_i18n = '{"fr": "Les temples d''Abou Simbel ont été bâtis pour qui ?", "es": "¿Para quién se construyeron los templos de Abu Simbel?", "ro": "Pentru cine au fost construite templele de la Abu Simbel?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"رمسيس التاني","text_en":"Ramses II","text_i18n":{"fr":"Ramsès II","es":"Ramsés II","ro":"Ramses al II-lea"}},{"index":1,"text_ar":"نابليون","text_en":"Napoleon","text_i18n":{"fr":"Napoléon","es":"Napoleón","ro":"Napoleon"}},{"index":2,"text_ar":"الإسكندر الأكبر","text_en":"Alexander the Great","text_i18n":{"fr":"Alexandre le Grand","es":"Alejandro Magno","ro":"Alexandru cel Mare"}},{"index":3,"text_ar":"أول واحد طلب","text_en":"Whoever asked first","text_i18n":{"fr":"Le premier qui a demandé","es":"El primero que lo pidió","ro":"Primul care a cerut"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 18;

update public.questions set
  text_i18n = '{"fr": "Comment s''appelle la monnaie égyptienne ?", "es": "¿Cómo se llama la moneda de Egipto?", "ro": "Cum se numește moneda Egiptului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الجنيه المصري","text_en":"The Egyptian pound","text_i18n":{"fr":"La livre égyptienne","es":"La libra egipcia","ro":"Lira egipteană"}},{"index":1,"text_ar":"اليورو","text_en":"The euro","text_i18n":{"fr":"L''euro","es":"El euro","ro":"Euro"}},{"index":2,"text_ar":"الين","text_en":"The yen","text_i18n":{"fr":"Le yen","es":"El yen","ro":"Yenul"}},{"index":3,"text_ar":"جمال، بالكيلو","text_en":"Camels, by weight","text_i18n":{"fr":"Des chameaux, au kilo","es":"Camellos, al peso","ro":"Cămile, la kilogram"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 19;

update public.questions set
  text_i18n = '{"fr": "La grande pyramide de Gizeh a été bâtie pour qui ?", "es": "¿Para quién se construyó la Gran Pirámide de Guiza?", "ro": "Pentru cine a fost construită Marea Piramidă din Giza?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"خوفو","text_en":"Khufu","text_i18n":{"fr":"Khéops","es":"Keops","ro":"Keops"}},{"index":1,"text_ar":"كليوباترا","text_en":"Cleopatra","text_i18n":{"fr":"Cléopâtre","es":"Cleopatra","ro":"Cleopatra"}},{"index":2,"text_ar":"توت عنخ آمون","text_en":"Tutankhamun","text_i18n":{"fr":"Toutânkhamon","es":"Tutankamón","ro":"Tutankhamon"}},{"index":3,"text_ar":"عميل صعب جدًا","text_en":"A very demanding client","text_i18n":{"fr":"Un client très exigeant","es":"Un cliente muy exigente","ro":"Un client foarte pretențios"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 20;

update public.questions set
  text_i18n = '{"fr": "Quelle est la langue officielle de l''Égypte ?", "es": "¿Cuál es el idioma oficial de Egipto?", "ro": "Care e limba oficială a Egiptului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"العربية","text_en":"Arabic","text_i18n":{"fr":"L''arabe","es":"El árabe","ro":"Araba"}},{"index":1,"text_ar":"اللاتينية","text_en":"Latin","text_i18n":{"fr":"Le latin","es":"El latín","ro":"Latina"}},{"index":2,"text_ar":"الهيروغليفية، لسه","text_en":"Hieroglyphs, still","text_i18n":{"fr":"Les hiéroglyphes, encore","es":"Los jeroglíficos, todavía","ro":"Hieroglifele, încă"}},{"index":3,"text_ar":"الإيموچي","text_en":"Emoji","text_i18n":{"fr":"Les emojis","es":"Los emojis","ro":"Emoji"}}]'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 21;

-- ── THE ANSWER-FREE VIEW CARRIES THE NEW LANGUAGES ─────────────────
-- Dropped and rebuilt rather than replaced: "create or replace view"
-- cannot add a column in the middle, and text_i18n belongs next to the
-- other two texts. Nothing in SQL depends on this view; the app reads
-- it by name.
drop view if exists public.lamma_questions_public;
create view public.lamma_questions_public as
  select id, pack_id, order_index, text_ar, text_en, text_i18n,
         media_url, media_type, timer_ms, options, points_style
    from public.questions;
grant select on public.lamma_questions_public to anon, authenticated;

-- ── WHAT THE ROOM IS, TOLD PROPERLY ────────────────────────────────
-- sync() described the game but never said who was running it, so the
-- screen fell back to whatever it believed when it opened: a phone
-- that joined and was later promoted still showed no Start button, and
-- every other phone quietly asked to take the room over every ten
-- seconds because the host it was looking for was not in the list.
-- (The server refused each time, so nothing broke. It was still wrong.)
--
-- It now also says which pack is being played and which country that
-- pack belongs to, so the end of a game can say something true about
-- the country instead of guessing from a title.
create or replace function public.lamma_sync(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  pl public.room_players%rowtype;
  qid uuid;
  answered boolean := false;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  select * into pl from public.room_players where room_id = p_room_id and user_id = me;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_in_room'); end if;

  select id into qid from public.questions
   where pack_id = r.pack_id and order_index = r.current_question_index;
  if qid is not null then
    select true into answered from public.answers
     where room_id = p_room_id and question_id = qid and user_id = me;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', r.status,
    'question_index', r.current_question_index,
    'deadline_at', r.current_deadline_at,
    'server_now', now(),
    'host_user_id', r.host_user_id,
    'pack_id', r.pack_id,
    'pack_country', (select country from public.game_packs where id = r.pack_id),
    'my_score', pl.score,
    'my_streak', pl.streak,
    'already_answered', coalesce(answered, false),
    'leaderboard', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', user_id, 'nickname', nickname,
                                          'score', score, 'best_streak', best_streak,
                                          'is_connected', is_connected)
                       order by score desc, best_streak desc, joined_at asc)
        from public.room_players where room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

-- ── RIGHT ANSWERS, NOT POINTS ──────────────────────────────────────
-- Only for people who were in the room, and only about that room.
create or replace function public.lamma_room_results(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.game_rooms%rowtype;
  total int := 0;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select * into r from public.game_rooms where id = p_room_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_room'); end if;
  if not public.lamma_in_room(p_room_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_in_room');
  end if;

  select count(*) into total from public.questions where pack_id = r.pack_id;

  return jsonb_build_object(
    'ok', true,
    'total', total,
    'country', (select country from public.game_packs where id = r.pack_id),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', p.user_id, 'nickname', p.nickname, 'score', p.score,
               'correct', c.correct, 'answered', c.answered)
             order by c.correct desc, p.score desc, p.joined_at asc)
        from public.room_players p
        cross join lateral (
          select count(*) filter (where a.is_correct) as correct,
                 count(*) as answered
            from public.answers a
           where a.room_id = p.room_id and a.user_id = p.user_id
        ) c
       where p.room_id = p_room_id), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.lamma_room_results(uuid) to authenticated;

notify pgrst, 'reload schema';
