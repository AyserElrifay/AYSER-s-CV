/* ─── SETTLING IN · EVERYDAY LIFE, COUNTRY BY COUNTRY ────────────────
   Ayser: "مهاجر وصل بلد جديده ازاي يتأقلم مع المجتمع يفهم اكتر عنهم من
   غير ما يبقي في عنصريه او تحيز … اعمل ده بشكل لا يسيئ".

   How this is written, on purpose, and what to keep when adding to it:

   · SITUATIONS, NEVER CHARACTER. Every card is about a moment — a
     greeting, a visit, paying, a holiday — and what usually happens in
     it. Never "Estonians are…", "Egyptians are…". A people does not
     have a personality; a dinner invitation has customs.
   · "USUALLY", "MANY PEOPLE", "IT VARIES". Nothing here is a rule
     about anybody. Families, cities and generations differ, and the
     screen says so above the cards.
   · NO RANKING, NO COMPARING. No card says one way is better, more
     modern or more polite than another, and none compares two
     countries.
   · NOTHING A NEWCOMER COULD BE SHAMED WITH. The cards are things a
     person would want to know before the moment, not lists of
     mistakes.
   · NO USER-WRITTEN TIPS here. Advice about a whole culture written by
     strangers is where stereotypes come in. People meet in person at a
     culture swap instead (SettleSheet), where they speak for themselves.
   · Written in English and Arabic; other languages read the English.
     Only countries we can write about with care are listed. */

