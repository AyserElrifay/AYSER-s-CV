-- ═══════════════════════════════════════════════════════════════════
--  لمّة · A KAHOOT PER COUNTRY — starting with Egypt
--
--  A pack now belongs to a place. Egypt first, because that is where
--  the people are, and because a quiz written by somebody who lives
--  somewhere is always better than a quiz written about it.
--
--  Two kinds of pack, and the difference matters:
--    country = 'EG'  → for people who know Egypt
--    country = null  → everybody, everywhere (World Football, Europe…)
--  The hub shows your country's packs first and the worldwide ones
--  always, so a room with an Egyptian and a Romanian in it still has
--  something both of them can win.
--
--  ── ON MAKING IT FUNNY ──────────────────────────────────────────
--  A quiz still has to have a right answer, so the joke cannot live in
--  the question — a question with four defensible answers is not funny,
--  it is broken, and the argument afterwards is not the good kind.
--
--  So the fact is real and the WRONG answers are the joke. You read
--  four options, three of them are ridiculous, and the laugh happens
--  before you tap. Kahoot works exactly this way and it is the only
--  version of "funny quiz" that survives contact with a scoreboard.
--
--  Nothing here is at anybody's expense. No weight, no money, no
--  religion, no families, no accents, nobody's mother. Egyptians
--  laughing at microbuses and at how long "بكرة" really takes is a
--  joke everybody in the room is inside. That line is deliberate and
--  it stays.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.game_packs add column if not exists country text;
create index if not exists game_packs_country_idx on public.game_packs (country, is_official);

-- where the existing packs belong
update public.game_packs set country = 'EG'
 where id::text like 'aaaa1111%';
update public.game_packs set country = null
 where id::text like 'bbbb2222%';        -- everybody

-- ── مصر · بجد؟ / Egypt, honestly ────────────────────────────────────
delete from public.game_packs where id = 'cccc3333-0000-4000-8000-000000000001';

