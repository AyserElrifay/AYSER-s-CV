/* ─── THE SCENE ──────────────────────────────────────────────────────
   Ayser: "خلي التعليم عباره عن قصه وكده ابتكرنا حاجه جديه و معلناش
   copyrights و كمان عندنا بوابه محترمه تنافس"

   That is the right idea and it is worth saying exactly why.

   ── WHAT A COURSE TEACHES, AND WHAT THIS TEACHES ──────────────────
   A course teaches you a phrase. A scene teaches you the moment the
   phrase belongs to — and the moment is the part that is missing when
   somebody freezes at a table with the right words in their head.

   "Ještě jedno" means "one more". Fine. But the thing you actually
   need to know is that in a Czech pub a fresh beer arrives without
   being ordered, that this is service rather than a trick, that the
   pencil marks on the paper mat under your glass are the bill, and
   that putting the mat on top of the glass is how you say enough.
   Four facts and one phrase, and they are useless apart. A scene is
   the only shape that carries them together.

   ── AND WHY EVERY WORD OF IT IS OURS ──────────────────────────────
   Because we wrote it. Not reworded from anybody's lesson, not
   "changed a bit" — written. That is not only the lawful way, it is
   the only way this is worth doing: a reshaped copy of somebody's
   course is a worse version of their course, and we would be
   competing on their ground with their material. A scene set in a
   real pub on a real Tuesday is ground nobody else is standing on.

   ── HOW IT IS BUILT ───────────────────────────────────────────────
   Every phrase and every custom in these scenes already exists in
   countryRoom.js, checked and translated. The scene does not add new
   material — it puts the material in the order a person meets it.
   That is the whole trick, and it is why this was two days of writing
   rather than two months.

   Every option teaches, including the wrong ones. A wrong answer here
   does not say "wrong" — it says what would actually have happened,
   which is the part somebody remembers.                              */

