-- ═══════════════════════════════════════════════════════════════════
--  لمّة · THE PART THAT IS NOT IN ANY BOOK
--
--  Ayser: "عايز الناس تضحك و تتعلم اكتر عن مصر و المصريين و الثقافه
--  واللغه وطريقه التعامل."
--
--  Dates and rivers are the easy half. The half that makes somebody
--  say "ah, THAT is why" is the one nobody writes down: what "maalesh"
--  is doing in a sentence, why "bukra" is not exactly tomorrow, what
--  happens to a guest in the first ninety seconds, the three named
--  levels of sugar in a glass of tea, and why the taxi driver is a
--  basha.
--
--  Ten of them, in the five languages, each with the line that
--  explains it afterwards.
--
--  ── AND WHO THE JOKE IS ON ───────────────────────────────────────
--  Nobody. It is Egyptians laughing at things Egyptians do — the
--  elastic hour, the insisting on more food, the haggling that both
--  sides enjoy — which is a different thing from being laughed at. No
--  question here works by making somebody the fool for being Egyptian,
--  and none of the wrong answers is a caricature of anybody.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index >= 43;

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('eeee5555-0000-4000-8000-000000000001',43,'كلمة «معلش» بتتقال إمتى؟','When does an Egyptian say “maalesh”?',20000,
 '[{"index":0,"text_ar":"في كل حاجة — أسف، ولا يهمك، وشد حيلك","text_en":"For almost anything — sorry, never mind, and cheer up"},{"index":1,"text_ar":"في المطار بس","text_en":"Only at the airport"},{"index":2,"text_ar":"لما يكسب فلوس","text_en":"Only when they win money"},{"index":3,"text_ar":"مبتتقالش خالص","text_en":"It is never said"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',44,'لو مصري قالك «بكرة»، غالبًا يقصد إيه؟','If an Egyptian says “bukra” (tomorrow), what do they usually mean?',20000,
 '[{"index":0,"text_ar":"قريب — مش بالضرورة بكرة بالظبط","text_en":"Soon — not necessarily tomorrow exactly"},{"index":1,"text_ar":"بعد ٢٤ ساعة بالثانية","text_en":"Exactly 24 hours from now"},{"index":2,"text_ar":"عمره ما هيحصل","text_en":"It will never happen"},{"index":3,"text_ar":"حالًا","text_en":"Right now"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',45,'ضيف دخل بيت مصري. إيه اللي هيحصل أول حاجة؟','A guest walks into an Egyptian home. What happens first?',20000,
 '[{"index":0,"text_ar":"أكل وشرب، وإصرار إنه ياكل تاني","text_en":"Food and drink appear, and insistence that he eats more"},{"index":1,"text_ar":"يملا استمارة","text_en":"He fills in a form"},{"index":2,"text_ar":"يستنى في الصالة لوحده","text_en":"He waits alone in the hall"},{"index":3,"text_ar":"يدفع دخول","text_en":"He pays an entrance fee"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',46,'«الشاي مظبوط» يعني إيه؟','In Egypt, tea “mazbout” means what?',20000,
 '[{"index":0,"text_ar":"سكر متوسط","text_en":"Medium sugar"},{"index":1,"text_ar":"من غير سكر","text_en":"No sugar at all"},{"index":2,"text_ar":"بالحليب","text_en":"With milk"},{"index":3,"text_ar":"بارد","text_en":"Cold"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',47,'في الشارع، مصري بينادي على حد مايعرفوش بإيه؟','In the street, what does an Egyptian call a stranger?',20000,
 '[{"index":0,"text_ar":"بلقب فخم: يا باشا، يا هندسة، يا دكتور","text_en":"A grand title: basha, handasa, doctor"},{"index":1,"text_ar":"برقمه القومي","text_en":"By his ID number"},{"index":2,"text_ar":"مبيناديش أصلاً","text_en":"They do not call out at all"},{"index":3,"text_ar":"يصفر","text_en":"By whistling"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',48,'لو حد جمع صوابعه ورفع إيده كده 👌 في مصر، يعني إيه؟','Fingers pinched together, hand raised — what does that mean in Egypt?',20000,
 '[{"index":0,"text_ar":"استنى شوية","text_en":"Wait a moment"},{"index":1,"text_ar":"الأكل حلو","text_en":"The food is good"},{"index":2,"text_ar":"روح من هنا","text_en":"Go away"},{"index":3,"text_ar":"أنا مش فاهم","text_en":"I do not understand"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',49,'لو سألت مصري «إزيك؟» غالبًا يرد بإيه؟','Ask an Egyptian “ezzayak?” (how are you?) — the usual answer is:',20000,
 '[{"index":0,"text_ar":"الحمد لله","text_en":"Al-hamdu lillah — thank God"},{"index":1,"text_ar":"بشرح مفصل لليوم كله","text_en":"A full account of their whole day"},{"index":2,"text_ar":"مبيردش","text_en":"They do not answer"},{"index":3,"text_ar":"بسؤال عن الطقس","text_en":"A question about the weather"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',50,'في فرح مصري، الزغروتة إيه؟','At an Egyptian wedding, what is a zaghrouta?',20000,
 '[{"index":0,"text_ar":"صوت فرح عالي بتطلعه الستات باللسان","text_en":"A high trilling cry of joy, made by the women"},{"index":1,"text_ar":"نوع من الحلويات","text_en":"A kind of sweet"},{"index":2,"text_ar":"رقصة للعريس لوحده","text_en":"A dance for the groom alone"},{"index":3,"text_ar":"هدية فلوس","text_en":"A gift of money"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',51,'«تسلم إيدك» بتتقال لمين؟','Who do you say “teslam eedak” to?',20000,
 '[{"index":0,"text_ar":"لحد عمل حاجة بإيده — طبخ أو صلّح أو رسم","text_en":"To somebody who made something with their hands — cooked, fixed, drew"},{"index":1,"text_ar":"للي بيمشي بسرعة","text_en":"To somebody walking fast"},{"index":2,"text_ar":"للي خسر","text_en":"To somebody who lost"},{"index":3,"text_ar":"للي بينام بدري","text_en":"To somebody who sleeps early"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',52,'في السوق المصري، السعر الأول معناه إيه؟','In an Egyptian market, what is the first price?',20000,
 '[{"index":0,"text_ar":"بداية الكلام — الفصال متوقع","text_en":"The opening of a conversation — haggling is expected"},{"index":1,"text_ar":"السعر النهائي","text_en":"The final price"},{"index":2,"text_ar":"سعر الجملة","text_en":"The wholesale price"},{"index":3,"text_ar":"غلط مطبعي","text_en":"A typing mistake"}]',0,'double');

