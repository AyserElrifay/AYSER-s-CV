/* ─── THE WORDS OF THE GAMES ──────────────────────────────────────────
   Every card, question and word here was written for Moments — no
   deck, name or list copied from a boxed game or another app. The game
   names are ours too ("Don't say it", "The outsider", "Act it out");
   the ideas underneath them are old party games nobody owns.

   The screens speak all sixteen languages for their buttons and titles;
   the cards themselves are in English and Egyptian Arabic for now, and
   fall back to English elsewhere. Loaded only with the games. */

const CORE = {
  en: { slide: "Slide — I'm in tonight", slid: "You're in tonight ✓", games: 'Games', group: 'Play with the group', table: 'At the table', world: 'One world', start: 'Start', next: 'Next', again: 'Again', done: 'Done', reveal: 'Show the answer', close: 'Close', in: "I'm in", out: 'Not this time', send: 'Send', photo: 'Add a photo', vote: 'Vote', guess: 'Guess', players: 'Players', time: 'Time', score: 'Score', skip: 'Skip', got: 'Got it', back: 'Back', twin: 'Twin group', streak: 'Weeks in a row' },
  ar: { slide: "اسحب — أنا معاكم النهارده", slid: "إنت معانا النهارده ✓", games: 'ألعاب', group: 'العبوا مع الجروب', table: 'على الترابيزة', world: 'عالم واحد', start: 'ابدأ', next: 'اللي بعده', again: 'تاني', done: 'خلصت', reveal: 'وريني الإجابة', close: 'اقفل', in: 'أنا معاكم', out: 'المرة دي لأ', send: 'ابعت', photo: 'حط صورة', vote: 'صوّت', guess: 'خمّن', players: 'اللعيبة', time: 'الوقت', score: 'النقط', skip: 'عدّي', got: 'عرفوها', back: 'رجوع', twin: 'الجروب التوأم', streak: 'أسابيع ورا بعض' },
  cs: { slide: "Posuň — dnes jsem u toho", slid: "Dnes jsi u toho ✓", games: 'Hry', group: 'Hrajte ve skupině', table: 'U stolu', world: 'Jeden svět', start: 'Začít', next: 'Další', again: 'Znovu', done: 'Hotovo', reveal: 'Ukázat odpověď', close: 'Zavřít', in: 'Jdu do toho', out: 'Tentokrát ne', send: 'Poslat', photo: 'Přidat foto', vote: 'Hlasovat', guess: 'Hádat', players: 'Hráči', time: 'Čas', score: 'Skóre', skip: 'Přeskočit', got: 'Uhodli', back: 'Zpět', twin: 'Dvojčata', streak: 'Týdnů v řadě' },
  es: { slide: "Desliza — me apunto hoy", slid: "Hoy estás dentro ✓", games: 'Juegos', group: 'Jugad en grupo', table: 'En la mesa', world: 'Un mundo', start: 'Empezar', next: 'Siguiente', again: 'Otra vez', done: 'Hecho', reveal: 'Ver la respuesta', close: 'Cerrar', in: 'Me apunto', out: 'Esta vez no', send: 'Enviar', photo: 'Añadir foto', vote: 'Votar', guess: 'Adivinar', players: 'Jugadores', time: 'Tiempo', score: 'Puntos', skip: 'Pasar', got: '¡Acertado!', back: 'Atrás', twin: 'Grupo gemelo', streak: 'Semanas seguidas' },
  et: { slide: "Libista — täna olen sees", slid: "Täna oled sees ✓", games: 'Mängud', group: 'Mängige grupiga', table: 'Laua taga', world: 'Üks maailm', start: 'Alusta', next: 'Järgmine', again: 'Veel', done: 'Valmis', reveal: 'Näita vastust', close: 'Sulge', in: 'Olen kaasas', out: 'Seekord mitte', send: 'Saada', photo: 'Lisa foto', vote: 'Hääleta', guess: 'Arva', players: 'Mängijad', time: 'Aeg', score: 'Punktid', skip: 'Jäta vahele', got: 'Arvati ära', back: 'Tagasi', twin: 'Kaksikgrupp', streak: 'Nädalat järjest' },
  fr: { slide: "Glisse — je suis là ce soir", slid: "Tu es là ce soir ✓", games: 'Jeux', group: 'Jouer en groupe', table: 'À table', world: 'Un seul monde', start: 'Lancer', next: 'Suivant', again: 'Encore', done: 'Fini', reveal: 'Voir la réponse', close: 'Fermer', in: 'Je viens', out: 'Pas cette fois', send: 'Envoyer', photo: 'Ajouter une photo', vote: 'Voter', guess: 'Deviner', players: 'Joueurs', time: 'Temps', score: 'Score', skip: 'Passer', got: 'Trouvé', back: 'Retour', twin: 'Groupe jumeau', streak: 'Semaines d’affilée' },
  hi: { slide: "स्लाइड करें — आज मैं भी", slid: "आज आप शामिल हैं ✓", games: 'खेल', group: 'ग्रुप के साथ खेलो', table: 'टेबल पर', world: 'एक दुनिया', start: 'शुरू', next: 'अगला', again: 'फिर से', done: 'हो गया', reveal: 'जवाब दिखाओ', close: 'बंद', in: 'मैं आ रहा हूँ', out: 'इस बार नहीं', send: 'भेजो', photo: 'फ़ोटो जोड़ो', vote: 'वोट', guess: 'अंदाज़ा', players: 'खिलाड़ी', time: 'समय', score: 'स्कोर', skip: 'छोड़ो', got: 'सही', back: 'वापस', twin: 'जुड़वां ग्रुप', streak: 'लगातार हफ़्ते' },
  it: { slide: "Scorri — stasera ci sono", slid: "Stasera ci sei ✓", games: 'Giochi', group: 'Giocate in gruppo', table: 'A tavola', world: 'Un mondo', start: 'Inizia', next: 'Avanti', again: 'Ancora', done: 'Fatto', reveal: 'Mostra la risposta', close: 'Chiudi', in: 'Ci sto', out: 'Non stavolta', send: 'Invia', photo: 'Aggiungi foto', vote: 'Vota', guess: 'Indovina', players: 'Giocatori', time: 'Tempo', score: 'Punti', skip: 'Salta', got: 'Indovinato', back: 'Indietro', twin: 'Gruppo gemello', streak: 'Settimane di fila' },
  ja: { slide: "スライドして今夜参加", slid: "今夜参加中 ✓", games: 'ゲーム', group: 'グループで遊ぶ', table: 'テーブルで', world: 'ひとつの世界', start: 'スタート', next: '次へ', again: 'もう一回', done: '完了', reveal: '答えを見る', close: '閉じる', in: '行く', out: '今回はパス', send: '送る', photo: '写真を追加', vote: '投票', guess: '当てる', players: 'プレイヤー', time: '時間', score: 'スコア', skip: 'スキップ', got: '正解', back: '戻る', twin: 'ツイングループ', streak: '連続週' },
  ko: { slide: "밀어서 오늘 참여", slid: "오늘 참여 중 ✓", games: '게임', group: '그룹이랑 놀기', table: '테이블에서', world: '하나의 세계', start: '시작', next: '다음', again: '한 번 더', done: '완료', reveal: '정답 보기', close: '닫기', in: '갈래요', out: '이번엔 패스', send: '보내기', photo: '사진 추가', vote: '투표', guess: '맞히기', players: '플레이어', time: '시간', score: '점수', skip: '건너뛰기', got: '맞혔어요', back: '뒤로', twin: '쌍둥이 그룹', streak: '연속 주' },
  nl: { slide: "Schuif — vanavond doe ik mee", slid: "Je doet vanavond mee ✓", games: 'Spellen', group: 'Speel met de groep', table: 'Aan tafel', world: 'Eén wereld', start: 'Start', next: 'Volgende', again: 'Nog eens', done: 'Klaar', reveal: 'Toon het antwoord', close: 'Sluiten', in: 'Ik doe mee', out: 'Deze keer niet', send: 'Versturen', photo: 'Foto toevoegen', vote: 'Stemmen', guess: 'Raden', players: 'Spelers', time: 'Tijd', score: 'Score', skip: 'Overslaan', got: 'Geraden', back: 'Terug', twin: 'Tweelinggroep', streak: 'Weken op rij' },
  pt: { slide: "Deslize — hoje eu topo", slid: "Hoje você está dentro ✓", games: 'Jogos', group: 'Joguem em grupo', table: 'À mesa', world: 'Um mundo', start: 'Começar', next: 'Seguinte', again: 'Outra vez', done: 'Feito', reveal: 'Ver a resposta', close: 'Fechar', in: 'Eu vou', out: 'Desta vez não', send: 'Enviar', photo: 'Adicionar foto', vote: 'Votar', guess: 'Adivinhar', players: 'Jogadores', time: 'Tempo', score: 'Pontos', skip: 'Passar', got: 'Acertaram', back: 'Voltar', twin: 'Grupo gémeo', streak: 'Semanas seguidas' },
  ro: { slide: "Glisează — sunt în seara asta", slid: "Ești în seara asta ✓", games: 'Jocuri', group: 'Jucați în grup', table: 'La masă', world: 'O lume', start: 'Începe', next: 'Următorul', again: 'Încă o dată', done: 'Gata', reveal: 'Arată răspunsul', close: 'Închide', in: 'Vin și eu', out: 'Nu de data asta', send: 'Trimite', photo: 'Adaugă poză', vote: 'Votează', guess: 'Ghicește', players: 'Jucători', time: 'Timp', score: 'Scor', skip: 'Sari', got: 'Ghicit', back: 'Înapoi', twin: 'Grup geamăn', streak: 'Săptămâni la rând' },
  ru: { slide: "Сдвинь — я сегодня в деле", slid: "Ты сегодня в деле ✓", games: 'Игры', group: 'Играть с группой', table: 'За столом', world: 'Один мир', start: 'Начать', next: 'Дальше', again: 'Ещё раз', done: 'Готово', reveal: 'Показать ответ', close: 'Закрыть', in: 'Я в деле', out: 'Не в этот раз', send: 'Отправить', photo: 'Добавить фото', vote: 'Голосовать', guess: 'Угадать', players: 'Игроки', time: 'Время', score: 'Счёт', skip: 'Пропустить', got: 'Угадали', back: 'Назад', twin: 'Группа-близнец', streak: 'Недель подряд' },
  tr: { slide: "Kaydır — bu akşam varım", slid: "Bu akşam varsın ✓", games: 'Oyunlar', group: 'Grupla oyna', table: 'Masada', world: 'Tek dünya', start: 'Başla', next: 'Sonraki', again: 'Tekrar', done: 'Bitti', reveal: 'Cevabı göster', close: 'Kapat', in: 'Ben varım', out: 'Bu sefer yok', send: 'Gönder', photo: 'Fotoğraf ekle', vote: 'Oy ver', guess: 'Tahmin et', players: 'Oyuncular', time: 'Süre', score: 'Puan', skip: 'Geç', got: 'Bildiler', back: 'Geri', twin: 'İkiz grup', streak: 'Üst üste hafta' },
  uk: { slide: "Посунь — я сьогодні з вами", slid: "Ти сьогодні з нами ✓", games: 'Ігри', group: 'Грати з групою', table: 'За столом', world: 'Один світ', start: 'Почати', next: 'Далі', again: 'Ще раз', done: 'Готово', reveal: 'Показати відповідь', close: 'Закрити', in: 'Я з вами', out: 'Цього разу ні', send: 'Надіслати', photo: 'Додати фото', vote: 'Голосувати', guess: 'Вгадати', players: 'Гравці', time: 'Час', score: 'Рахунок', skip: 'Пропустити', got: 'Вгадали', back: 'Назад', twin: 'Група-близнюк', streak: 'Тижнів поспіль' },
  zh: { slide: "滑动 — 今晚我加入", slid: "今晚你已加入 ✓", games: '游戏', group: '和群组一起玩', table: '在桌边', world: '同一个世界', start: '开始', next: '下一个', again: '再来', done: '完成', reveal: '看答案', close: '关闭', in: '我去', out: '这次不了', send: '发送', photo: '添加照片', vote: '投票', guess: '猜', players: '玩家', time: '时间', score: '分数', skip: '跳过', got: '猜对了', back: '返回', twin: '姐妹群', streak: '连续周数' },
};