export const COUNTRY_STORIES = {
  CZ: [
    {
      id: 'cz_pub',
      title: 'The beer you did not order',
      titleAr: 'البيرة اللي ما طلبتهاش',
      set: 'A pub in Prague, Tuesday, half past eight. Long wooden tables, and no free ones.',
      setAr: 'بار في براغ، يوم تلات، الساعة تمانية ونص. ترابيزات خشب طويلة، ومفيش ولا واحدة فاضية.',
      beats: [
        {
          text: 'There is one seat left, at a table where two men are already sitting. One of them looks up at you.',
          textAr: 'فيه كرسي واحد فاضي، على ترابيزة قاعد عليها راجلين. واحد فيهم رفع عينه ليك.',
          ask: 'What do you say?',
          askAr: 'تقول إيه؟',
          options: [
            { native: 'Je tu volno?', how: 'yeh too VOL-no', right: true,
              then: 'He nods and moves his glass. Sharing a table with strangers is completely normal here, and asking first is the whole of the etiquette.',
              thenAr: 'هز راسه ونقل كبايته. مشاركة الترابيزة مع ناس ما تعرفهمش حاجة عادية تماماً هنا، والسؤال الأول ده هو كل الإتيكيت.' },
            { native: '(sit down without saying anything)', nativeAr: '(تقعد من غير ما تقول حاجة)', how: '', right: false,
              then: 'Nothing bad happens. But you have skipped the one sentence that would have made you a person at the table rather than a stranger who took a chair.',
              thenAr: 'مفيش حاجة وحشة هتحصل. بس إنت فوّتّ الجملة الوحيدة اللي كانت هتخليك واحد على الترابيزة بدل واحد غريب خد كرسي.' },
            { native: 'Dobrý den', how: 'DOB-ree den', right: false,
              then: 'Not wrong — it is the polite hello and it will be returned. But it does not answer the question you are actually asking, and he will wait for the rest.',
              thenAr: 'مش غلط — دي التحية المهذبة وهيردوها عليك. بس ما بتجاوبش على السؤال اللي إنت فعلاً بتسأله، وهيستنى الباقي.' },
          ],
        },
        {
          text: 'You order one beer. Before you are halfway down it, a full one lands beside it. You did not ask for it.',
          textAr: 'طلبت بيرة واحدة. وقبل ما توصل نصها، بيرة كاملة نزلت جنبها. وإنت ما طلبتهاش.',
          ask: 'What is happening?',
          askAr: 'إيه اللي بيحصل؟',
          options: [
            { native: '(nothing — this is normal)', nativeAr: '(ولا حاجة — دي حاجة عادية)', how: '', right: true,
              then: 'It is service. The waiter keeps you supplied until you signal otherwise, and every round is a pencil mark on the paper mat under your glass. That mat is your bill.',
              thenAr: 'دي خدمة. الجرسون بيفضل يجيبلك لحد ما تديله إشارة بالعكس، وكل جولة كشخطة بالقلم على الفوطة الورق اللي تحت كبايتك. والفوطة دي هي حسابك.' },
            { native: '(send it back)', nativeAr: '(ترجّعها)', how: '', right: false,
              then: 'You can, and nobody will be offended. But you have just done the tourist thing in a room where every local is doing the opposite.',
              thenAr: 'تقدر، ومحدش هيزعل. بس إنت لسه عامل حاجة السايح في أوضة كل أهل البلد فيها بيعملوا العكس.' },
            { native: '(assume you are being cheated)', nativeAr: '(تفترض إنهم بينصبوا عليك)', how: '', right: false,
              then: 'You are not. The marks on the mat are the honest record, and adding to them yourself is the only way anybody cheats in this system.',
              thenAr: 'إنت مش بتتنصب عليك. الخطوط على الفوطة هي السجل الأمين، والطريقة الوحيدة للغش في النظام ده إنك تزوّد خطوط بنفسك.' },
          ],
        },
        {
          text: 'The man opposite raises his glass towards you.',
          textAr: 'الراجل اللي قصادك رفع كبايته ناحيتك.',
          ask: 'What do you do?',
          askAr: 'تعمل إيه؟',
          options: [
            { native: 'Na zdraví — and look him in the eye', how: 'na ZDRA-vee', right: true,
              then: 'Eyes met, glasses touched, and the glass goes down on the table before you drink. Miss the eyes and somebody at this table will make you do it again.',
              thenAr: 'العين في العين، والكبايات بتلمس، والكباية بتنزل على الترابيزة قبل ما تشرب. ولو ما بصتش في عينه حد على الترابيزة دي هيخليك تعيدها.' },
            { native: 'Na zdraví — while looking at the glass', how: 'na ZDRA-vee', right: false,
              then: 'The word is right and the eyes are wrong, and here the eyes are the part that counts. There is a superstition about seven bad years attached to it.',
              thenAr: 'الكلمة صح والعين غلط، وهنا العين هي الحتة اللي بتفرق. وفيه خرافة عن سبع سنين نحس مربوطة بيها.' },
            { native: 'Ahoj', how: 'AH-hoy', right: false,
              then: 'That is hello, and you are past hello. He is waiting for the toast.',
              thenAr: 'دي "أهلاً"، وإنت عديت مرحلة الأهلاً. هو مستني النخب.' },
          ],
        },
        {
          text: 'You have had enough. The waiter is coming back with another.',
          textAr: 'إنت كفاية عليك. والجرسون راجع بواحدة كمان.',
          ask: 'How do you stop it, without a word?',
          askAr: 'توقّفها إزاي، من غير كلمة؟',
          options: [
            { native: '(put the paper mat on top of your glass)', nativeAr: '(تحط الفوطة الورق فوق كبايتك)', how: '', right: true,
              then: 'Done. That is the signal, it is silent, and it is understood in every pub in the country. Then: "Zaplatím, prosím."',
              thenAr: 'خلاص. دي الإشارة، وهي صامتة، ومفهومة في كل بار في البلد. وبعدين: "Zaplatím, prosím".' },
            { native: '(wave him away)', nativeAr: '(تشاورله يمشي)', how: '', right: false,
              then: 'It works, and it is slightly rude, and you had a better option sitting under your glass the whole evening.',
              thenAr: 'هتنفع، وفيها شوية قلة ذوق، وكان عندك حل أحسن قاعد تحت كبايتك طول الليلة.' },
            { native: 'Ne, děkuji', how: 'neh DYEH-koo-yee', right: false,
              then: 'Perfectly polite and perfectly fine. But he will ask again in twenty minutes, and the mat would have settled it for good.',
              thenAr: 'مهذبة تماماً وكويسة تماماً. بس هيسأل تاني بعد عشرين دقيقة، والفوطة كانت هتحسمها خلاص.' },
          ],
        },
      ],
      end: 'Four phrases, three customs, and one evening you could now actually survive. None of that was a vocabulary list.',
      endAr: 'أربع جمل وتلات عادات وليلة واحدة تقدر دلوقتي تعدّيها فعلاً. وولا واحدة من دول كانت ليستة كلمات.',
    },
  ],
  GR: [
    {
      id: 'gr_taverna',
      title: 'The bill that never comes',
      titleAr: 'الحساب اللي عمره ما بييجي',
      set: 'A taverna in Plaka, ten at night. You finished eating forty minutes ago.',
      setAr: 'طافيرنا في بلاكا، الساعة عشرة بالليل. إنت خلصت أكل من أربعين دقيقة.',
      beats: [
        {
          text: 'The plates are cleared. Nobody has brought the bill. Nobody has come near you.',
          textAr: 'الأطباق اترفعت. محدش جاب الحساب. ومحدش قرّب منك.',
          ask: 'What does this mean?',
          askAr: 'ده معناه إيه؟',
          options: [
            { native: '(they are leaving you alone on purpose)', nativeAr: '(بيسيبوك في حالك عن قصد)', how: '', right: true,
              then: 'Bringing the bill unasked would be telling you to leave. The table is yours until you ask for it, and sitting is not something you are getting away with.',
              thenAr: 'إنه يجيبلك الحساب من غير ما تطلبه يبقى بيقولك امشي. الترابيزة بتاعتك لحد ما تطلبه، وقعدتك مش حاجة إنت "فالتها".' },
            { native: '(you have been forgotten)', nativeAr: '(إنت اتنسيت)', how: '', right: false,
              then: 'You have not. This is the single most common misreading a visitor makes in Greece, and it usually ends with somebody leaving cash on a table and feeling odd about it.',
              thenAr: 'إنت ما اتنسيتش. دي أكتر حاجة السايح بيفهمها غلط في اليونان، وغالباً بتنتهي بواحد سايب فلوس على الترابيزة وحاسس إن فيه حاجة غلط.' },
            { native: '(the service is bad)', nativeAr: '(الخدمة وحشة)', how: '', right: false,
              then: 'It is the opposite. What you are reading as neglect is the most deliberate thing the waiter has done all evening.',
              thenAr: 'ده العكس. اللي إنت فاهمه إهمال هو أكتر حاجة الجرسون عملها بقصد الليلة دي كلها.' },
          ],
        },
        {
          text: 'A small plate of something sweet arrives, with two spoons. You did not order it.',
          textAr: 'طبق صغير حلو نزل، ومعاه معلقتين. وإنت ما طلبتوش.',
          ask: 'What is it?',
          askAr: 'ده إيه؟',
          options: [
            { native: '(kerasma — a gift, and it is free)', nativeAr: '(kerasma — هدية، وببلاش)', how: 'KEH-raz-ma', right: true,
              then: 'It comes at the end, it is not on the bill, and it is not a mistake. Refusing it is a small insult. Eat some.',
              thenAr: 'بييجي في الآخر، ومش على الحساب، ومش غلطة. ورفضه إهانة صغيرة. كُل منه.' },
            { native: '(something you will be charged for)', nativeAr: '(حاجة هتتحاسب عليها)', how: '', right: false,
              then: 'You will not be. Ask for the bill in a moment and look — it will not be there.',
              thenAr: 'مش هتتحاسب عليه. اطلب الحساب دلوقتي وبصّ — مش هتلاقيه.' },
            { native: '(a mistake, for the next table)', nativeAr: '(غلطة، ده للترابيزة اللي جنبك)', how: '', right: false,
              then: 'It is for you. Sending it back would be turning down a gift in front of the person who gave it.',
              thenAr: 'ده ليك. وإنك ترجعه يبقى بترفض هدية قدام اللي دهالك.' },
          ],
        },
        {
          text: 'Now you want to leave.',
          textAr: 'دلوقتي إنت عايز تمشي.',
          ask: 'How do you ask?',
          askAr: 'تطلب إزاي؟',
          options: [
            { native: 'Τον λογαριασμό, παρακαλώ', how: 'ton lo-ghar-yaz-MOH pah-rah-kah-LOH', right: true,
              then: 'And now it comes, in a minute. Add "ευχαριστώ" when it does — you will get a better goodbye than you expect.',
              thenAr: 'ودلوقتي هييجي، في دقيقة. وقول "ευχαριστώ" لما ييجي — هتاخد وداع أحلى مما تتوقع.' },
            { native: '(catch their eye and mime writing)', nativeAr: '(تبصله وتعمل بإيدك إنك بتكتب)', how: '', right: false,
              then: 'Understood everywhere and nobody minds. But you had the sentence, and the sentence is the reason the goodbye is warmer.',
              thenAr: 'مفهومة في كل مكان ومحدش هيزعل. بس كانت معاك الجملة، والجملة هي سبب إن الوداع يبقى أدفى.' },
            { native: '(leave money on the table and go)', nativeAr: '(تسيب فلوس على الترابيزة وتمشي)', how: '', right: false,
              then: 'Do not. You may have the amount wrong, and walking out of a Greek taverna without a goodbye is the one thing the evening did not deserve.',
              thenAr: 'ما تعملش كده. ممكن يكون المبلغ غلط، وإنك تخرج من طافيرنا يونانية من غير سلام دي الحاجة الوحيدة اللي الليلة ما كانتش تستاهلها.' },
          ],
        },
      ],
      end: 'The bill was never late. You just had not asked, and now you know that asking is the polite part, not the rude one.',
      endAr: 'الحساب عمره ما اتأخر. إنت بس ما كنتش طلبته، ودلوقتي عرفت إن الطلب هو الحاجة المهذبة مش العكس.',
    },
  ],
  EG: [
    {
      id: 'eg_ahwa',
      title: 'Three refusals',
      titleAr: 'تلات رفضات',
      set: 'A flat in Cairo, Friday afternoon. You came for an hour. It has been three.',
      setAr: 'شقة في القاهرة، بعد ضهر الجمعة. إنت جاي لساعة. بقالك تلاتة.',
      beats: [
        {
          text: 'You have eaten. A plate is put in front of you again, fuller than the first one.',
          textAr: 'إنت أكلت. والطبق اتحط قدامك تاني، وأملى من الأول.',
          ask: 'What do you say?',
          askAr: 'تقول إيه؟',
          options: [
            { native: 'لأ شكراً — and mean it lightly', how: 'laa SHOK-ran', right: true,
              then: 'This is the first refusal and it is expected. They will press. That pressing is the hospitality — it is not them failing to hear you.',
              thenAr: 'دي أول رفضة ومتوقعة. وهيلحّوا. واللحّ ده هو الكرم — مش إنهم ما سمعوكش.' },
            { native: '(take the plate to be polite)', nativeAr: '(تاخد الطبق عشان الذوق)', how: '', right: false,
              then: 'You have skipped the whole ritual and you will now be given a fourth plate, because you appear to be enjoying it.',
              thenAr: 'إنت فوّتّ الطقس كله ودلوقتي هيدولك رابع طبق، لأنك باين عليك مبسوط.' },
            { native: '(say no firmly, once)', nativeAr: '(تقول لأ بحزم، مرة واحدة)', how: '', right: false,
              then: 'Firmness here reads as being upset rather than being full. The refusal is meant to be soft and repeated.',
              thenAr: 'الحزم هنا بيتفهم إنك زعلان مش إنك شبعان. الرفض المفروض يكون هادي ومتكرر.' },
          ],
        },
        {
          text: 'They press. Twice.',
          textAr: 'لحّوا عليك. مرتين.',
          ask: 'And now?',
          askAr: 'ودلوقتي؟',
          options: [
            { native: '(take a little, on the third)', nativeAr: '(تاخد شوية، في التالتة)', how: '', right: true,
              then: 'That is the correct end of it. Two refusals are politeness; the third time you take some, and everyone is satisfied — including you, who did not have to eat a whole second dinner.',
              thenAr: 'دي النهاية الصح. رفضتين ذوق؛ والتالتة تاخد شوية، والكل يبقى مبسوط — وإنت منهم، لأنك ما اضطريتش تاكل عشا تاني كامل.' },
            { native: '(keep refusing)', nativeAr: '(تفضل ترفض)', how: '', right: false,
              then: 'You can, and it is allowed. But at some point it stops reading as politeness and starts reading as "there is something wrong with the food".',
              thenAr: 'تقدر، ومسموح. بس في نقطة معينة بتبطل تتفهم على إنها ذوق وتبدأ تتفهم على إن "فيه حاجة غلط في الأكل".' },
            { native: '(explain that you are full, in detail)', nativeAr: '(تشرحلهم إنك شبعان، بالتفصيل)', how: '', right: false,
              then: 'Nobody needed the explanation. A little on the plate said it better and in one movement.',
              thenAr: 'محدش كان محتاج الشرح. شوية في الطبق قالتها أحسن وفي حركة واحدة.' },
          ],
        },
        {
          text: 'You are leaving. Somebody spent the afternoon cooking.',
          textAr: 'إنت ماشي. وفيه حد قضى العصر كله بيطبخ.',
          ask: 'What do you say on the way out?',
          askAr: 'تقول إيه وانت خارج؟',
          options: [
            { native: 'تسلم إيدك', how: 'tis-lam EE-dak', right: true,
              then: 'Bless your hands. Said to whoever cooked, built, carried or fixed anything, and it is worth more here than thank you. Then مع السلامة on the way out.',
              thenAr: 'بتتقال للي طبخ أو بنى أو شال أو صلّح أي حاجة، وقيمتها هنا أكبر من "شكراً". وبعدين "مع السلامة" وانت خارج.' },
            { native: 'شكراً', how: 'SHOK-ran', right: false,
              then: 'Correct, and thin. It thanks the meal. تسلم إيدك thanks the person, and that is the difference somebody remembers.',
              thenAr: 'صح، وخفيفة. دي بتشكر الأكل. و"تسلم إيدك" بتشكر الشخص، ودي الفرق اللي الناس بتفتكره.' },
            { native: '(offer to help wash up)', nativeAr: '(تعرض إنك تساعد في غسل المواعين)', how: '', right: false,
              then: 'Kind, and it will be refused three times, which is a whole other loop you now know the shape of.',
              thenAr: 'لطيفة، وهيترفض تلات مرات، ودي حلقة تانية خالص بقيت عارف شكلها.' },
          ],
        },
      ],
      end: 'Two words and one rule about counting to three. That is most of an Egyptian afternoon.',
      endAr: 'كلمتين وقاعدة واحدة عن العد لتلاتة. ودي أغلب عصرية مصرية.',
    },
  ],
  IT: [
    {
      id: 'it_bar',
      title: 'The coffee that costs three times more',
      titleAr: 'القهوة اللي بتتلت تمنها',
      set: 'A bar in Rome, ten past eleven in the morning.',
      setAr: 'بار في روما، الساعة حداشر وعشرة الصبح.',
      beats: [
        {
          text: 'There is a counter with people standing at it, and there are tables outside with nobody at them.',
          textAr: 'فيه بار واقف عليه ناس، وفيه ترابيزات برة مفيش عليها حد.',
          ask: 'Where do you go?',
          askAr: 'تروح فين؟',
          options: [
            { native: '(the counter)', nativeAr: '(البار، واقف)', how: '', right: true,
              then: 'The price at the counter is the cheap one and it is printed on the wall. The same coffee at a table can legally cost three times as much — that is table service, not a scam.',
              thenAr: 'السعر على البار هو الرخيص ومكتوب على الحيطة. ونفس القهوة على ترابيزة ممكن قانوناً تبقى بتلات أضعاف — دي خدمة ترابيزات، مش نصب.' },
            { native: '(a table, it is nicer)', nativeAr: '(ترابيزة، دي أحلى)', how: '', right: false,
              then: 'Perfectly allowed, and you will pay for the seat. Just know that is what you chose, rather than discovering it on the bill.',
              thenAr: 'مسموح تماماً، وهتدفع تمن القعدة. بس اعرف إن ده اللي إنت اخترته، بدل ما تكتشفه في الحساب.' },
            { native: '(ask which is cheaper)', nativeAr: '(تسأل أنهي أرخص)', how: '', right: false,
              then: 'They will tell you, and it is on the wall anyway. The list with two columns is the answer.',
              thenAr: 'هيقولولك، وهي مكتوبة على الحيطة أصلاً. الليستة اللي بعمودين هي الإجابة.' },
          ],
        },
        {
          text: 'The barista looks at you.',
          textAr: 'الباريستا بصلك.',
          ask: 'What do you order?',
          askAr: 'تطلب إيه؟',
          options: [
            { native: 'Un caffè, per favore', how: 'oon kaf-FEH per fa-VO-reh', right: true,
              then: 'And what arrives is an espresso, because that is what "un caffè" means here. Drink it in two mouthfuls at the counter, like everybody around you.',
              thenAr: 'واللي هييجي إسبريسو، لأن ده معنى "un caffè" هنا. اشربها في نفسين على البار، زي كل اللي حواليك.' },
            { native: 'Un cappuccino, per favore', how: '', right: false,
              then: 'Nobody will stop you. But it is past eleven, milky coffee is a breakfast thing, and you have just told the whole room where you are from.',
              thenAr: 'محدش هيمنعك. بس الساعة عدّت حداشر، والقهوة باللبن حاجة فطار، وإنت لسه قلت للأوضة كلها إنت جاي منين.' },
            { native: 'Un latte, per favore', how: '', right: false,
              then: 'You will be brought a glass of milk. Latte is milk. The drink you meant is a caffè latte.',
              thenAr: 'هيجيبولك كباية لبن. Latte يعني لبن. والمشروب اللي إنت قاصده اسمه caffè latte.' },
          ],
        },
      ],
      end: 'Two words about where to stand, and one about what "coffee" means. In Italy that is most of a morning.',
      endAr: 'كلمتين عن إنت تقف فين، وكلمة عن معنى "قهوة". في إيطاليا دي أغلب الصبح.',
    },
  ],
};

