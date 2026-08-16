-- ═══════════════════════════════════════════════════════════════════
--  لمّة · GETTING IT WRONG SHOULD TEACH YOU SOMETHING
--
--  Ayser: "خلي لما حد يجاوب غلط يصلحله عشان يعرف" — when somebody gets
--  it wrong, put them right, so they learn.
--
--  Marking the correct tile says WHICH one was right. It does not say
--  why, and "why" is the whole reason to play a quiz about a country
--  rather than about football scores. So every question can carry one
--  short line that appears after the reveal — the fact behind the
--  answer, in a sentence, for everybody in the room and not only the
--  people who got it wrong.
--
--  ── THE RULES THESE LINES FOLLOW ─────────────────────────────────
--  ONE SENTENCE. It is read in the four seconds before the next
--  question, out loud, over people talking. Two sentences is a lecture.
--
--  IT ADDS SOMETHING. "The answer is the Nile" is not a note, it is
--  the answer again. "Ninety-five per cent of Egyptians live within a
--  few kilometres of it" is a note.
--
--  IT IS TRUE, and where a number is disputed it is written as "about".
--
--  ── SAME SHAPE AS EVERYTHING ELSE HERE ───────────────────────────
--  note_ar and note_en are columns; every other language lives in
--  note_i18n, exactly like the question text. The app's resolver reads
--  them with the same function.
--
--  Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.questions add column if not exists note_ar   text;
alter table public.questions add column if not exists note_en   text;
alter table public.questions add column if not exists note_i18n jsonb;

-- The answer-free view carries the note as well. It gives nothing
-- away: it is only ever shown after the reveal, and the reveal already
-- says which option was right.
drop view if exists public.lamma_questions_public;
create view public.lamma_questions_public as
  select id, pack_id, order_index, text_ar, text_en, text_i18n,
         note_ar, note_en, note_i18n,
         media_url, media_type, timer_ms, options, points_style
    from public.questions;
grant select on public.lamma_questions_public to anon, authenticated;

notify pgrst, 'reload schema';