/* the longer lines: English and Egyptian Arabic */
const LONG = {
  en: {
    roulette: 'Plan Roulette', roulette_s: 'Spin a plan. Three “I’m in” and it goes on the map.',
    likely: 'Most likely to…', likely_s: 'Vote for one of you. The winner picks the next outing.',
    bingo: 'Moments Bingo', bingo_s: 'Nine things to do together this week.',
    spot: 'Guess the spot', spot_s: 'A close-up of a place in your city. Who knows where?',
    truths: 'Two truths & a plan', truths_s: 'Two true things and one thing you want to do. Guess which — then do it.',
    spin: 'Spin', spin_again: 'Spin again', post: 'Send to the group', need: '{n} of {k} are in', on: 'It’s on — put it on the map',
    make_plan: 'Make it a plan', top: 'Most votes: {name}', picks: '{name} picks the next outing',
    cells_done: '{n} of 9 done', did_it: 'We did it', week_card: 'This week’s card',
    hint_ph: 'A small hint (optional)', answer_ph: 'Where is it? (only the group’s answer)', guess_ph: 'Your guess', guessed: '{name} got it: {a}', tries: '{n} tries left', wrong: 'Not that — try again',
    truth_ph: 'Something true about you', plan_ph: 'Something you want to do', which_plan: 'Tap the one that’s the plan', pick_one: 'Which one is the plan?', the_plan: 'This was the plan', who_in: 'Who’s doing it with them?',
    met: 'We met this week', met_s: 'When two of you tap it, the week counts.', met_n: '{n} said so this week',
    weeks: '{n} weeks in a row', weeks0: 'Meet this week to start your streak',
    twin_s: 'Your group and a group in another country. Four weeks, the same small thing each week, one shared board.',
    twin_ask: 'Find our twin', twin_wait: 'Looking for a group in another country… We’ll tell you here when we find one.', twin_cancel: 'Stop looking', twin_end: 'End the twin',
    twin_small: 'A twin needs a group of 3 or more.', twin_admins: 'Only the group’s admins can do this.', twin_country: 'Add your country in your profile first.',
    twin_week: 'Week {n} of 4', twin_safe: 'Group to group: first names only, no private messages. Report anything off.', twin_none: 'Nothing yet — post first.', twin_ph: 'Say something to them…',
    world_s: 'The same thing, everywhere, on the same day.', sky_t: 'Sky', dish_t: 'Dish', walk_t: 'Walk',
    sky: 'Golden hour', sky_s: 'One photo of the sky tonight, wherever you are. The strip goes round the world with the sun.',
    dish: 'Dish of the month', dish_s: 'Everybody cooks the same dish this month — show yours.',
    walk: 'The long walk', walk_s: 'Every kilometre people here walk, added up — from Cairo onwards. You type yours; at most 30 a day.',
    walk_km: '{km} km walked by {p} people in {c} countries', walk_at: 'We’ve reached {place}', walk_next: '{km} km to {place}', walk_today: 'I walked today (km)', walk_mine: 'You: {km} km',
    entries: '{n} photos · {c} countries', none_yet: 'Nobody yet today — be the first.', yours: 'Yours', remove: 'Remove',
    no_faces: 'No faces of other people without their OK.', caption_ph: 'One line (optional)', city_ph: 'Your city',
    world_card: 'Tonight: golden hour', world_card_s: 'One photo of the sky, from everywhere.',
    party_s: 'One phone, passed round the table.',
    q: 'Questions', q_s: 'Warm-up, deeper, funny.', warm: 'Warm-up', deep: 'Deeper', fun: 'Funny',
    outsider: 'The outsider', outsider_s: 'Everyone knows the place — except one. Find them.', o_pass: 'Pass the phone to player {n}', o_see: 'Tap to see', o_you_out: 'You are the outsider. Listen, blend in, guess the place.', o_place: 'The place: {p}', o_hide: 'Hide and pass', o_talk: 'Everyone has seen. Ask each other questions — who is the outsider?', o_show: 'Show the place',
    act: 'Act it out', act_s: 'No words. 60 seconds. Your team guesses.',
    dont: 'Don’t say it', dont_s: 'Explain the word without the three words under it.',
    ready: 'Pass it to whoever is acting, then start.', time_up: 'Time’s up!', round: 'Round score: {n}',
    err: 'That did not work — try again', setup: 'Games need one more step on the server.', offline: 'You’re offline.', slow_down: 'That’s a lot of games today — try tomorrow.', over: 'This game is over.', empty: 'Fill it in first.', photo_err: 'The photo did not upload.', yours_err: 'It’s your own game.', no_more: 'No more tries.',
  },
  ar: {
    roulette: 'عجلة الخروجات', roulette_s: 'لفّ العجلة على خطة. لو 3 قالوا "معاكم" تنزل على الخريطة.',
    likely: 'مين أكتر واحد…', likely_s: 'صوّتوا لحد فيكم. اللي يكسب يختار الخروجة الجاية.',
    bingo: 'بينجو مومنتس', bingo_s: '9 حاجات تعملوها سوا الأسبوع ده.',
    spot: 'المكان ده فين؟', spot_s: 'صورة مقرّبة لمكان في مدينتكم. مين يعرفه؟',
    truths: 'حقيقتين وخطة', truths_s: 'حاجتين حقيقيتين عنك وحاجة نفسك تعملها. خمّنوا أنهي — وبعدين اعملوها.',
    spin: 'لِفّ', spin_again: 'لِفّ تاني', post: 'ابعتها للجروب', need: '{n} من {k} معاكم', on: 'اتفقنا — حطوها على الخريطة',
    make_plan: 'اعملها خطة', top: 'أكتر أصوات: {name}', picks: '{name} يختار الخروجة الجاية',
    cells_done: '{n} من 9 خلصوا', did_it: 'عملناها', week_card: 'كارت الأسبوع ده',
    hint_ph: 'تلميحة صغيرة (اختياري)', answer_ph: 'المكان ده فين؟ (الإجابة مخفية عن الجروب)', guess_ph: 'تخمينك', guessed: '{name} عرفها: {a}', tries: 'فاضلك {n} محاولات', wrong: 'لأ مش ده — جرّب تاني',
    truth_ph: 'حاجة حقيقية عنك', plan_ph: 'حاجة نفسك تعملها', which_plan: 'دوس على اللي هي الخطة', pick_one: 'أنهي واحدة هي الخطة؟', the_plan: 'دي كانت الخطة', who_in: 'مين هيعملها معاه؟',
    met: 'اتقابلنا الأسبوع ده', met_s: 'لما اتنين منكم يدوسوا، الأسبوع يتحسب.', met_n: '{n} قالوا كده الأسبوع ده',
    weeks: '{n} أسابيع ورا بعض', weeks0: 'اتقابلوا الأسبوع ده عشان تبدأوا السلسلة',
    twin_s: 'جروبكم وجروب في بلد تانية. 4 أسابيع، نفس الحاجة الصغيرة كل أسبوع، وبورد واحد مشترك.',
    twin_ask: 'دوّر على توأمنا', twin_wait: 'بندوّر على جروب في بلد تانية… هنقولكم هنا أول ما نلاقي.', twin_cancel: 'بطّل تدوير', twin_end: 'إنهاء التوأمة',
    twin_small: 'التوأم محتاج جروب فيه 3 أو أكتر.', twin_admins: 'الأدمنز بس يقدروا يعملوا ده.', twin_country: 'حط بلدك في البروفايل الأول.',
    twin_week: 'الأسبوع {n} من 4', twin_safe: 'جروب لجروب: الاسم الأول بس، ومفيش رسايل خاصة. بلّغ عن أي حاجة غلط.', twin_none: 'لسه مفيش — ابدأ إنت.', twin_ph: 'قولهم حاجة…',
    world_s: 'نفس الحاجة، في كل حتة، في نفس اليوم.', sky_t: 'الغروب', dish_t: 'الأكلة', walk_t: 'المشي',
    sky: 'ساعة الغروب', sky_s: 'صورة واحدة للسما النهارده، من أي مكان إنت فيه. الشريط بيلف الدنيا مع الشمس.',
    dish: 'أكلة الشهر', dish_s: 'كلنا نطبخ نفس الأكلة الشهر ده — ورّينا أكلتك.',
    walk: 'المشوار الطويل', walk_s: 'كل كيلو بيمشيه الناس هنا، بيتجمع — من القاهرة ولقدّام. إنت بتكتب الكيلوهات بتاعتك؛ 30 بالكتير في اليوم.',
    walk_km: '{km} كم مشيهم {p} شخص في {c} دولة', walk_at: 'وصلنا {place}', walk_next: 'فاضل {km} كم لـ {place}', walk_today: 'مشيت النهارده (كم)', walk_mine: 'إنت: {km} كم',
    entries: '{n} صورة · {c} دولة', none_yet: 'لسه محدش النهارده — كن الأول.', yours: 'بتاعتك', remove: 'شيلها',
    no_faces: 'من غير وشوش ناس تانية إلا بموافقتهم.', caption_ph: 'سطر واحد (اختياري)', city_ph: 'مدينتك',
    world_card: 'النهارده: ساعة الغروب', world_card_s: 'صورة واحدة للسما، من كل حتة في الدنيا.',
    party_s: 'موبايل واحد، بيلف على الترابيزة.',
    q: 'أسئلة', q_s: 'تسخين، أعمق، ضحك.', warm: 'تسخين', deep: 'أعمق', fun: 'ضحك',
    outsider: 'الغريب', outsider_s: 'الكل عارف المكان — إلا واحد. اكتشفوه.', o_pass: 'إدّي الموبايل للّعيب رقم {n}', o_see: 'دوس عشان تشوف', o_you_out: 'إنت الغريب. اسمع، اندمج، وخمّن المكان.', o_place: 'المكان: {p}', o_hide: 'خبّي وعدّي', o_talk: 'الكل شاف. اسألوا بعض — مين الغريب؟', o_show: 'وريني المكان',
    act: 'مثّلها', act_s: 'من غير كلام. 60 ثانية. فريقك يخمّن.',
    dont: 'متقولهاش', dont_s: 'اشرح الكلمة من غير ما تقول التلات كلمات اللي تحتها.',
    ready: 'إدّي الموبايل للي هيمثّل، وابدأ.', time_up: 'الوقت خلص!', round: 'نقط الجولة: {n}',
    err: 'ماحصلش — جرّب تاني', setup: 'الألعاب محتاجة خطوة كمان على السيرفر.', offline: 'إنت أوفلاين.', slow_down: 'ألعاب كتير النهارده — جرّبوا بكرة.', over: 'اللعبة دي خلصت.', empty: 'املاها الأول.', photo_err: 'الصورة ما اترفعتش.', yours_err: 'دي لعبتك إنت.', no_more: 'خلصت محاولاتك.',
  },
};