insert into public.game_packs (id, title_ar, title_en, description_ar, description_en, category, country, locale, is_official, visibility) values
 ('cccc3333-0000-4000-8000-000000000001','مصر… بجد؟','Egypt, honestly',
  'أسئلة سهلة وإجابات غلط مضحكة','Real questions. Three ridiculous answers and one true one.',
  'fun','EG','ar-EG',true,'public');

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('cccc3333-0000-4000-8000-000000000001',0,'الكشري فيه إيه؟','What is in koshari?',20000,
 '[{"index":0,"text_ar":"رز وعدس ومكرونة","text_en":"Rice, lentils and pasta"},{"index":1,"text_ar":"سوشي وصويا","text_en":"Sushi and soy sauce"},{"index":2,"text_ar":"جبنة موتزاريلا وريحان","text_en":"Mozzarella and basil"},{"index":3,"text_ar":"أي حاجة لقيتها في المطبخ","text_en":"Whatever was in the kitchen"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',1,'الأهرامات موجودة فين؟','Where are the pyramids?',20000,
 '[{"index":0,"text_ar":"الجيزة","text_en":"Giza"},{"index":1,"text_ar":"شرم الشيخ","text_en":"Sharm El-Sheikh"},{"index":2,"text_ar":"في الصور بس","text_en":"Only in photos"},{"index":3,"text_ar":"ورا بيتنا","text_en":"Behind our house"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',2,'النيل بيصب في إيه؟','Where does the Nile empty into?',20000,
 '[{"index":0,"text_ar":"البحر المتوسط","text_en":"The Mediterranean"},{"index":1,"text_ar":"المحيط الهادي","text_en":"The Pacific"},{"index":2,"text_ar":"حمام سباحة كبير","text_en":"A very large swimming pool"},{"index":3,"text_ar":"محدش يعرف","text_en":"Nobody knows"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',3,'قمر الدين معمول من إيه؟','What is qamar al-din made from?',20000,
 '[{"index":0,"text_ar":"مشمش","text_en":"Apricots"},{"index":1,"text_ar":"طوب أحمر","text_en":"Red bricks"},{"index":2,"text_ar":"بطيخ","text_en":"Watermelon"},{"index":3,"text_ar":"القمر نفسه","text_en":"The actual moon"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',4,'شم النسيم بياكلوا فيه إيه؟','What do people eat on Sham El-Nessim?',20000,
 '[{"index":0,"text_ar":"فسيخ ورنجة","text_en":"Feseekh and herring"},{"index":1,"text_ar":"سوشي","text_en":"Sushi"},{"index":2,"text_ar":"كورن فليكس","text_en":"Cornflakes"},{"index":3,"text_ar":"أي حاجة ريحتها أهدى","text_en":"Anything that smells calmer"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',5,'برج القاهرة في أي جزيرة؟','Which island is the Cairo Tower on?',20000,
 '[{"index":0,"text_ar":"الزمالك","text_en":"Zamalek"},{"index":1,"text_ar":"هاواي","text_en":"Hawaii"},{"index":2,"text_ar":"جزيرة الكنز","text_en":"Treasure Island"},{"index":3,"text_ar":"مش جزيرة أصلاً","text_en":"It is not on an island"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',6,'المولد بياكلوا فيه إيه؟','What sweets are eaten at the Mawlid?',20000,
 '[{"index":0,"text_ar":"حلاوة المولد","text_en":"Mawlid sweets"},{"index":1,"text_ar":"مكرونة بشاميل","text_en":"Béchamel pasta"},{"index":2,"text_ar":"سلطة خضرا","text_en":"A green salad"},{"index":3,"text_ar":"ولا حاجة، إحنا بنتفرج","text_en":"Nothing, we just watch"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',7,'مترو القاهرة فيه كام خط شغال؟','How many metro lines run in Cairo?',20000,
 '[{"index":0,"text_ar":"3","text_en":"3"},{"index":1,"text_ar":"47","text_en":"47"},{"index":2,"text_ar":"واحد وبنتخانق عليه","text_en":"One, and we fight over it"},{"index":3,"text_ar":"مفيش مترو","text_en":"There is no metro"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',8,'التوك توك بيمشي بإيه؟','What does a tuk-tuk run on?',20000,
 '[{"index":0,"text_ar":"بنزين","text_en":"Petrol"},{"index":1,"text_ar":"طاقة شمسية","text_en":"Solar power"},{"index":2,"text_ar":"أغاني مزيكا عالية","text_en":"Very loud music"},{"index":3,"text_ar":"الأمل","text_en":"Hope"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',9,'الإسكندرية على أي بحر؟','Alexandria sits on which sea?',20000,
 '[{"index":0,"text_ar":"المتوسط","text_en":"The Mediterranean"},{"index":1,"text_ar":"الأحمر","text_en":"The Red Sea"},{"index":2,"text_ar":"الكاريبي","text_en":"The Caribbean"},{"index":3,"text_ar":"بحر من الزحمة","text_en":"A sea of traffic"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',10,'أسوان مشهورة بإيه؟','What is Aswan known for?',20000,
 '[{"index":0,"text_ar":"السد العالي","text_en":"The High Dam"},{"index":1,"text_ar":"التزلج على الجليد","text_en":"Ice skating"},{"index":2,"text_ar":"الضباب","text_en":"Fog"},{"index":3,"text_ar":"البطاطس","text_en":"Potatoes"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',11,'الفول والطعمية بياكلوهم إمتى غالباً؟','When is fuul and taameya usually eaten?',20000,
 '[{"index":0,"text_ar":"الفطار","text_en":"Breakfast"},{"index":1,"text_ar":"مرة في السنة","text_en":"Once a year"},{"index":2,"text_ar":"في الفضا","text_en":"In space"},{"index":3,"text_ar":"ممنوع أكلهم","text_en":"They are banned"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',12,'خان الخليلي إيه؟','What is Khan El-Khalili?',20000,
 '[{"index":0,"text_ar":"سوق قديم","text_en":"An old market"},{"index":1,"text_ar":"مطار","text_en":"An airport"},{"index":2,"text_ar":"لاعب كورة","text_en":"A footballer"},{"index":3,"text_ar":"نوع مكرونة","text_en":"A kind of pasta"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',13,'الساحل الشمالي على أي بحر؟','The North Coast is on which sea?',20000,
 '[{"index":0,"text_ar":"المتوسط","text_en":"The Mediterranean"},{"index":1,"text_ar":"الأحمر","text_en":"The Red Sea"},{"index":2,"text_ar":"بحر الرمال","text_en":"The Sand Sea"},{"index":3,"text_ar":"مفيش بحر، صور بس","text_en":"No sea, just photos"}]',0,'standard'),
('cccc3333-0000-4000-8000-000000000001',14,'«بكرة» في مصر معناها إيه بالظبط؟','In Egypt, "bukra" (tomorrow) means exactly what?',20000,
 '[{"index":0,"text_ar":"بكرة","text_en":"Tomorrow"},{"index":1,"text_ar":"الأسبوع الجاي","text_en":"Next week"},{"index":2,"text_ar":"لما ربنا يسهّل","text_en":"When it works out"},{"index":3,"text_ar":"محدش يعرف","text_en":"Nobody knows"}]',0,'double');

notify pgrst, 'reload schema';