-- ── THE LINES THEMSELVES ───────────────────────────────────────────
-- Arabic and English for all forty-three. The other three languages
-- fall back to English for now rather than being machine-translated:
-- a note that says something slightly different in French is worse
-- than one everybody reads in English.
update public.questions set note_ar = 'الهرم كان مقبرة، والملك كان بيتدفن جواه بكل حاجته للرحلة التانية.', note_en = 'A pyramid was a tomb — the king was buried inside with everything he needed next.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 0;
update public.questions set note_ar = 'النيل أطول نهر في أفريقيا، وبيعدي في إحدى عشرة دولة قبل ما يوصل مصر.', note_en = 'The Nile runs through eleven countries before it reaches Egypt.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 1;
update public.questions set note_ar = 'القاهرة أكبر مدينة في أفريقيا والعالم العربي، وفيها أكتر من ٢٠ مليون.', note_en = 'Cairo is the largest city in Africa and the Arab world — over 20 million people.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 2;
update public.questions set note_ar = 'توت عنخ آمون بقى ملك وعنده ٩ سنين، ومات وعنده ١٨، ومقبرته اتلقت كاملة تقريبًا.', note_en = 'Tutankhamun became king at nine and died at eighteen; his tomb was found almost untouched.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 3;
update public.questions set note_ar = 'الأهرامات اتبنت قبل كليوباترا بحوالي ٢٥٠٠ سنة — هي كانت أقرب لينا منها لبناة الهرم.', note_en = 'Cleopatra lived closer in time to us than to the building of the pyramids.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 4;
update public.questions set note_ar = 'كليوباترا كانت بتتكلم كذا لغة، وكانت آخر حاكم لمصر القديمة قبل الرومان.', note_en = 'Cleopatra spoke several languages and was ancient Egypt’s last ruler before Rome.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 5;
update public.questions set note_ar = 'أبو الهول منحوت من صخرة واحدة، طوله حوالي ٧٣ متر، وله وش إنسان وجسم أسد.', note_en = 'The Sphinx is carved from one piece of rock — about 73 metres of lion with a human head.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 6;
update public.questions set note_ar = 'الهيروغليفية اتقرت تاني سنة ١٨٢٢ بعد ما فضلت مقفولة أكتر من ألف سنة.', note_en = 'Hieroglyphs went unread for over a thousand years, until 1822.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 7;
update public.questions set note_ar = 'حجر رشيد مكتوب عليه نفس النص بتلات كتابات، وده اللي خلى فك الرموز ممكن.', note_en = 'The Rosetta Stone carries the same text three ways — that is what cracked the code.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 8;
update public.questions set note_ar = 'قناة السويس بتوفر على السفينة حوالي ٧٠٠٠ كيلومتر بدل ما تلف حوالين أفريقيا.', note_en = 'The Suez Canal saves a ship about 7,000 km around Africa.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 9;
update public.questions set note_ar = 'البحر الأحمر من أحسن أماكن الغطس في الدنيا بسبب الشعاب المرجانية.', note_en = 'The Red Sea’s coral reefs make it one of the best diving spots on earth.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 10;
update public.questions set note_ar = 'الإسكندر بنى الإسكندرية سنة ٣٣١ قبل الميلاد وسماها على اسمه.', note_en = 'Alexander founded Alexandria in 331 BC and named it after himself.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 11;
update public.questions set note_ar = 'فنار الإسكندرية فضل واقف حوالي ١٦٠٠ سنة لحد ما الزلازل وقعته.', note_en = 'The Lighthouse stood for about 1,600 years before earthquakes brought it down.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 12;
update public.questions set note_ar = 'محمد صلاح من قرية نجريج في المحلة، وبقى أشهر لاعب عربي في أوروبا.', note_en = 'Mohamed Salah came from a village in the Nile Delta called Nagrig.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 13;
update public.questions set note_ar = 'الكشري أكلة الشارع الأولى في مصر، وأصلها خليط من هندي وإيطالي ومصري.', note_en = 'Koshari is Egypt’s street food — Indian, Italian and Egyptian ideas in one bowl.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 14;
update public.questions set note_ar = 'البردي كان أول ورق في الدنيا، ومصر كانت بتصدره لكل البحر المتوسط.', note_en = 'Papyrus was the world’s first paper, and Egypt exported it across the Mediterranean.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 15;
update public.questions set note_ar = 'حوالي ٩٦٪ من مساحة مصر صحرا، والناس عايشة على شريط ضيق جنب النيل.', note_en = 'About 96% of Egypt is desert; nearly everyone lives on a thin strip by the Nile.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 16;
update public.questions set note_ar = 'السد العالي حمى مصر من الفيضان، وبحيرة ناصر ورا السد من أكبر البحيرات الصناعية.', note_en = 'The High Dam ended the Nile’s floods; Lake Nasser behind it is one of the largest man-made lakes.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 17;
update public.questions set note_ar = 'معابد أبو سمبل اتنقلت حجر حجر في الستينات عشان مايغرقهاش السد.', note_en = 'Abu Simbel was cut up and moved, block by block, so the dam would not drown it.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 18;
update public.questions set note_ar = 'الجنيه المصري اتقسم زمان لـ ١٠٠ قرش، والقرش لسه اسمه موجود في الكلام.', note_en = 'The Egyptian pound splits into 100 piastres — still called that in everyday talk.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 19;
update public.questions set note_ar = 'الهرم الأكبر فضل أطول مبنى في الدنيا حوالي ٣٨٠٠ سنة.', note_en = 'The Great Pyramid was the tallest building on earth for about 3,800 years.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 20;
update public.questions set note_ar = 'العربية هي اللغة الرسمية، والمصري بيتكلم لهجة مصرية مفهومة في كل العالم العربي.', note_en = 'Arabic is official; the Egyptian dialect is understood across the whole Arab world.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 21;
update public.questions set note_ar = 'الأهرامات اتبنت حوالي ٢٥٦٠ قبل الميلاد — يعني قبل روما بآلاف السنين.', note_en = 'The pyramids went up around 2560 BC — thousands of years before Rome existed.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 22;
update public.questions set note_ar = 'بعد ٣٠ قبل الميلاد مصر بقت ولاية رومانية، وكانت بتطعم روما بالقمح.', note_en = 'From 30 BC Egypt was a Roman province — and the grain supply that fed Rome.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 23;
update public.questions set note_ar = 'القناة اتفتحت سنة ١٨٦٩، واتحفرت بأيدي عشرات الآلاف من المصريين.', note_en = 'The canal opened in 1869, dug largely by tens of thousands of Egyptian labourers.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 24;
update public.questions set note_ar = 'ثورة ٢٣ يوليو ١٩٥٢ أنهت الملكية، ومصر بقت جمهورية بعدها بسنة.', note_en = 'The revolution of July 1952 ended the monarchy; the republic followed a year later.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 25;
update public.questions set note_ar = 'عبد الناصر أمّم قناة السويس سنة ١٩٥٦، والسد العالي خلص سنة ١٩٧٠.', note_en = 'Nasser nationalised the canal in 1956; the High Dam was finished in 1970.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 26;
update public.questions set note_ar = 'مكتبة الإسكندرية كانت بتجمع نسخة من كل كتاب في الدنيا، وضاعت على مراحل.', note_en = 'The Library of Alexandria tried to hold a copy of every book in the world.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 27;
update public.questions set note_ar = 'الأواني الكانوبية كانت أربعة، كل واحدة لعضو، وكل واحدة عليها وش حارس مختلف.', note_en = 'There were four canopic jars, one per organ, each with a different guardian’s head.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 28;
update public.questions set note_ar = 'سواحل مصر على المتوسط طولها حوالي ٩٠٠ كيلومتر، والإسكندرية أهم موانيها.', note_en = 'Egypt has about 900 km of Mediterranean coast, with Alexandria as its great port.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 29;
update public.questions set note_ar = 'البحر الأحمر بيفصل مصر عن السعودية، وبيوصل للمحيط الهندي من الجنوب.', note_en = 'The Red Sea separates Egypt from Arabia and opens to the Indian Ocean.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 30;
update public.questions set note_ar = 'سينا هي الجسر البري الوحيد بين أفريقيا وآسيا، وفيها أعلى جبل في مصر.', note_en = 'Sinai is the only land bridge between Africa and Asia, and holds Egypt’s highest mountain.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 31;
update public.questions set note_ar = 'حدود مصر مع ليبيا خط مستقيم في الصحرا طوله أكتر من ١١٠٠ كيلومتر.', note_en = 'The Libya border is a straight desert line over 1,100 km long.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 32;
update public.questions set note_ar = 'السودان كان مع مصر دولة واحدة لحد ١٩٥٦، والنيل بيدخل مصر من عنده.', note_en = 'Sudan and Egypt were one country until 1956 — and the Nile enters Egypt from there.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 33;
update public.questions set note_ar = 'دلتا النيل من أخصب الأراضي في الدنيا، وشكلها مثلث زي حرف دلتا اليوناني.', note_en = 'The Nile delta is some of the most fertile land on earth — and shaped like the Greek letter.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 34;
update public.questions set note_ar = 'حوالي ٩٥٪ من المصريين عايشين على بعد كيلومترات قليلة من النيل.', note_en = 'About 95% of Egyptians live within a few kilometres of the Nile.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 35;
update public.questions set note_ar = 'المثل ده بيتقال لما حد يمدح ابنه قدام الناس — الحب بيعمي عن العيوب.', note_en = 'Said when a parent brags about their child: love does not see the flaws.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 36;
update public.questions set note_ar = 'بيتقال عشان حد يبطل يفكر في اللي راح ويكمّل قدام.', note_en = 'Said to stop somebody chewing over what is already done.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 37;
update public.questions set note_ar = 'بيتقال عن الشغل الجماعي — محدش بيوصل لحاجة لوحده.', note_en = 'Said about teamwork: nobody gets anywhere on their own.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 38;
update public.questions set note_ar = 'مثل بيتقال وقت الأزمة، ومعناه إن الحل بيجي لما تستنى وتهدى.', note_en = 'Said in a crisis: the way out arrives if you can wait for it.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 39;
update public.questions set note_ar = 'بيتقال عن اللي بيتكلم كتير في اللي محرومه — الحرمان بيسيطر على التفكير.', note_en = 'Said about somebody who talks endlessly about what they lack.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 40;
update public.questions set note_ar = 'نصيحة قديمة: اقطع مصدر التعب من أوله بدل ما تفضل تشيل نتيجته.', note_en = 'Old advice: cut the cause off rather than carrying the consequences forever.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 41;
update public.questions set note_ar = 'في مصر اللي بيجوّز اتنين بيتلام لو المشوار فشل — فالناس بتحذر من الوساطة.', note_en = 'In Egypt the matchmaker gets the blame if the marriage goes wrong.'
 where pack_id = 'eeee5555-0000-4000-8000-000000000001' and order_index = 42;

notify pgrst, 'reload schema';