export const gw = (lang, k) => (CORE[lang] && CORE[lang][k]) || (LONG[lang] && LONG[lang][k]) || CORE.en[k] || LONG.en[k] || k;
export const fill = (s, o) => Object.keys(o).reduce((a, k) => a.split('{' + k + '}').join(String(o[k])), s);
const pickL = (lang, o) => (lang === 'ar' ? o.ar : o.en);
export const say = pickL;

/* Plan Roulette — ideas cheap to do, in any city */
export const ROULETTE = [
  { e: '☕', kind: 'coffee', hour: 18, en: 'Coffee somewhere none of us has been', ar: 'قهوة في مكان محدش فينا راحه' },
  { e: '🌅', kind: 'walk', hour: 17, en: 'Sunset walk by the water', ar: 'تمشية الغروب جنب المية' },
  { e: '🍢', kind: 'culture', hour: 20, en: 'Street-food night: three stops, one dish each', ar: 'ليلة أكل شارع: 3 أماكن، أكلة في كل واحد' },
  { e: '🎨', kind: 'art', hour: 16, en: 'Sketch the same street together', ar: 'نرسم نفس الشارع سوا' },
  { e: '🏸', kind: 'sport', hour: 9, en: 'Morning game in the park', ar: 'ماتش الصبح في الجنينة' },
  { e: '📚', kind: 'circle', hour: 19, en: 'Bring a book, swap a book', ar: 'هات كتاب وخد كتاب' },
  { e: '🎤', kind: 'culture', hour: 21, en: 'An open-mic or live music night', ar: 'ليلة أوبن مايك أو مزيكا لايف' },
  { e: '🧺', kind: 'cleanup', hour: 10, en: 'One hour cleaning a spot we love', ar: 'ساعة ننضف فيها مكان بنحبه' },
  { e: '🏛️', kind: 'culture', hour: 11, en: 'A museum none of us has visited', ar: 'متحف محدش فينا زاره' },
  { e: '🚲', kind: 'sport', hour: 8, en: 'Rent bikes and ride somewhere new', ar: 'نأجّر عجل ونروح حتة جديدة' },
  { e: '🍳', kind: 'circle', hour: 13, en: 'Cook lunch together at someone’s place', ar: 'نطبخ الغدا سوا عند حد' },
  { e: '🎲', kind: 'circle', hour: 19, en: 'Board-game evening in a café', ar: 'سهرة بورد جيمز في كافيه' },
  { e: '🌳', kind: 'walk', hour: 7, en: 'Sunrise walk, breakfast after', ar: 'تمشية الشروق وبعدها فطار' },
  { e: '🛶', kind: 'walk', hour: 17, en: 'A boat ride at golden hour', ar: 'مركب وقت الغروب' },
  { e: '🧘', kind: 'focus', hour: 8, en: 'Yoga or stretching outdoors', ar: 'يوجا أو إطالات في الهوا' },
  { e: '🎬', kind: 'culture', hour: 21, en: 'A film, then talk about it over tea', ar: 'فيلم، وبعدها نتكلم عليه على شاي' },
];