update public.questions set
  text_i18n = '{"fr": "Quand un Égyptien dit-il « maalesh » ?", "es": "¿Cuándo dice un egipcio “maalesh”?", "ro": "Când spune un egiptean „maalesh”?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"في كل حاجة — أسف، ولا يهمك، وشد حيلك","text_en":"For almost anything — sorry, never mind, and cheer up","text_i18n":{"fr":"Pour à peu près tout : pardon, tant pis, courage","es":"Para casi todo: perdón, no pasa nada, ánimo","ro":"Pentru aproape orice: scuze, nu-i nimic, hai că trece"}},{"index":1,"text_ar":"في المطار بس","text_en":"Only at the airport","text_i18n":{"fr":"Seulement à l’aéroport","es":"Solo en el aeropuerto","ro":"Doar la aeroport"}},{"index":2,"text_ar":"لما يكسب فلوس","text_en":"Only when they win money","text_i18n":{"fr":"Seulement en gagnant de l’argent","es":"Solo al ganar dinero","ro":"Doar când câștigă bani"}},{"index":3,"text_ar":"مبتتقالش خالص","text_en":"It is never said","text_i18n":{"fr":"Elle ne se dit jamais","es":"No se dice nunca","ro":"Nu se spune niciodată"}}]'::jsonb,
  note_ar   = 'كلمة واحدة بتشيل اعتذار وتهوين ومواساة — على حسب نبرة الصوت.',
  note_en   = 'One word carrying apology, reassurance and sympathy — the tone decides which.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 43;

