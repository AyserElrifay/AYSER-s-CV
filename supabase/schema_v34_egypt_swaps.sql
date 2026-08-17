-- ═══════════════════════════════════════════════════════════════════
--  تعرف مصر؟ · FOUR OF SARA'S, SWAPPED IN
--
--  Sara Zekralla sent ten questions and Ayser asked: if any are good,
--  trade them for ones already in the pack.
--
--  All ten are true — I checked each one. But SEVEN of them the pack
--  already asks, sometimes almost word for word: Carter and the tomb
--  (q4), the Sphinx's body (q6), the Rosetta Stone (q8), the library
--  at Alexandria (q27), Khufu and the Great Pyramid (q20), papyrus
--  (q15), and the Suez Canal (q9, q24). Adding those would mean a
--  fifteen-question round that asks about the Rosetta Stone twice.
--
--  Three are ground the pack has never covered at all:
--
--    · the FIRST CAPITAL — Narmer and Memphis. The pack starts at the
--      pyramids and had nothing before them.
--    · the GODS — Ra. Fifty-three questions about Egypt and not one
--      about what anybody believed.
--    · the SEASONS — Akhet, the flood. The pack mentions the Nile
--      constantly and never says what it did to the year.
--
--  And one of hers is simply sharper than ours: we asked which CENTURY
--  the Suez Canal opened in, which anybody can reason out. She asked
--  the year. Hers replaces ours.
--
--  ── WHAT GOES, AND WHY ───────────────────────────────────────────
--  Swapped, as asked, rather than piled on — the pack stays at 53.
--  The three that leave are the three that were free points:
--
--    q1  "Which river runs through Egypt?"       (the Nile)
--    q2  "What is the capital of Egypt?"         (Cairo)
--    q21 "What is the official language?"        (Arabic)
--
--  Nobody has ever got one of those wrong, and a question nobody gets
--  wrong teaches nothing and costs twenty seconds. Plenty of gentle
--  ones remain — the currency, the seas, the borders, koshari.
--
--  AYSER: if you want any of those three back, say so and they come
--  back. They are three lines.
--
--  Written in the five play languages, each with the line that teaches
--  underneath. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

delete from public.questions
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index in (1, 2, 21, 24);

insert into public.questions (pack_id, order_index, text_ar, text_en, timer_ms, options, correct_index, points_style) values
('eeee5555-0000-4000-8000-000000000001',1,'الملك نارمر أسس أول عاصمة لمصر حوالي سنة ٣١٠٠ ق.م — اسمها كان إيه؟','King Narmer founded Egypt’s first capital around 3100 BCE. What was it called?',20000,
 '[{"index":0,"text_ar":"منف","text_en":"Memphis"},{"index":1,"text_ar":"طيبة","text_en":"Thebes"},{"index":2,"text_ar":"الإسكندرية","text_en":"Alexandria"},{"index":3,"text_ar":"الكرنك","text_en":"Karnak"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',2,'مين إله الشمس عند المصريين القدماء، اللي بيترسم براس صقر وقرص شمس فوقه؟','Who was the sun god of ancient Egypt, drawn with a hawk’s head and a sun disc?',20000,
 '[{"index":0,"text_ar":"رع","text_en":"Ra"},{"index":1,"text_ar":"أوزيريس","text_en":"Osiris"},{"index":2,"text_ar":"أنوبيس","text_en":"Anubis"},{"index":3,"text_ar":"سوبك","text_en":"Sobek"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',21,'المصريين القدماء كانوا بيسموا موسم فيضان النيل إيه؟','What did the ancient Egyptians call the season of the Nile flood?',20000,
 '[{"index":0,"text_ar":"آخت","text_en":"Akhet"},{"index":1,"text_ar":"بيريت","text_en":"Peret"},{"index":2,"text_ar":"شيمو","text_en":"Shemu"},{"index":3,"text_ar":"حابي","text_en":"Hapi"}]',0,'standard'),