/* Most likely to… */
export const LIKELY = [
  ['get lost on the way to the meeting point', 'يتوه وهو رايح مكان التجمع'],
  ['order the strangest thing on the menu', 'يطلب أغرب حاجة في المنيو'],
  ['make friends with the waiter', 'يصاحب الويتر'],
  ['say yes to a trip with one hour’s notice', 'يوافق على رحلة قبلها بساعة'],
  ['start dancing first', 'يبدأ يرقص الأول'],
  ['bring snacks for everyone', 'يجيب أكل للكل'],
  ['know a secret place in the city', 'يعرف مكان سري في المدينة'],
  ['take a hundred photos of one sunset', 'ياخد 100 صورة لغروب واحد'],
  ['fall asleep first on a road trip', 'ينام الأول في الرحلة'],
  ['win any argument', 'يكسب أي نقاش'],
  ['learn a new language this year', 'يتعلم لغة جديدة السنة دي'],
  ['be late but bring a great excuse', 'يتأخر بس يجيب عذر جامد'],
  ['plan the whole trip in a spreadsheet', 'يخطط الرحلة كلها في شيت إكسل'],
  ['sing in the car', 'يغني في العربية'],
  ['adopt a street cat', 'يتبنّى قطة من الشارع'],
  ['become famous one day', 'يبقى مشهور في يوم'],
  ['pay for everyone without saying', 'يدفع للكل من غير ما يقول'],
  ['try the spiciest food', 'يجرب أحرق أكل'],
];