update public.questions set
  text_i18n = '{"fr": "Si un Égyptien dit « bukra » (demain), il veut dire quoi ?", "es": "Si un egipcio dice “bukra” (mañana), ¿qué suele querer decir?", "ro": "Dacă un egiptean spune „bukra” (mâine), ce vrea să zică de obicei?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"قريب — مش بالضرورة بكرة بالظبط","text_en":"Soon — not necessarily tomorrow exactly","text_i18n":{"fr":"Bientôt — pas forcément demain","es":"Pronto, no necesariamente mañana","ro":"Curând — nu neapărat mâine"}},{"index":1,"text_ar":"بعد ٢٤ ساعة بالثانية","text_en":"Exactly 24 hours from now","text_i18n":{"fr":"Dans exactement 24 heures","es":"Exactamente en 24 horas","ro":"Exact peste 24 de ore"}},{"index":2,"text_ar":"عمره ما هيحصل","text_en":"It will never happen","text_i18n":{"fr":"Cela n’arrivera jamais","es":"No pasará nunca","ro":"Nu se va întâmpla niciodată"}},{"index":3,"text_ar":"حالًا","text_en":"Right now","text_i18n":{"fr":"Tout de suite","es":"Ahora mismo","ro":"Chiar acum"}}]'::jsonb,
  note_ar   = 'الوقت في مصر مطاطي شوية، والنية حقيقية حتى لو الميعاد مش دقيق.',
  note_en   = 'Time is elastic; the intention is real even when the hour is not.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 44;

update public.questions set
  text_i18n = '{"fr": "Un invité entre dans une maison égyptienne. Que se passe-t-il d’abord ?", "es": "Un invitado entra en una casa egipcia. ¿Qué pasa primero?", "ro": "Un oaspete intră într-o casă egipteană. Ce se întâmplă întâi?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"أكل وشرب، وإصرار إنه ياكل تاني","text_en":"Food and drink appear, and insistence that he eats more","text_i18n":{"fr":"On apporte à manger et à boire, et on insiste pour resservir","es":"Aparecen comida y bebida, y se insiste en repetir","ro":"Apar mâncare și băutură, și insistă să mai mănânce"}},{"index":1,"text_ar":"يملا استمارة","text_en":"He fills in a form","text_i18n":{"fr":"Il remplit un formulaire","es":"Rellena un formulario","ro":"Completează un formular"}},{"index":2,"text_ar":"يستنى في الصالة لوحده","text_en":"He waits alone in the hall","text_i18n":{"fr":"Il attend seul dans l’entrée","es":"Espera solo en el recibidor","ro":"Așteaptă singur pe hol"}},{"index":3,"text_ar":"يدفع دخول","text_en":"He pays an entrance fee","text_i18n":{"fr":"Il paie l’entrée","es":"Paga la entrada","ro":"Plătește intrarea"}}]'::jsonb,
  note_ar   = 'رفض الأكل مرة أو اتنين متوقع — الكرم بيصر، والضيف بيكسر.',
  note_en   = 'Refusing once or twice is expected: the host insists, the guest gives in.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 45;

update public.questions set
  text_i18n = '{"fr": "En Égypte, un thé « mazbout », c’est quoi ?", "es": "En Egipto, un té “mazbout” ¿qué es?", "ro": "În Egipt, un ceai „mazbout” înseamnă ce?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"سكر متوسط","text_en":"Medium sugar","text_i18n":{"fr":"Sucré comme il faut","es":"Con azúcar medio","ro":"Cu zahăr potrivit"}},{"index":1,"text_ar":"من غير سكر","text_en":"No sugar at all","text_i18n":{"fr":"Sans sucre","es":"Sin azúcar","ro":"Fără zahăr"}},{"index":2,"text_ar":"بالحليب","text_en":"With milk","text_i18n":{"fr":"Avec du lait","es":"Con leche","ro":"Cu lapte"}},{"index":3,"text_ar":"بارد","text_en":"Cold","text_i18n":{"fr":"Froid","es":"Frío","ro":"Rece"}}]'::jsonb,
  note_ar   = 'مظبوط، سكر زيادة، وعلى الريحة — تلات درجات للسكر لهم أسماء.',
  note_en   = 'Mazbout, ziyada and “ala er-reeha” — three named levels of sugar.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 46;