/* Which countries have a scene at all — the sheet only draws the tab
   when there is something behind it, because an empty tab is a worse
   promise than no tab. */
export const hasStory = (code) => !!(COUNTRY_STORIES[code] && COUNTRY_STORIES[code].length);

/* ─── AND WHEN THE SCENE IS OVER ─────────────────────────────────────
   A scene is not a course and this room will never say it is. What we
   can honestly do at the end of one is point at people who really do
   teach the language — and be paid for the introduction, which is a
   business we are allowed to be in and a copy of somebody's lessons
   is not.

   These open the real site. The affiliate id lives in services/broker
   and is empty until Ayser opens each account; until then the links
   work perfectly and simply earn nothing. */
export const LEARN_PROPERLY = [
  { partner: 'italki', name: 'italki', emoji: '🗣️',
    note: 'A real teacher, by video, from about the price of a coffee',
    noteAr: 'مدرس حقيقي، بالفيديو، بتمن فنجان قهوة تقريباً',
    url: 'https://www.italki.com/' },
  { partner: 'preply', name: 'Preply', emoji: '👩‍🏫',
    note: 'The same idea, a bigger list of teachers',
    noteAr: 'نفس الفكرة، وليستة مدرسين أكبر',
    url: 'https://preply.com/' },
  { partner: 'busuu', name: 'Busuu', emoji: '📗',
    note: 'A full course, and native speakers correct what you write',
    noteAr: 'كورس كامل، وناس أصلية بتصحح اللي بتكتبه',
    url: 'https://www.busuu.com/' },
  { partner: 'babbel', name: 'Babbel', emoji: '📘',
    note: 'Short daily lessons, strongest on European languages',
    noteAr: 'دروس يومية قصيرة، وأقوى حاجة عندهم اللغات الأوروبية',
    url: 'https://www.babbel.com/' },
];