/* Bingo — nine of these a week */
export const BINGO = [
  ['Watch a sunset together', 'نتفرج على غروب سوا'], ['Eat street food', 'ناكل أكل شارع'], ['A place none of us knew', 'مكان محدش فينا يعرفه'],
  ['Take one group photo', 'صورة جماعية واحدة'], ['Walk 5 km together', 'نمشي 5 كم سوا'], ['Try a new café', 'نجرب كافيه جديد'],
  ['Learn one word in a new language', 'نتعلم كلمة بلغة جديدة'], ['Play a game at the table', 'نلعب لعبة على الترابيزة'], ['Cook something together', 'نطبخ حاجة سوا'],
  ['Help someone for an hour', 'نساعد حد لمدة ساعة'], ['Listen to live music', 'نسمع مزيكا لايف'], ['Visit a museum or gallery', 'نزور متحف أو جاليري'],
  ['Phones away for one hour', 'الموبايلات بعيد ساعة'], ['Sunrise, anywhere', 'شروق، في أي حتة'], ['Invite someone new', 'نعزم حد جديد'],
  ['A picnic', 'بيكنيك'], ['Ride a bike or a boat', 'عجلة أو مركب'], ['Thank a stranger', 'نشكر حد منعرفوش'],
  ['Read in a park', 'نقرا في جنينة'], ['Dance, even a little', 'نرقص، ولو شوية'], ['Buy from a small maker', 'نشتري من صانع صغير'],
];