update public.questions set
  text_i18n = '{"fr": "Dans la rue, comment un Égyptien interpelle-t-il un inconnu ?", "es": "En la calle, ¿cómo llama un egipcio a un desconocido?", "ro": "Pe stradă, cum i se adresează un egiptean unui necunoscut?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"بلقب فخم: يا باشا، يا هندسة، يا دكتور","text_en":"A grand title: basha, handasa, doctor","text_i18n":{"fr":"Par un grand titre : bacha, ingénieur, docteur","es":"Con un título grande: bacha, ingeniero, doctor","ro":"Cu un titlu mare: pașă, inginer, doctor"}},{"index":1,"text_ar":"برقمه القومي","text_en":"By his ID number","text_i18n":{"fr":"Par son numéro d’identité","es":"Por su número de identidad","ro":"Cu numărul de buletin"}},{"index":2,"text_ar":"مبيناديش أصلاً","text_en":"They do not call out at all","text_i18n":{"fr":"On n’interpelle personne","es":"No se llama a nadie","ro":"Nu strigă pe nimeni"}},{"index":3,"text_ar":"يصفر","text_en":"By whistling","text_i18n":{"fr":"En sifflant","es":"Silbando","ro":"Fluierând"}}]'::jsonb,
  note_ar   = 'الألقاب دي مجاملة مش وظيفة — والباشا ممكن يكون سواق التاكسي.',
  note_en   = 'The titles are courtesy, not job descriptions — the basha may be your driver.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 47;

update public.questions set
  text_i18n = '{"fr": "Doigts joints, main levée — qu’est-ce que ça veut dire en Égypte ?", "es": "Dedos juntos, mano levantada: ¿qué significa en Egipto?", "ro": "Degete strânse, mâna ridicată — ce înseamnă în Egipt?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"استنى شوية","text_en":"Wait a moment","text_i18n":{"fr":"Attends un instant","es":"Espera un momento","ro":"Așteaptă puțin"}},{"index":1,"text_ar":"الأكل حلو","text_en":"The food is good","text_i18n":{"fr":"C’est délicieux","es":"La comida está buena","ro":"Mâncarea e bună"}},{"index":2,"text_ar":"روح من هنا","text_en":"Go away","text_i18n":{"fr":"Va-t’en","es":"Vete","ro":"Pleacă"}},{"index":3,"text_ar":"أنا مش فاهم","text_en":"I do not understand","text_i18n":{"fr":"Je ne comprends pas","es":"No entiendo","ro":"Nu înțeleg"}}]'::jsonb,
  note_ar   = 'الإيد بتتكلم في مصر — والحركة دي معناها اصبر لحظة.',
  note_en   = 'Hands talk in Egypt, and this one means: give me a second.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 48;

update public.questions set
  text_i18n = '{"fr": "Demandez « ezzayak ? » à un Égyptien — la réponse habituelle est :", "es": "Pregunta “ezzayak” a un egipcio: la respuesta habitual es", "ro": "Întreabă un egiptean „ezzayak?” — răspunsul obișnuit e:"}'::jsonb,
  options   = '[{"index":0,"text_ar":"الحمد لله","text_en":"Al-hamdu lillah — thank God","text_i18n":{"fr":"Al-hamdou lillah — Dieu merci","es":"Al-hamdu lillah: gracias a Dios","ro":"Al-hamdu lillah — slavă Domnului"}},{"index":1,"text_ar":"بشرح مفصل لليوم كله","text_en":"A full account of their whole day","text_i18n":{"fr":"Le récit complet de sa journée","es":"Un relato completo de su día","ro":"Toată ziua, în detaliu"}},{"index":2,"text_ar":"مبيردش","text_en":"They do not answer","text_i18n":{"fr":"Il ne répond pas","es":"No responde","ro":"Nu răspunde"}},{"index":3,"text_ar":"بسؤال عن الطقس","text_en":"A question about the weather","text_i18n":{"fr":"Une question sur la météo","es":"Una pregunta sobre el tiempo","ro":"O întrebare despre vreme"}}]'::jsonb,
  note_ar   = 'الرد ده بيتقال في الفرح والزنقة — وبعده بس بتعرف الحقيقة.',
  note_en   = 'Said in good times and bad; the real answer comes after it.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 49;