export const SETTLE = [
  {
    code: 'EE', flag: '🇪🇪', name: 'Estonia', nameAr: 'إستونيا',
    cards: [
      { icon: 'hand-left-outline',
        t: 'Saying hello', tAr: 'التحية',
        b: 'A short “Tere” and a handshake are usual. Chatting with strangers in a queue or on the bus is less common than in many places — a quiet bus is normal, not unfriendly.',
        bAr: '«Tere» قصيرة وسلام باليد هما المعتاد. الكلام مع ناس متعرفهمش في الطابور أو الأتوبيس أقل من أماكن كتير — الهدوء في الأتوبيس طبيعي ومش معناه إن حد مش ودود.' },
      { icon: 'home-outline',
        t: 'Visiting someone’s home', tAr: 'لما تزور حد في بيته',
        b: 'Shoes usually come off at the door. Bringing something small — flowers, a cake — is a kind gesture.',
        bAr: 'غالبًا بتقلع الجزمة عند الباب. إنك تجيب حاجة صغيرة — ورد أو كيكة — لفتة لطيفة.' },
      { icon: 'time-outline',
        t: 'Time', tAr: 'المواعيد',
        b: 'Being on time matters, with friends as much as at work. If you will be late, a short message is appreciated.',
        bAr: 'الالتزام بالمواعيد مهم، مع الأصحاب زي الشغل. لو هتتأخر، رسالة قصيرة بتفرق.' },
      { icon: 'card-outline',
        t: 'Paying and tipping', tAr: 'الدفع والبقشيش',
        b: 'Cards and phones work almost everywhere. Tipping is not expected; rounding up or about 10% for good service in a restaurant is a nice extra.',
        bAr: 'الكارت والموبايل شغالين في كل حتة تقريبًا. البقشيش مش مطلوب؛ إنك تقرّب الحساب أو تسيب حوالي ١٠٪ في مطعم لو الخدمة حلوة حاجة زيادة لطيفة.' },
      { icon: 'reload-outline',
        t: 'Bottles and cans', tAr: 'الإزايز والكانز',
        b: 'Most bottles and cans carry a small deposit. Return them at the machines in supermarkets and you get the money back.',
        bAr: 'معظم الإزايز والكانز عليها مبلغ تأمين صغير. رجّعها في المكن اللي في السوبرماركت وتاخد فلوسك تاني.' },
      { icon: 'flame-outline',
        t: 'Sauna', tAr: 'الساونا',
        b: 'Sauna is part of everyday life, often shared with family and friends. If you are unsure what is usual, just ask the host — people are glad to explain.',
        bAr: 'الساونا جزء من الحياة اليومية، وكتير بتبقى مع العيلة والأصحاب. لو مش متأكد إيه المعتاد، اسأل صاحب المكان — الناس بتحب تشرح.' },
      { icon: 'sunny-outline',
        t: 'A day that matters: Jaanipäev', tAr: 'يوم مهم: يانيبيف (منتصف الصيف)',
        b: 'Midsummer, 23–24 June: bonfires, family and the countryside. Cities go quiet as many people head out of town.',
        bAr: 'منتصف الصيف، ٢٣–٢٤ يونيو: نار في الهوا الطلق، وعيلة، وريف. المدن بتهدى لأن ناس كتير بتخرج برا البلد.' },
    ],
  },
  {
    code: 'RO', flag: '🇷🇴', name: 'Romania', nameAr: 'رومانيا',
    cards: [
      { icon: 'hand-left-outline',
        t: 'Saying hello', tAr: 'التحية',
        b: '“Bună ziua” is a polite hello. Friends often greet with a kiss on each cheek; with people you have just met, a handshake is usual.',
        bAr: '«Bună ziua» تحية مؤدبة. الأصحاب كتير بيسلّموا ببوسة على كل خد؛ ومع حد لسه متعرف عليه، السلام باليد هو المعتاد.' },
      { icon: 'home-outline',
        t: 'Visiting someone’s home', tAr: 'لما تزور حد في بيته',
        b: 'Shoes often come off at the door. Guests are usually offered food and drink — trying a little is a warm way to say thank you.',
        bAr: 'غالبًا بتقلع الجزمة عند الباب. الضيف عادة بيتقدّم له أكل وشرب — إنك تدوق شوية طريقة دافية تقول بيها شكرًا.' },
      { icon: 'flower-outline',
        t: 'Bringing flowers', tAr: 'لما تجيب ورد',
        b: 'Give an odd number of flowers. Even numbers are kept for funerals.',
        bAr: 'هات عدد ورد فردي. الأعداد الزوجية بتتجاب في الجنازات.' },
      { icon: 'calendar-outline',
        t: 'Name days', tAr: 'يوم الاسم',
        b: 'Many people celebrate the saint’s day of their name almost like a birthday. A short message on the day means a lot.',
        bAr: 'ناس كتير بتحتفل بيوم القديس اللي على اسمهم تقريبًا زي عيد الميلاد. رسالة قصيرة في اليوم ده بتفرق جدًا.' },
      { icon: 'card-outline',
        t: 'Paying and tipping', tAr: 'الدفع والبقشيش',
        b: 'About 10% in restaurants is common when you are happy with the service.',
        bAr: 'حوالي ١٠٪ في المطاعم شيء معتاد لو الخدمة عجبتك.' },
      { icon: 'gift-outline',
        t: 'A day that matters: Mărțișor', tAr: 'يوم مهم: مارتيشور',
        b: '1 March: people give a small token on a red-and-white string to welcome spring. It is a lovely first gift to a new colleague or neighbour.',
        bAr: '١ مارس: الناس بتهادي بعض بحاجة صغيرة متعلّقة في خيط أحمر وأبيض علشان يستقبلوا الربيع. هدية أولى حلوة لزميل أو جار جديد.' },
      { icon: 'egg-outline',
        t: 'Easter', tAr: 'عيد الفصح',
        b: 'For many families it is the biggest holiday of the year. It follows the Orthodox calendar, so its date can differ from Easter elsewhere.',
        bAr: 'عند عائلات كتير ده أكبر عيد في السنة. بيمشي على التقويم الأرثوذكسي، فميعاده ممكن يختلف عن الفصح في أماكن تانية.' },
    ],
  },
  {
    code: 'EG', flag: '🇪🇬', name: 'Egypt', nameAr: 'مصر',
    cards: [
      { icon: 'hand-left-outline',
        t: 'Saying hello', tAr: 'التحية',
        b: '“Salamu alaikum” or “Sabah el-kheir” (good morning) are common. Handshakes are usual; between a man and a woman, it is fine to wait and see whether a hand is offered.',
        bAr: '«السلام عليكم» أو «صباح الخير» تحيات منتشرة. السلام باليد معتاد؛ وبين راجل وست، عادي تستنى تشوف لو الإيد اتمدت.' },
      { icon: 'cafe-outline',
        t: 'Being a guest', tAr: 'لما تبقى ضيف',
        b: 'Guests are almost always offered tea or something to eat. A first “no, thank you” is often heard as politeness, so you may be asked again — that is warmth, not pressure.',
        bAr: 'الضيف تقريبًا دايمًا بيتقدّم له شاي أو حاجة ياكلها. أول «لا شكرًا» كتير بتتفهم إنها ذوق، فممكن يتعرض عليك تاني — ده كرم، مش ضغط.' },
      { icon: 'time-outline',
        t: 'Evenings', tAr: 'السهرة',
        b: 'Evenings start late; dinner at nine or ten is normal, and cafés stay busy past midnight. Plans are often made the same day.',
        bAr: 'السهرة بتبدأ متأخر؛ العشا الساعة ٩ أو ١٠ عادي، والقهاوي بتفضل زحمة بعد نص الليل. الخطط كتير بتتعمل في نفس اليوم.' },
      { icon: 'cash-outline',
        t: 'Small tips', tAr: 'البقشيش',
        b: 'Small tips are part of daily life — for delivery, parking, help with bags. Keeping some small notes makes these moments easy.',
        bAr: 'البقشيش الصغير جزء من الحياة اليومية — للدليفري، والركنة، واللي بيساعدك في الشنط. خلي معاك فكة صغيرة وهتبقى الدنيا أسهل.' },
      { icon: 'calendar-outline',
        t: 'The weekend', tAr: 'الويك إند',
        b: 'The weekend is Friday and Saturday. Midday on Friday is prayer time for many people, and some shops open later.',
        bAr: 'الويك إند الجمعة والسبت. الضهر يوم الجمعة وقت صلاة لناس كتير، وبعض المحلات بتفتح متأخر.' },
      { icon: 'moon-outline',
        t: 'Ramadan', tAr: 'رمضان',
        b: 'Many people fast from dawn to sunset. Eating and drinking discreetly in public during the day is a kind gesture. Evenings after iftar are lively and social — a good time to be invited.',
        bAr: 'ناس كتير بتصوم من الفجر للمغرب. إنك تاكل وتشرب بهدوء في الشارع بالنهار لفتة لطيفة. الليالي بعد الفطار حلوة وفيها ناس — وقت حلو تتعزم فيه.' },
      { icon: 'business-outline',
        t: 'Mosques and churches', tAr: 'الجوامع والكنايس',
        b: 'Shoulders and knees are covered; in mosques women usually cover their hair, and shoes come off at the door. Visitors are generally welcome outside prayer times.',
        bAr: 'الكتاف والركب بتبقى متغطية؛ في الجوامع الستات عادة بيغطوا شعرهم، والجزمة بتتقلع عند الباب. الزوار عمومًا مرحب بيهم برا أوقات الصلاة.' },
    ],
  },
];

export const settleFor = (code) => SETTLE.find((c) => c.code === code) || null;