/* Questions at the table */
export const QUESTIONS = {
  warm: [
    ['What did you eat today that you’d eat again tomorrow?', 'أكلت إيه النهارده وتاكله تاني بكرة؟'],
    ['Which place in this city feels like yours?', 'أنهي مكان في المدينة دي حاسس إنه بتاعك؟'],
    ['What’s a small thing that made you smile this week?', 'إيه حاجة صغيرة خلتك تبتسم الأسبوع ده؟'],
    ['What song is stuck in your head lately?', 'إيه الأغنية اللي لازقة في دماغك اليومين دول؟'],
    ['Tea or coffee — and how exactly?', 'شاي ولا قهوة — وإزاي بالظبط؟'],
    ['What was your first job, even a tiny one?', 'إيه أول شغلانة اشتغلتها، ولو صغيرة؟'],
    ['If today had one more hour, what would you do with it?', 'لو النهارده فيه ساعة زيادة، هتعمل فيها إيه؟'],
    ['What’s a skill you have that nobody here knows?', 'إيه مهارة عندك محدش هنا يعرفها؟'],
    ['Best trip you took with almost no money?', 'أحلى رحلة عملتها بفلوس قليلة أوي؟'],
    ['What are you looking forward to this month?', 'مستني إيه الشهر ده؟'],
  ],
  deep: [
    ['What is something you changed your mind about?', 'إيه حاجة غيّرت رأيك فيها؟'],
    ['Who taught you something you still use every day?', 'مين علّمك حاجة لسه بتستخدمها كل يوم؟'],
    ['When did you last feel really proud of yourself?', 'آخر مرة حسيت إنك فخور بنفسك بجد كانت إمتى؟'],
    ['What would you do if you knew nobody would judge you?', 'كنت هتعمل إيه لو عارف إن محدش هيحكم عليك؟'],
    ['What does a good friend do that others don’t?', 'الصاحب الحلو بيعمل إيه غير الباقيين؟'],
    ['What do you want to be remembered for?', 'عايز الناس تفتكرك بإيه؟'],
    ['Which year of your life would you visit again?', 'أنهي سنة من حياتك نفسك ترجعلها؟'],
    ['What are you learning about yourself lately?', 'بتتعلم إيه عن نفسك اليومين دول؟'],
    ['What’s a fear you got over?', 'إيه خوف قدرت تتخطاه؟'],
    ['What makes a place feel like home?', 'إيه اللي بيخلي المكان يحسسك إنه بيتك؟'],
  ],
  fun: [
    ['If you were a dish, which one and why?', 'لو إنت أكلة، هتبقى أنهي وليه؟'],
    ['Which animal would be the rudest if it could talk?', 'أنهي حيوان هيبقى أقل ذوق لو بيتكلم؟'],
    ['You can only eat one food for a month — go.', 'تاكل أكلة واحدة بس لمدة شهر — اختار.'],
    ['What would your walk-on song be?', 'إيه الأغنية اللي تشتغل وإنت داخل أي مكان؟'],
    ['Invent a new national holiday. What is it?', 'اخترع عيد قومي جديد. إيه هو؟'],
    ['What’s the most useless talent you have?', 'إيه أكتر موهبة ملهاش لازمة عندك؟'],
    ['Which person here would survive a zombie film longest?', 'مين هنا هيعيش أطول في فيلم زومبي؟'],
    ['If your pet had a job, what would it be?', 'لو الحيوان الأليف بتاعك ليه شغلانة، هتبقى إيه؟'],
    ['Describe your week as a weather forecast.', 'وصّف أسبوعك كأنه نشرة جوية.'],
    ['What would you name a café if you opened one?', 'لو فتحت كافيه هتسميه إيه؟'],
  ],
};