('eeee5555-0000-4000-8000-000000000001',24,'قناة السويس اتفتحت سنة كام؟','In what year did the Suez Canal open?',20000,
 '[{"index":0,"text_ar":"١٨٦٩","text_en":"1869"},{"index":1,"text_ar":"١٩٠٥","text_en":"1905"},{"index":2,"text_ar":"١٧٩٨","text_en":"1798"},{"index":3,"text_ar":"١٩٥٢","text_en":"1952"}]',0,'standard');

update public.questions set
  text_i18n = '{"fr":"Le roi Narmer a fondé la première capitale de l’Égypte vers 3100 av. J.-C. Comment s’appelait-elle ?","es":"El rey Narmer fundó la primera capital de Egipto hacia el 3100 a. C. ¿Cómo se llamaba?","ro":"Regele Narmer a întemeiat prima capitală a Egiptului pe la 3100 î.Hr. Cum se numea?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"منف","text_en":"Memphis","text_i18n":{"fr":"Memphis","es":"Menfis","ro":"Memphis"}},{"index":1,"text_ar":"طيبة","text_en":"Thebes","text_i18n":{"fr":"Thèbes","es":"Tebas","ro":"Teba"}},{"index":2,"text_ar":"الإسكندرية","text_en":"Alexandria","text_i18n":{"fr":"Alexandrie","es":"Alejandría","ro":"Alexandria"}},{"index":3,"text_ar":"الكرنك","text_en":"Karnak","text_i18n":{"fr":"Karnak","es":"Karnak","ro":"Karnak"}}]'::jsonb,
  note_ar   = 'منف قامت عند أول الدلتا، جنب القاهرة النهاردة — وطيبة والإسكندرية جم بعدها بقرون.',
  note_en   = 'Memphis stood where the valley opens into the Delta, beside today’s Cairo. Thebes and Alexandria came centuries later.',
  note_i18n = '{"fr":"Memphis se dressait là où la vallée s’ouvre sur le Delta, près du Caire actuel. Thèbes et Alexandrie sont venues des siècles plus tard.","es":"Menfis estaba donde el valle se abre al Delta, junto al Cairo de hoy. Tebas y Alejandría llegaron siglos después.","ro":"Memphis se afla acolo unde valea se deschide spre Deltă, lângă Cairo de azi. Teba și Alexandria au venit secole mai târziu."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 1;

update public.questions set
  text_i18n = '{"fr":"Qui était le dieu du soleil de l’Égypte ancienne, représenté avec une tête de faucon et un disque solaire ?","es":"¿Quién era el dios del sol del antiguo Egipto, con cabeza de halcón y un disco solar?","ro":"Cine era zeul soarelui în Egiptul antic, înfățișat cu cap de șoim și un disc solar?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"رع","text_en":"Ra","text_i18n":{"fr":"Rê","es":"Ra","ro":"Ra"}},{"index":1,"text_ar":"أوزيريس","text_en":"Osiris","text_i18n":{"fr":"Osiris","es":"Osiris","ro":"Osiris"}},{"index":2,"text_ar":"أنوبيس","text_en":"Anubis","text_i18n":{"fr":"Anubis","es":"Anubis","ro":"Anubis"}},{"index":3,"text_ar":"سوبك","text_en":"Sobek","text_i18n":{"fr":"Sobek","es":"Sobek","ro":"Sobek"}}]'::jsonb,
  note_ar   = 'رع بيعدي السما بالنهار والعالم التاني بالليل. أوزيريس للموتى، وأنوبيس للتحنيط، وسوبك هو التمساح.',
  note_en   = 'Ra crossed the sky by day and the underworld by night. Osiris ruled the dead, Anubis handled mummification, Sobek was the crocodile.',
  note_i18n = '{"fr":"Rê traversait le ciel le jour et le monde souterrain la nuit. Osiris régnait sur les morts, Anubis s’occupait de la momification, Sobek était le crocodile.","es":"Ra cruzaba el cielo de día y el inframundo de noche. Osiris reinaba sobre los muertos, Anubis se ocupaba de la momificación y Sobek era el cocodrilo.","ro":"Ra traversa cerul ziua și lumea de dincolo noaptea. Osiris domnea peste morți, Anubis se ocupa de mumificare, iar Sobek era crocodilul."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 2;