update public.questions set
  text_i18n = '{"fr": "Dans un mariage égyptien, qu’est-ce qu’une zaghrouta ?", "es": "En una boda egipcia, ¿qué es una zaghrouta?", "ro": "La o nuntă egipteană, ce e o zaghrouta?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"صوت فرح عالي بتطلعه الستات باللسان","text_en":"A high trilling cry of joy, made by the women","text_i18n":{"fr":"Un youyou aigu poussé par les femmes","es":"Un grito agudo de alegría que hacen las mujeres","ro":"Un strigăt ascuțit de bucurie, scos de femei"}},{"index":1,"text_ar":"نوع من الحلويات","text_en":"A kind of sweet","text_i18n":{"fr":"Une pâtisserie","es":"Un dulce","ro":"Un fel de dulce"}},{"index":2,"text_ar":"رقصة للعريس لوحده","text_en":"A dance for the groom alone","text_i18n":{"fr":"Une danse du marié seul","es":"Un baile solo del novio","ro":"Un dans doar al mirelui"}},{"index":3,"text_ar":"هدية فلوس","text_en":"A gift of money","text_i18n":{"fr":"Un cadeau en argent","es":"Un regalo de dinero","ro":"Un cadou în bani"}}]'::jsonb,
  note_ar   = 'الزغروتة مش في الأفراح بس — بتطلع في النجاح والرجوع بالسلامة كمان.',
  note_en   = 'Not only at weddings — also for exam results and safe returns.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 50;

update public.questions set
  text_i18n = '{"fr": "À qui dit-on « teslam eedak » ?", "es": "¿A quién se le dice “teslam eedak”?", "ro": "Cui îi spui „teslam eedak”?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"لحد عمل حاجة بإيده — طبخ أو صلّح أو رسم","text_en":"To somebody who made something with their hands — cooked, fixed, drew","text_i18n":{"fr":"À qui a fait quelque chose de ses mains : cuisiné, réparé, dessiné","es":"A quien ha hecho algo con las manos: cocinar, arreglar, dibujar","ro":"Cuiva care a făcut ceva cu mâinile: a gătit, a reparat, a desenat"}},{"index":1,"text_ar":"للي بيمشي بسرعة","text_en":"To somebody walking fast","text_i18n":{"fr":"À qui marche vite","es":"A quien camina rápido","ro":"Cuiva care merge repede"}},{"index":2,"text_ar":"للي خسر","text_en":"To somebody who lost","text_i18n":{"fr":"À qui a perdu","es":"A quien ha perdido","ro":"Cuiva care a pierdut"}},{"index":3,"text_ar":"للي بينام بدري","text_en":"To somebody who sleeps early","text_i18n":{"fr":"À qui se couche tôt","es":"A quien se acuesta temprano","ro":"Cuiva care se culcă devreme"}}]'::jsonb,
  note_ar   = 'حرفيًا «سلمت يداك» — أعلى شكر لمجهود إيد إنسان.',
  note_en   = 'Literally “may your hands be safe” — the highest thanks for handiwork.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 51;

update public.questions set
  text_i18n = '{"fr": "Sur un marché égyptien, que vaut le premier prix annoncé ?", "es": "En un mercado egipcio, ¿qué es el primer precio?", "ro": "Într-o piață egipteană, ce e primul preț?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"بداية الكلام — الفصال متوقع","text_en":"The opening of a conversation — haggling is expected","text_i18n":{"fr":"Le début de la conversation : on marchande","es":"El inicio de la conversación: se regatea","ro":"Începutul conversației — se negociază"}},{"index":1,"text_ar":"السعر النهائي","text_en":"The final price","text_i18n":{"fr":"Le prix final","es":"El precio final","ro":"Prețul final"}},{"index":2,"text_ar":"سعر الجملة","text_en":"The wholesale price","text_i18n":{"fr":"Le prix de gros","es":"El precio al por mayor","ro":"Prețul en gros"}},{"index":3,"text_ar":"غلط مطبعي","text_en":"A typing mistake","text_i18n":{"fr":"Une faute de frappe","es":"Una errata","ro":"O greșeală de tipar"}}]'::jsonb,
  note_ar   = 'الفصال جزء من التعامل، ومحدش بيزعل منه — بس بابتسامة.',
  note_en   = 'Haggling is part of the exchange, and nobody minds — with a smile.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 52;

update public.game_packs set
  description_ar = 'تاريخ وجغرافيا وأكل وكورة وأمثال وعادات — ١٥ سؤال كل جولة',
  description_en = 'History, geography, food, football, sayings and habits — 15 a round'
 where id = 'eeee5555-0000-4000-8000-000000000001';

notify pgrst, 'reload schema';