/* The outsider — places everybody knows */
export const PLACES = [
  ['A wedding', 'فرح'], ['A felucca on the Nile', 'فلوكة في النيل'], ['The airport', 'المطار'], ['A football stadium', 'استاد كورة'],
  ['A hospital', 'مستشفى'], ['A beach in summer', 'شط في الصيف'], ['A cinema', 'سينما'], ['A supermarket', 'سوبر ماركت'],
  ['A school classroom', 'فصل في مدرسة'], ['A train at night', 'قطر بالليل'], ['A desert camp', 'كامب في الصحرا'], ['A barber shop', 'محل حلاقة'],
  ['A museum', 'متحف'], ['A gym', 'جيم'], ['A street-food cart', 'عربية أكل شارع'], ['A library', 'مكتبة'],
  ['A bakery at dawn', 'فرن عيش الفجر'], ['A rooftop party', 'حفلة على السطح'], ['A camping trip in the mountains', 'تخييم في الجبل'], ['A busy market', 'سوق زحمة'],
];

/* Act it out — things anyone can mime */
export const ACT = [
  ['Brushing your teeth', 'بتغسل سنانك'], ['Riding a camel', 'راكب جمل'], ['Taking a selfie', 'بتاخد سيلفي'], ['Fishing', 'بتصطاد'],
  ['Making tea', 'بتعمل شاي'], ['A cat', 'قطة'], ['Driving in traffic', 'سايق في زحمة'], ['Swimming', 'بتعوم'],
  ['A waiter', 'ويتر'], ['Playing the guitar', 'بتعزف جيتار'], ['Climbing a mountain', 'بتطلع جبل'], ['A doctor', 'دكتور'],
  ['Dancing at a wedding', 'بترقص في فرح'], ['Bargaining at a market', 'بتفاصل في السوق'], ['Waking up late', 'صاحي متأخر'], ['A pharaoh', 'فرعون'],
  ['Flying a kite', 'بتطيّر طيارة ورق'], ['Cooking koshari', 'بتعمل كشري'], ['A goalkeeper', 'حارس مرمى'], ['Reading a map', 'بتقرا خريطة'],
  ['An elephant', 'فيل'], ['Painting a wall', 'بتدهن حيطة'], ['Missing the bus', 'فاتك الأتوبيس'], ['A photographer', 'مصوّر'],
];