update public.questions set
  text_i18n = '{"fr":"Comment les anciens Égyptiens appelaient-ils la saison de la crue du Nil ?","es":"¿Cómo llamaban los antiguos egipcios a la estación de la crecida del Nilo?","ro":"Cum numeau egiptenii antici anotimpul revărsării Nilului?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"آخت","text_en":"Akhet","text_i18n":{"fr":"Akhet","es":"Akhet","ro":"Akhet"}},{"index":1,"text_ar":"بيريت","text_en":"Peret","text_i18n":{"fr":"Peret","es":"Peret","ro":"Peret"}},{"index":2,"text_ar":"شيمو","text_en":"Shemu","text_i18n":{"fr":"Chemou","es":"Shemu","ro":"Shemu"}},{"index":3,"text_ar":"حابي","text_en":"Hapi","text_i18n":{"fr":"Hâpi","es":"Hapi","ro":"Hapi"}}]'::jsonb,
  note_ar   = 'السنة كانت تلات مواسم: آخت الفيضان، وبيريت الزرع، وشيمو الحصاد. وحابي ده إله الفيضان نفسه، مش الموسم.',
  note_en   = 'Their year had three seasons: Akhet the flood, Peret the growing, Shemu the harvest. Hapi was the god of the flood, not the season.',
  note_i18n = '{"fr":"Leur année comptait trois saisons : Akhet la crue, Peret les semailles, Chemou la moisson. Hâpi était le dieu de la crue, pas la saison.","es":"Su año tenía tres estaciones: Akhet la crecida, Peret la siembra, Shemu la cosecha. Hapi era el dios de la crecida, no la estación.","ro":"Anul lor avea trei anotimpuri: Akhet — revărsarea, Peret — semănatul, Shemu — recolta. Hapi era zeul revărsării, nu anotimpul."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 21;

update public.questions set
  text_i18n = '{"fr":"En quelle année le canal de Suez a-t-il été ouvert ?","es":"¿En qué año se abrió el canal de Suez?","ro":"În ce an a fost deschis Canalul Suez?"}'::jsonb,
  options   = '[{"index":0,"text_ar":"١٨٦٩","text_en":"1869","text_i18n":{"fr":"1869","es":"1869","ro":"1869"}},{"index":1,"text_ar":"١٩٠٥","text_en":"1905","text_i18n":{"fr":"1905","es":"1905","ro":"1905"}},{"index":2,"text_ar":"١٧٩٨","text_en":"1798","text_i18n":{"fr":"1798","es":"1798","ro":"1798"}},{"index":3,"text_ar":"١٩٥٢","text_en":"1952","text_i18n":{"fr":"1952","es":"1952","ro":"1952"}}]'::jsonb,
  note_ar   = 'اتفتحت في نوفمبر ١٨٦٩ بعد عشر سنين حفر، وبقت أقصر طريق بين أوروبا وآسيا.',
  note_en   = 'It opened in November 1869 after ten years of digging, and became the short way between Europe and Asia.',
  note_i18n = '{"fr":"Ouvert en novembre 1869 après dix ans de travaux, il est devenu la route courte entre l’Europe et l’Asie.","es":"Se abrió en noviembre de 1869 tras diez años de obras y se convirtió en el camino corto entre Europa y Asia.","ro":"S-a deschis în noiembrie 1869, după zece ani de săpături, devenind drumul scurt dintre Europa și Asia."}'::jsonb
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 24;

-- ── AND THESE FOUR GET DEALT LIKE THE REST ─────────────────────────
-- They were just written with the right answer first, which is the
-- whole thing v32 exists to undo. Without this call they would be the
-- only four questions in the game whose answer is always the top
-- button — and four out of a hundred and fourteen is far too few to
-- move the share the build checks, so nobody would have found out.
select public.lamma_spread_answers();

notify pgrst, 'reload schema';