/* Don't say it — the word, and three you can't use */
export const DONT = [
  { en: ['Sunset', 'sun', 'evening', 'orange'], ar: ['الغروب', 'شمس', 'مغرب', 'برتقالي'] },
  { en: ['Coffee', 'drink', 'cup', 'morning'], ar: ['قهوة', 'مشروب', 'فنجان', 'الصبح'] },
  { en: ['Pyramid', 'Egypt', 'stone', 'pharaoh'], ar: ['هرم', 'مصر', 'حجر', 'فرعون'] },
  { en: ['Beach', 'sea', 'sand', 'summer'], ar: ['شط', 'بحر', 'رملة', 'صيف'] },
  { en: ['Wedding', 'bride', 'dance', 'ring'], ar: ['فرح', 'عروسة', 'رقص', 'دبلة'] },
  { en: ['Football', 'goal', 'ball', 'match'], ar: ['كورة', 'جون', 'كورة قدم', 'ماتش'] },
  { en: ['Phone', 'call', 'screen', 'apps'], ar: ['موبايل', 'مكالمة', 'شاشة', 'أبلكيشن'] },
  { en: ['Train', 'station', 'rail', 'ticket'], ar: ['قطر', 'محطة', 'قضبان', 'تذكرة'] },
  { en: ['Teacher', 'school', 'class', 'students'], ar: ['مدرّس', 'مدرسة', 'فصل', 'طلبة'] },
  { en: ['Rain', 'water', 'clouds', 'umbrella'], ar: ['مطر', 'مية', 'سحاب', 'شمسية'] },
  { en: ['Birthday', 'cake', 'candles', 'age'], ar: ['عيد ميلاد', 'تورتة', 'شمع', 'سن'] },
  { en: ['Library', 'books', 'read', 'quiet'], ar: ['مكتبة', 'كتب', 'قراية', 'هدوء'] },
  { en: ['Desert', 'sand', 'hot', 'camel'], ar: ['صحرا', 'رملة', 'حر', 'جمل'] },
  { en: ['Guitar', 'strings', 'music', 'play'], ar: ['جيتار', 'أوتار', 'مزيكا', 'تعزف'] },
  { en: ['Airport', 'plane', 'flight', 'passport'], ar: ['مطار', 'طيارة', 'رحلة', 'باسبور'] },
  { en: ['Picnic', 'park', 'blanket', 'food'], ar: ['بيكنيك', 'جنينة', 'بطانية', 'أكل'] },
  { en: ['Cat', 'meow', 'pet', 'whiskers'], ar: ['قطة', 'نونو', 'أليف', 'شنب'] },
  { en: ['Market', 'buy', 'sell', 'price'], ar: ['سوق', 'تشتري', 'تبيع', 'سعر'] },
  { en: ['Moon', 'night', 'sky', 'full'], ar: ['قمر', 'ليل', 'سما', 'بدر'] },
  { en: ['Bicycle', 'wheels', 'ride', 'pedal'], ar: ['عجلة', 'كاوتش', 'تركب', 'بدّال'] },
];

/* Twin groups: the same small thing each week */
export const TWIN_WEEKS = [
  ['Hello from here: a photo of your favourite corner of your city, and one word in your language.', 'أهلاً من هنا: صورة لأحب ركن ليكم في مدينتكم، وكلمة واحدة بلغتكم.'],
  ['Same table: eat your city’s street food together and show it.', 'نفس الترابيزة: كلوا أكل الشارع بتاع مدينتكم سوا وورّوهم.'],
  ['Golden hour: watch the sunset together, wherever you are.', 'ساعة الغروب: اتفرجوا على الغروب سوا، في أي حتة.'],
  ['If you came here: the one place you’d take them, and why.', 'لو جيتوا هنا: المكان الوحيد اللي هتاخدوهم ليه، وليه.'],
];

/* Dish of the month — dishes with no owner */
export const DISHES = [
  ['Lentil soup', 'شوربة عدس'], ['Pancakes', 'بان كيك'], ['Falafel', 'فلافل'], ['Flatbread from scratch', 'عيش بلدي في البيت'],
  ['A cold salad from your country', 'سلطة باردة من بلدك'], ['Grilled corn', 'دُرة مشوية'], ['Ice-cold lemonade', 'ليمونادة ساقعة'], ['Stuffed vegetables', 'محشي'],
  ['Rice pudding', 'رز بلبن'], ['Your grandmother’s recipe', 'وصفة تيتة'], ['Soup for a cold night', 'شوربة لليلة باردة'], ['A sweet for the new year', 'حلويات السنة الجديدة'],
];

/* The long walk — real cities on the way, by road-ish distance from Cairo */
export const WALK_STOPS = [
  { km: 0, en: 'Cairo', ar: 'القاهرة' }, { km: 220, en: 'Alexandria', ar: 'إسكندرية' }, { km: 520, en: 'Marsa Matruh', ar: 'مرسى مطروح' },
  { km: 1200, en: 'Benghazi', ar: 'بنغازي' }, { km: 2250, en: 'Tripoli', ar: 'طرابلس' }, { km: 3000, en: 'Tunis', ar: 'تونس' },
  { km: 3700, en: 'Rome', ar: 'روما' }, { km: 4800, en: 'Paris', ar: 'باريس' }, { km: 6300, en: 'Lisbon', ar: 'لشبونة' },
];
