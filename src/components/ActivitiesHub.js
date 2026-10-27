import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Animated, Easing, Platform } from 'react-native';
import { C, NUM } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { DECK, SCENES, POLLS, BADGES, badgeName, cardText } from '../constants/activityDeck';
import {
  activityGet, activityDeal, activitySpin, activityPair, activityTruth, activityPoll,
  truthsSubmit, truthCard, truthVote, pollResult, pollVote, keepInTouch, buddyTap, vibeGive,
} from '../services/live';
import { Face } from '../ui/Face';
import { tapLight, tapMedium, tapSuccess, tapSelection } from '../utils/feedback';

/* ─── LIVE ACTIVITIES ─────────────────────────────────────────────────
   Ayser: people play together THROUGH the app at the table — the phones
   are the controllers, the conversation is in real life. Three modes,
   one shared state for everybody who checked in (RUN_ME.sql, "LIVE
   ACTIVITIES"): whatever one phone deals, every phone shows within a
   few seconds.
     · The Moments Card Deck — Warm-up, Deep Moments, Global Twist (60
       seconds in English, with a clock). "Spin the turn" lets the
       server pick whose turn it is.
     · Two Truths & a Lie, and table polls — vote, then the bars.
     · Roleplay Roulette — two people, one travel scene, 90 seconds.
   After the end: Keep in touch (both tap Connect → Moments Buddies) and
   anonymous Vibe Badges. Violet is the game colour; everything else is
   the warm, quiet canvas. */

const S = {
  en: ['Play together', 'Check in to play with the table.', 'Card Deck', 'Truths & Polls', 'Roleplay', 'Warm-up', 'Deep Moments', 'Global Twist', 'Deal a card', 'Spin the turn', 'It’s {n}’s turn to answer!', '{n}s', 'Two truths and a lie about you', 'Something about you…', 'Tap the one that is the lie', 'Save my card', 'Your card is in. Nobody knows which is the lie.', 'Put a card on the table', 'Which one is the lie?', 'Your card — watch the votes come in.', 'Table poll', 'Tap a person at the table', 'Deal a scene', 'Two people need to check in first.', 'The games open 30 minutes before the start. Write your card now.', '{n} votes', 'The lie', 'No cards yet — be the first to write one.', 'Keep in touch', 'Tap Connect on the people you would like to see again. If they tap you too, you become Moments Buddies.', 'Connect 🤝', 'Waiting for them', 'Buddies ✓', 'Give a vibe badge — they never see who it was from.', 'Open until {d}', 'Nobody else checked in.', 'It did not go through. Try again.', 'Tap to start'],
  ar: ['العبوا سوا', 'اعمل تشيك إن عشان تلعب مع الترابيزة.', 'الكروت', 'حقيقتين وكدبة', 'تمثيل', 'تسخين', 'لحظات عميقة', 'تحدّي عالمي', 'اسحب كارت', 'لفّ الدور', 'الدور على {n} يجاوب!', '{n}ث', 'حقيقتين وكدبة عنك', 'حاجة عنك…', 'دوس على اللي هي الكدبة', 'احفظ الكارت', 'الكارت بتاعك جاهز. محدش يعرف فين الكدبة.', 'حط كارت على الترابيزة', 'أنهي واحدة الكدبة؟', 'ده الكارت بتاعك — اتفرّج على التصويت.', 'تصويت الترابيزة', 'دوس على حد من الترابيزة', 'اسحب مشهد', 'لازم اتنين يعملوا تشيك إن الأول.', 'الألعاب بتفتح قبل البداية بنص ساعة. اكتب الكارت بتاعك من دلوقتي.', '{n} صوت', 'الكدبة', 'لسه مفيش كروت — اكتب أول واحد.', 'خلّيكوا على تواصل', 'دوس "تواصل" على اللي حابب تشوفهم تاني. لو هما كمان داسوا عليك، تبقوا Moments Buddies.', 'تواصل 🤝', 'مستنيين ردّهم', 'Buddies ✓', 'إدّي فايب بادج — مش هيعرفوا مين اللي إداها.', 'مفتوح لحد {d}', 'محدش تاني عمل تشيك إن.', 'ماتبعتش. جرّب تاني.', 'دوس عشان تبدأ'],
  cs: ['Hrajte spolu', 'Přihlas se, ať můžeš hrát se stolem.', 'Karty', 'Pravdy a ankety', 'Scénky', 'Na zahřátí', 'Hluboké chvíle', 'Globální výzva', 'Lízni kartu', 'Kdo je na řadě', 'Na řadě je {n}!', '{n} s', 'Dvě pravdy a lež o tobě', 'Něco o tobě…', 'Klepni na tu, která je lež', 'Uložit kartu', 'Tvoje karta je hotová. Nikdo neví, co je lež.', 'Dát kartu na stůl', 'Která je lež?', 'Tvoje karta — sleduj hlasy.', 'Anketa u stolu', 'Klepni na někoho u stolu', 'Rozdej scénku', 'Nejdřív se musí přihlásit dva lidé.', 'Hry se otevřou 30 minut před začátkem. Napiš kartu už teď.', '{n} hlasů', 'Lež', 'Zatím žádné karty — napiš první.', 'Zůstaňte v kontaktu', 'Klepni na Spojit u lidí, které chceš znovu vidět. Když klepnou i oni, jste Moments Buddies.', 'Spojit 🤝', 'Čeká se na ně', 'Buddies ✓', 'Dej odznak — nedozví se, od koho je.', 'Otevřeno do {d}', 'Nikdo další se nepřihlásil.', 'Nepodařilo se. Zkus to znovu.', 'Klepni a začni'],
  es: ['Jugad juntos', 'Haz check-in para jugar con la mesa.', 'Cartas', 'Verdades y encuestas', 'Roleplay', 'Calentamiento', 'Momentos profundos', 'Reto global', 'Saca una carta', 'Gira el turno', '¡Le toca a {n}!', '{n} s', 'Dos verdades y una mentira sobre ti', 'Algo sobre ti…', 'Toca la que es mentira', 'Guardar mi carta', 'Tu carta está lista. Nadie sabe cuál es la mentira.', 'Poner una carta en la mesa', '¿Cuál es la mentira?', 'Tu carta: mira los votos.', 'Encuesta de mesa', 'Toca a alguien de la mesa', 'Repartir escena', 'Primero tienen que hacer check-in dos personas.', 'Los juegos abren 30 minutos antes. Escribe tu carta ya.', '{n} votos', 'La mentira', 'Aún no hay cartas: escribe la primera.', 'Seguir en contacto', 'Toca Conectar en quien quieras volver a ver. Si te tocan también, sois Moments Buddies.', 'Conectar 🤝', 'Esperando', 'Buddies ✓', 'Da una insignia: nunca sabrán de quién.', 'Abierto hasta {d}', 'Nadie más hizo check-in.', 'No se envió. Inténtalo de nuevo.', 'Toca para empezar'],
  et: ['Mängime koos', 'Registreeru, et lauaga mängida.', 'Kaardid', 'Tõed ja küsitlused', 'Rollimäng', 'Soojendus', 'Sügavad hetked', 'Globaalne väljakutse', 'Tõmba kaart', 'Keeruta järjekorda', '{n} vastab!', '{n} s', 'Kaks tõde ja üks vale sinu kohta', 'Midagi sinust…', 'Puuduta seda, mis on vale', 'Salvesta kaart', 'Sinu kaart on valmis. Keegi ei tea, mis on vale.', 'Pane kaart lauale', 'Milline on vale?', 'Sinu kaart — vaata hääli.', 'Laua küsitlus', 'Puuduta kedagi laua taga', 'Jaga stseen', 'Kaks inimest peavad enne registreeruma.', 'Mängud avanevad 30 minutit enne algust. Kirjuta kaart kohe.', '{n} häält', 'Vale', 'Kaarte veel pole — kirjuta esimene.', 'Hoiame ühendust', 'Puuduta Ühenda nende juures, keda tahad uuesti näha. Kui nemad ka, olete Moments Buddies.', 'Ühenda 🤝', 'Ootame neid', 'Buddies ✓', 'Anna märk — nad ei näe, kellelt.', 'Avatud kuni {d}', 'Keegi teine ei registreerunud.', 'Ei läinud läbi. Proovi uuesti.', 'Puuduta alustamiseks'],
  fr: ['Jouez ensemble', 'Fais ton check-in pour jouer avec la table.', 'Cartes', 'Vérités & sondages', 'Jeu de rôle', 'Échauffement', 'Moments profonds', 'Défi global', 'Tirer une carte', 'Faire tourner', 'C’est au tour de {n} !', '{n} s', 'Deux vérités et un mensonge sur toi', 'Un truc sur toi…', 'Touche celle qui est le mensonge', 'Enregistrer ma carte', 'Ta carte est prête. Personne ne sait où est le mensonge.', 'Poser une carte sur la table', 'Laquelle est le mensonge ?', 'Ta carte — regarde les votes.', 'Sondage de table', 'Touche quelqu’un à la table', 'Tirer une scène', 'Il faut d’abord deux check-ins.', 'Les jeux ouvrent 30 minutes avant. Écris ta carte maintenant.', '{n} votes', 'Le mensonge', 'Pas encore de cartes — écris la première.', 'Rester en contact', 'Touche Connecter pour ceux que tu veux revoir. S’ils te touchent aussi, vous devenez Moments Buddies.', 'Connecter 🤝', 'En attente', 'Buddies ✓', 'Offre un badge — ils ne sauront jamais de qui.', 'Ouvert jusqu’au {d}', 'Personne d’autre n’a fait son check-in.', 'Ça n’est pas passé. Réessaie.', 'Touche pour commencer'],
  hi: ['साथ खेलो', 'टेबल के साथ खेलने के लिए चेक-इन करो।', 'कार्ड डेक', 'सच और पोल', 'रोलप्ले', 'वॉर्म-अप', 'गहरे पल', 'ग्लोबल ट्विस्ट', 'कार्ड निकालो', 'बारी घुमाओ', 'अब {n} की बारी!', '{n} से.', 'तुम्हारे बारे में दो सच और एक झूठ', 'अपने बारे में कुछ…', 'जो झूठ है उस पर टैप करो', 'कार्ड सेव करो', 'तुम्हारा कार्ड तैयार है। किसी को नहीं पता झूठ कौन-सा है।', 'टेबल पर कार्ड रखो', 'झूठ कौन-सा है?', 'तुम्हारा कार्ड — वोट देखो।', 'टेबल पोल', 'टेबल पर किसी पर टैप करो', 'सीन बाँटो', 'पहले दो लोगों का चेक-इन ज़रूरी है।', 'गेम शुरू से 30 मिनट पहले खुलते हैं। अभी अपना कार्ड लिखो।', '{n} वोट', 'झूठ', 'अभी कोई कार्ड नहीं — पहला लिखो।', 'संपर्क में रहो', 'जिनसे फिर मिलना है उन पर कनेक्ट दबाओ। वे भी दबाएँ तो तुम Moments Buddies।', 'कनेक्ट 🤝', 'उनका इंतज़ार', 'Buddies ✓', 'वाइब बैज दो — उन्हें पता नहीं चलेगा किसने दिया।', '{d} तक खुला', 'और किसी ने चेक-इन नहीं किया।', 'नहीं गया। फिर कोशिश करो।', 'शुरू करने के लिए टैप करो'],
  it: ['Giocate insieme', 'Fai il check-in per giocare con il tavolo.', 'Carte', 'Verità e sondaggi', 'Roleplay', 'Riscaldamento', 'Momenti profondi', 'Sfida globale', 'Pesca una carta', 'Gira il turno', 'Tocca a {n}!', '{n} s', 'Due verità e una bugia su di te', 'Qualcosa su di te…', 'Tocca quella che è la bugia', 'Salva la carta', 'La tua carta è pronta. Nessuno sa qual è la bugia.', 'Metti una carta sul tavolo', 'Qual è la bugia?', 'La tua carta: guarda i voti.', 'Sondaggio del tavolo', 'Tocca qualcuno al tavolo', 'Dai una scena', 'Prima devono fare check-in due persone.', 'I giochi aprono 30 minuti prima. Scrivi ora la tua carta.', '{n} voti', 'La bugia', 'Ancora nessuna carta: scrivi la prima.', 'Restiamo in contatto', 'Tocca Connetti su chi vuoi rivedere. Se toccano anche te, siete Moments Buddies.', 'Connetti 🤝', 'In attesa', 'Buddies ✓', 'Dai un badge: non sapranno mai da chi.', 'Aperto fino al {d}', 'Nessun altro ha fatto check-in.', 'Non è andato. Riprova.', 'Tocca per iniziare'],
  ja: ['みんなで遊ぼう', 'テーブルで遊ぶにはチェックインしてね。', 'カード', '真実と投票', 'ロールプレイ', 'ウォームアップ', '深い話', 'グローバル', 'カードを引く', '順番を決める', '{n}さんの番！', '{n}秒', 'あなたについての2つの真実と1つの嘘', 'あなたのこと…', '嘘のものをタップ', '保存', 'カードができました。どれが嘘かは誰も知りません。', 'カードを場に出す', 'どれが嘘？', 'あなたのカード — 投票を見てね。', 'テーブル投票', 'テーブルの誰かをタップ', 'シーンを配る', 'まず2人がチェックインしてね。', 'ゲームは開始30分前に開きます。今カードを書こう。', '{n}票', '嘘', 'まだカードがありません。最初の1枚を。', 'つながろう', 'また会いたい人に「つながる」を。相手も押したら Moments Buddies です。', 'つながる 🤝', '相手を待っています', 'Buddies ✓', 'バッジを贈ろう — 誰からかはわかりません。', '{d}まで', 'ほかに誰もチェックインしていません。', '送れませんでした。もう一度どうぞ。', 'タップしてスタート'],
  ko: ['함께 놀아요', '테이블과 함께 하려면 체크인하세요.', '카드 덱', '진실과 투표', '롤플레이', '워밍업', '깊은 순간', '글로벌 챌린지', '카드 뽑기', '차례 돌리기', '{n}님 차례예요!', '{n}초', '나에 대한 진실 둘, 거짓 하나', '나에 대한 것…', '거짓인 것을 탭하세요', '카드 저장', '카드가 준비됐어요. 무엇이 거짓인지 아무도 몰라요.', '테이블에 카드 놓기', '어느 것이 거짓일까요?', '내 카드 — 투표를 지켜보세요.', '테이블 투표', '테이블의 누군가를 탭하세요', '장면 나누기', '먼저 두 명이 체크인해야 해요.', '게임은 시작 30분 전에 열려요. 지금 카드를 써 두세요.', '{n}표', '거짓', '아직 카드가 없어요 — 첫 카드를 써 보세요.', '계속 연락해요', '다시 보고 싶은 사람에게 연결을 누르세요. 상대도 누르면 Moments Buddies가 돼요.', '연결 🤝', '상대를 기다리는 중', 'Buddies ✓', '바이브 배지를 주세요 — 누가 줬는지 몰라요.', '{d}까지 열림', '다른 체크인한 사람이 없어요.', '전송되지 않았어요. 다시 해 주세요.', '탭해서 시작'],
  nl: ['Speel samen', 'Check in om met de tafel te spelen.', 'Kaarten', 'Waarheden & polls', 'Rollenspel', 'Opwarmer', 'Diepe momenten', 'Global Twist', 'Trek een kaart', 'Draai de beurt', '{n} is aan de beurt!', '{n} s', 'Twee waarheden en een leugen over jou', 'Iets over jou…', 'Tik op de leugen', 'Kaart opslaan', 'Je kaart staat klaar. Niemand weet wat de leugen is.', 'Leg een kaart op tafel', 'Welke is de leugen?', 'Jouw kaart — kijk naar de stemmen.', 'Tafelpoll', 'Tik op iemand aan tafel', 'Deel een scène', 'Eerst moeten twee mensen inchecken.', 'De spellen openen 30 minuten voor de start. Schrijf nu je kaart.', '{n} stemmen', 'De leugen', 'Nog geen kaarten — schrijf de eerste.', 'Contact houden', 'Tik op Verbinden bij wie je terug wilt zien. Tikken zij jou ook, dan zijn jullie Moments Buddies.', 'Verbinden 🤝', 'Wachten op hen', 'Buddies ✓', 'Geef een badge — ze zien nooit van wie.', 'Open tot {d}', 'Niemand anders heeft ingecheckt.', 'Het lukte niet. Probeer opnieuw.', 'Tik om te beginnen'],
  pt: ['Joguem juntos', 'Faz check-in para jogar com a mesa.', 'Cartas', 'Verdades e sondagens', 'Roleplay', 'Aquecimento', 'Momentos profundos', 'Desafio global', 'Tirar uma carta', 'Rodar a vez', 'É a vez de {n}!', '{n} s', 'Duas verdades e uma mentira sobre ti', 'Algo sobre ti…', 'Toca na que é mentira', 'Guardar a carta', 'A tua carta está pronta. Ninguém sabe qual é a mentira.', 'Pôr uma carta na mesa', 'Qual é a mentira?', 'A tua carta — vê os votos.', 'Sondagem da mesa', 'Toca em alguém da mesa', 'Dar uma cena', 'Primeiro têm de fazer check-in duas pessoas.', 'Os jogos abrem 30 minutos antes. Escreve já a tua carta.', '{n} votos', 'A mentira', 'Ainda não há cartas — escreve a primeira.', 'Manter o contacto', 'Toca em Ligar em quem queres voltar a ver. Se te tocarem também, ficam Moments Buddies.', 'Ligar 🤝', 'À espera', 'Buddies ✓', 'Dá um badge — nunca vão saber de quem.', 'Aberto até {d}', 'Mais ninguém fez check-in.', 'Não foi. Tenta outra vez.', 'Toca para começar'],
  ro: ['Jucați împreună', 'Fă check-in ca să joci cu masa.', 'Cărți', 'Adevăruri și sondaje', 'Joc de rol', 'Încălzire', 'Momente profunde', 'Provocare globală', 'Trage o carte', 'Învârte rândul', 'E rândul lui {n}!', '{n} s', 'Două adevăruri și o minciună despre tine', 'Ceva despre tine…', 'Atinge-o pe cea care e minciună', 'Salvează cartea', 'Cartea ta e gata. Nimeni nu știe care e minciuna.', 'Pune o carte pe masă', 'Care e minciuna?', 'Cartea ta — urmărește voturile.', 'Sondajul mesei', 'Atinge pe cineva de la masă', 'Împarte o scenă', 'Mai întâi trebuie să facă check-in două persoane.', 'Jocurile se deschid cu 30 de minute înainte. Scrie-ți cartea acum.', '{n} voturi', 'Minciuna', 'Încă nu sunt cărți — scrie-o pe prima.', 'Păstrăm legătura', 'Atinge Conectează la cei pe care vrei să-i revezi. Dacă te ating și ei, deveniți Moments Buddies.', 'Conectează 🤝', 'Îi așteptăm', 'Buddies ✓', 'Dă o insignă — nu vor ști niciodată de la cine.', 'Deschis până pe {d}', 'Nimeni altcineva n-a făcut check-in.', 'Nu a mers. Încearcă din nou.', 'Atinge ca să începi'],
  ru: ['Играем вместе', 'Отметься, чтобы играть со столом.', 'Карты', 'Правда и опросы', 'Ролевая игра', 'Разминка', 'Глубокие моменты', 'Глобальный вызов', 'Вытянуть карту', 'Чей ход', 'Отвечает {n}!', '{n} с', 'Две правды и одна ложь о тебе', 'Что-то о тебе…', 'Нажми на ложь', 'Сохранить карту', 'Карта готова. Никто не знает, где ложь.', 'Положить карту на стол', 'Где ложь?', 'Твоя карта — смотри голоса.', 'Опрос стола', 'Нажми на кого-то за столом', 'Раздать сцену', 'Сначала должны отметиться двое.', 'Игры откроются за 30 минут до начала. Напиши карту сейчас.', 'Голосов: {n}', 'Ложь', 'Карт пока нет — напиши первую.', 'Оставайтесь на связи', 'Нажми «Связаться» у тех, кого хочешь увидеть снова. Если они тоже нажмут — вы Moments Buddies.', 'Связаться 🤝', 'Ждём их', 'Buddies ✓', 'Подари значок — они не узнают от кого.', 'Открыто до {d}', 'Больше никто не отметился.', 'Не отправилось. Попробуй ещё раз.', 'Нажми, чтобы начать'],
  tr: ['Birlikte oynayın', 'Masayla oynamak için giriş yap.', 'Kartlar', 'Doğrular ve anketler', 'Rol oyunu', 'Isınma', 'Derin anlar', 'Global meydan okuma', 'Kart çek', 'Sırayı çevir', 'Sıra {n}’de!', '{n} sn', 'Seninle ilgili iki doğru bir yalan', 'Seninle ilgili bir şey…', 'Yalan olana dokun', 'Kartı kaydet', 'Kartın hazır. Kimse hangisinin yalan olduğunu bilmiyor.', 'Masaya kart koy', 'Hangisi yalan?', 'Senin kartın — oyları izle.', 'Masa anketi', 'Masadan birine dokun', 'Sahne dağıt', 'Önce iki kişi giriş yapmalı.', 'Oyunlar başlamadan 30 dakika önce açılır. Kartını şimdi yaz.', '{n} oy', 'Yalan', 'Henüz kart yok — ilkini sen yaz.', 'İletişimde kalın', 'Yeniden görmek istediklerine Bağlan’a dokun. Onlar da dokunursa Moments Buddies olursunuz.', 'Bağlan 🤝', 'Onları bekliyoruz', 'Buddies ✓', 'Rozet ver — kimden olduğunu asla görmezler.', '{d} tarihine kadar açık', 'Başka kimse giriş yapmadı.', 'Gitmedi. Tekrar dene.', 'Başlamak için dokun'],
  uk: ['Граймо разом', 'Відміться, щоб грати зі столом.', 'Карти', 'Правда й опитування', 'Рольова гра', 'Розминка', 'Глибокі моменти', 'Глобальний виклик', 'Витягнути карту', 'Чия черга', 'Відповідає {n}!', '{n} с', 'Дві правди й одна брехня про тебе', 'Щось про тебе…', 'Торкнися брехні', 'Зберегти карту', 'Карта готова. Ніхто не знає, де брехня.', 'Покласти карту на стіл', 'Де брехня?', 'Твоя карта — дивись голоси.', 'Опитування столу', 'Торкнися когось за столом', 'Роздати сцену', 'Спершу мають відмітитися двоє.', 'Ігри відкриються за 30 хвилин до початку. Напиши карту зараз.', 'Голосів: {n}', 'Брехня', 'Карт поки немає — напиши першу.', 'Залишаймося на зв’язку', 'Торкнися «Зв’язатися» біля тих, кого хочеш побачити знову. Якщо вони теж — ви Moments Buddies.', 'Зв’язатися 🤝', 'Чекаємо на них', 'Buddies ✓', 'Подаруй значок — вони не дізнаються від кого.', 'Відкрито до {d}', 'Більше ніхто не відмітився.', 'Не вийшло. Спробуй ще раз.', 'Торкнися, щоб почати'],
  zh: ['一起玩', '签到后就能和整桌一起玩。', '卡牌', '真假与投票', '角色扮演', '热身', '深度时刻', '全球挑战', '抽一张', '转一下', '轮到 {n} 回答！', '{n} 秒', '关于你的两真一假', '关于你的事…', '点一下哪条是假的', '保存', '你的卡片好了，没人知道哪条是假的。', '把卡片放上桌', '哪条是假的？', '这是你的卡片——看大家投票。', '整桌投票', '点桌上的某个人', '发一个场景', '需要先有两个人签到。', '游戏在开始前 30 分钟开放，现在就写你的卡片。', '{n} 票', '假的那条', '还没有卡片——写第一张吧。', '保持联系', '对想再见的人点「联系」。如果对方也点了你，你们就是 Moments Buddies。', '联系 🤝', '等对方回应', 'Buddies ✓', '送一枚徽章——对方不会知道是谁送的。', '开放至 {d}', '没有其他人签到。', '没有成功，再试一次。', '点一下开始'],
};
const K = ['title', 'needIn', 'tDeck', 'tTruths', 'tRole', 'warm', 'deep', 'global', 'deal', 'spin', 'turn', 'secs', 'tWrite', 'tPh', 'tLie', 'tSave', 'tSaved', 'tPut', 'tWhich', 'tYours', 'poll', 'pollTap', 'pair', 'needTwo', 'before', 'votes', 'lie', 'none', 'keep', 'keepSub', 'connect', 'waiting', 'buddies', 'vibes', 'closes', 'nobody', 'err', 'start'];
export const w = (lang, k, v) => {
  const i = K.indexOf(k);
  let s = (S[lang] || S.en)[i] || S.en[i] || '';
  Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', String(v[x])); });
  return s;
};
const ND = Platform.OS !== 'web';

const Pill = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} style={{ marginEnd: 8, marginBottom: 8 }}>
    <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? C.purple : C.glass, borderWidth: 1, borderColor: on ? C.purple : C.line }}>
      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
    </View>
  </Pressable>
);
const Primary = ({ label, onPress, ghost }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={{ marginTop: 12 }}>
    <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: ghost ? 'transparent' : C.purple, borderWidth: ghost ? 1 : 0, borderColor: C.purple }}>
      <Text style={{ color: ghost ? C.purple : '#FFF', fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </View>
  </Pressable>
);

/* the clock everyone sees: seconds left, and a bar that empties */
const Clock = ({ endsAt, skew, total, lang }) => {
  const [, tick] = useState(0);
  useEffect(() => { const h = setInterval(() => tick((x) => x + 1), 250); return () => clearInterval(h); }, []);
  const left = Math.max(0, Math.ceil((new Date(endsAt).getTime() - (Date.now() + skew)) / 1000));
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[{ color: left <= 10 ? C.gold : C.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center' }, NUM]}>{w(lang, 'secs', { n: left })}</Text>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: C.glassHi, marginTop: 8, overflow: 'hidden' }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: left <= 10 ? C.gold : C.purple, width: Math.round((left / total) * 100) + '%' }} />
      </View>
    </View>
  );
};

/* a card that turns over when a new one is dealt */
const FlipCard = ({ flipKey, kicker, text, children }) => {
  const turn = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState({ kicker, text });
  useEffect(() => {
    Animated.timing(turn, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: ND }).start(() => {
      setShown({ kicker, text });
      Animated.timing(turn, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: ND }).start();
    });
  }, [flipKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const rotateY = turn.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });
  return (
    <Animated.View style={{ transform: [{ perspective: 900 }, { rotateY }], marginTop: 12 }}>
      <View style={{ borderRadius: 24, padding: 24, minHeight: 190, backgroundColor: C.purple, justifyContent: 'space-between' }}>
        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>{(shown.kicker || '').toUpperCase()}</Text>
        <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.4, lineHeight: 29, marginTop: 14 }}>{shown.text}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 16 }}>MOMENTS</Text>
      </View>
      {children}
    </Animated.View>
  );
};

/* whose turn: a name that lands with a little bounce */
const Turn = ({ turn, lang }) => {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: ND }).start();
  }, [turn && turn.at]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!turn) return null;
  return (
    <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }], opacity: pop, marginTop: 12 }}>
      <View style={{ borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: C.purpleSoft, alignItems: 'center' }}>
        <Text style={{ color: C.purple, fontSize: 16, fontWeight: '700' }}>{'🎯 ' + w(lang, 'turn', { n: turn.name || '' })}</Text>
      </View>
    </Animated.View>
  );
};

/* animated result bars */
const Bar = ({ label, n, total, hi, lang }) => {
  const grow = useRef(new Animated.Value(0)).current;
  const pct = total ? Math.round((n / total) * 100) : 0;
  useEffect(() => { Animated.timing(grow, { toValue: pct, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: hi ? '700' : '500', flex: 1 }} numberOfLines={2}>{label}</Text>
        <Text style={[{ color: C.dim, fontSize: 13, marginStart: 10 }, NUM]}>{pct + '%'}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: C.glassHi, marginTop: 6, overflow: 'hidden' }}>
        <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: hi ? C.green : C.purple, width: grow.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }} />
      </View>
    </View>
  );
};

/* ── two truths and a lie: write yours ── */
const TruthForm = ({ kind, id, lang, onDone }) => {
  const [s, setS] = useState(['', '', '']);
  const [lie, setLie] = useState(0);
  const [err, setErr] = useState(null);
  const save = async () => {
    if (s.some((x) => x.trim().length < 2) || !lie) return;
    tapMedium();
    const r = await truthsSubmit(kind, id, s, lie);
    if (r && r.ok) { tapSuccess(); onDone(); } else setErr(w(lang, 'err'));
  };
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>{w(lang, 'tWrite')}</Text>
      <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{w(lang, 'tLie')}</Text>
      {s.map((v, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <Pressable onPress={() => { tapSelection(); setLie(i + 1); }} accessibilityRole="radio" accessibilityState={{ selected: lie === i + 1 }} hitSlop={8}>
            <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: lie === i + 1 ? C.purple : C.line, backgroundColor: lie === i + 1 ? C.purple : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {lie === i + 1 ? <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>✕</Text> : null}
            </View>
          </Pressable>
          <TextInput value={v} onChangeText={(x) => setS((a) => a.map((y, j) => (j === i ? x : y)))} placeholder={w(lang, 'tPh')} placeholderTextColor={C.faint} maxLength={120}
            style={{ flex: 1, marginStart: 10, color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.glass, textAlign: lang === 'ar' ? 'right' : 'left' }} />
        </View>
      ))}
      <Primary label={w(lang, 'tSave')} onPress={save} />
      {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
    </View>
  );
};

/* ── one truths card on every screen ── */
const TruthOnTable = ({ truthId, lang }) => {
  const [c, setC] = useState(null);
  useEffect(() => {
    let alive = true;
    const get = () => truthCard(truthId).then((x) => alive && x && x.ok && setC(x));
    get(); const h = setInterval(get, 4000);
    return () => { alive = false; clearInterval(h); };
  }, [truthId]);
  if (!c) return null;
  const total = c.votes ? c.votes.reduce((a, b) => a + b, 0) : 0;
  const vote = async (i) => { if (c.my_pick || c.mine) return; tapMedium(); const x = await truthVote(c.id, i + 1); if (x && x.ok) { setC(x); if (x.lie === i + 1) tapSuccess(); } };
  return (
    <View style={{ marginTop: 12, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Face name={c.by} size={28} />
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', marginStart: 10, flex: 1 }}>{c.by}</Text>
      </View>
      <Text style={{ color: C.dim, fontSize: 13, marginTop: 10 }}>{c.mine ? w(lang, 'tYours') : w(lang, 'tWhich')}</Text>
      {c.votes ? c.s.map((t, i) => <Bar key={i} label={(c.lie === i + 1 ? w(lang, 'lie') + ' · ' : '') + t} n={c.votes[i]} total={total} hi={c.lie === i + 1} lang={lang} />)
        : c.s.map((t, i) => (
          <Pressable key={i} onPress={() => vote(i)} accessibilityRole="button" style={{ marginTop: 10 }}>
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: C.bg }}>
              <Text style={{ color: C.text, fontSize: 15 }}>{t}</Text>
            </View>
          </Pressable>
        ))}
      {c.votes ? <Text style={[{ color: C.faint, fontSize: 12, marginTop: 10 }, NUM]}>{w(lang, 'votes', { n: total })}</Text> : null}
    </View>
  );
};

/* ── a table poll: vote for somebody, then the bars ── */
const PollOnTable = ({ kind, id, poll, people, lang }) => {
  const { user } = useAuth();
  const [r, setR] = useState(null);
  useEffect(() => {
    let alive = true;
    const get = () => pollResult(kind, id, poll).then((x) => alive && x && x.ok && setR(x));
    get(); const h = setInterval(get, 4000);
    return () => { alive = false; clearInterval(h); };
  }, [poll]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = (people || []).filter((p) => p.id !== (user && user.id));
  const vote = async (p) => { tapMedium(); const x = await pollVote(kind, id, poll, p.id); if (x && x.ok) setR(x); };
  return (
    <View style={{ marginTop: 12, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 20 }}>
      <Text style={{ color: C.purple, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>{w(lang, 'poll').toUpperCase()}</Text>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 8 }}>{cardText(POLLS[poll] || POLLS[0], lang)}</Text>
      {r && r.top ? r.top.map((t) => <Bar key={t.id} label={t.name} n={t.n} total={r.total} hi={t.id === r.top[0].id} lang={lang} />) : (
        <>
          <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{w(lang, 'pollTap')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {others.map((p) => (
              <Pressable key={p.id} onPress={() => vote(p)} accessibilityRole="button" style={{ marginEnd: 8, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingVertical: 6, paddingStart: 6, paddingEnd: 12, backgroundColor: C.bg }}>
                  <Face uri={p.avatar_url} name={p.name} size={24} />
                  <Text style={{ color: C.text, fontSize: 14, marginStart: 8 }}>{p.name}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

export const ActivitiesHub = ({ kind, id, lang }) => {
  const [a, setA] = useState(null);
  const [tab, setTab] = useState('deck');
  const [err, setErr] = useState(null);
  const lastRev = useRef(-1);
  const skew = useRef(0);

  const take = (x) => {
    if (!x || !x.ok) return;
    skew.current = new Date(x.now).getTime() - Date.now();
    // whatever somebody just dealt, every phone at the table follows
    if (x.rev !== lastRev.current) {
      lastRev.current = x.rev;
      const m = x.state && x.state.mode;
      if (m === 'deck') setTab('deck'); else if (m === 'truths' || m === 'poll') setTab('truths'); else if (m === 'roleplay') setTab('role');
    }
    setA(x);
  };
  const load = () => activityGet(kind, id).then(take);
  useEffect(() => { load(); const h = setInterval(load, 3000); return () => clearInterval(h); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn) => {
    tapMedium(); setErr(null);
    const x = await fn();
    if (x && x.ok) take(x);
    else setErr(x && (x.reason === 'need_two' || x.reason === 'nobody') ? w(lang, 'needTwo') : x && x.reason === 'none' ? w(lang, 'none') : w(lang, 'err'));
  };

  if (!a || !a.ok || a.phase === 'closed') return null;
  const st = a.state || {};
  const live = a.phase === 'live' && a.checked_in;

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>{w(lang, 'title')}</Text>

      {a.phase === 'before' ? (
        <>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{w(lang, 'before')}</Text>
          {a.my_truth ? <Text style={{ color: C.green, fontSize: 14, marginTop: 12 }}>{w(lang, 'tSaved')}</Text> : <TruthForm kind={kind} id={id} lang={lang} onDone={load} />}
        </>
      ) : a.phase === 'live' && !a.checked_in ? (
        <Text style={{ color: C.dim, fontSize: 14, marginTop: 4 }}>{w(lang, 'needIn')}</Text>
      ) : live ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {[['deck', 'tDeck'], ['truths', 'tTruths'], ['role', 'tRole']].map(([k, l]) => <Pill key={k} label={w(lang, l)} on={tab === k} onPress={() => { tapSelection(); setTab(k); }} />)}
          </View>

          {tab === 'deck' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                {['warm', 'deep', 'global'].map((c) => <Pill key={c} label={w(lang, c)} on={st.mode === 'deck' && st.cat === c} onPress={() => act(() => activityDeal(kind, id, c))} />)}
              </View>
              {st.mode === 'deck' && DECK[st.cat] ? (
                <FlipCard flipKey={st.cat + ':' + st.card} kicker={w(lang, st.cat)} text={cardText(DECK[st.cat][st.card] || DECK[st.cat][0], lang)}>
                  {st.cat === 'global' && st.ends_at ? <Clock endsAt={st.ends_at} skew={skew.current} total={60} lang={lang} /> : null}
                </FlipCard>
              ) : (
                <Pressable onPress={() => act(() => activityDeal(kind, id, 'warm'))} accessibilityRole="button">
                  <View style={{ marginTop: 12, borderRadius: 24, minHeight: 160, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>{w(lang, 'start')}</Text>
                  </View>
                </Pressable>
              )}
              <Turn turn={st.turn} lang={lang} />
              <Primary label={'🎯 ' + w(lang, 'spin')} ghost onPress={() => act(() => activitySpin(kind, id))} />
            </>
          ) : null}

          {tab === 'truths' ? (
            <>
              {!a.my_truth ? <TruthForm kind={kind} id={id} lang={lang} onDone={load} /> : null}
              {st.mode === 'truths' && st.truth ? <TruthOnTable truthId={st.truth} lang={lang} /> : null}
              {st.mode === 'poll' && st.poll != null ? <PollOnTable kind={kind} id={id} poll={st.poll} people={a.people} lang={lang} /> : null}
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, marginEnd: 8 }}><Primary label={w(lang, 'tPut')} onPress={() => act(() => activityTruth(kind, id))} /></View>
                <View style={{ flex: 1 }}><Primary label={w(lang, 'poll')} ghost onPress={() => act(() => activityPoll(kind, id))} /></View>
              </View>
            </>
          ) : null}

          {tab === 'role' ? (
            <>
              {st.mode === 'roleplay' && st.pair && SCENES[st.scene] ? (
                <FlipCard flipKey={'r' + st.scene + (st.pair || []).map((p) => p.id).join()} kicker={(st.pair || []).map((p) => p.name).join('  ⇄  ')} text={cardText([SCENES[st.scene][0][0], SCENES[st.scene][1][0]], lang)}>
                  <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 10 }}>{cardText([SCENES[st.scene][0][1], SCENES[st.scene][1][1]], lang)}</Text>
                  {st.ends_at ? <Clock endsAt={st.ends_at} skew={skew.current} total={90} lang={lang} /> : null}
                </FlipCard>
              ) : null}
              <Primary label={w(lang, 'pair')} onPress={() => act(() => activityPair(kind, id))} />
            </>
          ) : null}
        </>
      ) : null}
      {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 8, textAlign: 'center' }}>{err}</Text> : null}
    </View>
  );
};

/* ── after the event: keep in touch, and vibe badges ── */
export const AfterParty = ({ kind, id, lang }) => {
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => keepInTouch(kind, id).then((x) => setR(x && x.ok ? x : null));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;
  const now = new Date(r.now).getTime();
  const connectOpen = now >= new Date(r.opens_at).getTime() && now <= new Date(r.closes_at).getTime();
  if (!connectOpen && !r.vibes_open) return null;
  const until = new Date(r.closes_at).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  const tap = async (p) => {
    tapMedium(); setErr(null);
    const x = await buddyTap(kind, id, p.id, !p.tapped);
    if (x && x.ok) { if (x.new) tapSuccess(); load(); } else setErr(w(lang, 'err'));
  };
  const vibe = async (p, b) => {
    tapLight();
    const on = !(p.vibes || []).includes(b);
    setR((o) => ({ ...o, people: o.people.map((q) => (q.id === p.id ? { ...q, vibes: on ? (q.vibes || []).concat(b) : (q.vibes || []).filter((y) => y !== b) } : q)) }));
    const x = await vibeGive(kind, id, p.id, b, on);
    if (!x || !x.ok) load();
  };

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 }}>{w(lang, 'keep')}</Text>
      <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{connectOpen ? w(lang, 'keepSub') : w(lang, 'vibes')}</Text>
      {connectOpen ? <Text style={[{ color: C.faint, fontSize: 12, marginTop: 4 }, NUM]}>{w(lang, 'closes', { d: until })}</Text> : null}
      {!r.people.length ? <Text style={{ color: C.dim, fontSize: 14, marginTop: 12 }}>{w(lang, 'nobody')}</Text> : null}
      {r.people.map((p) => (
        <View key={p.id} style={{ marginTop: 12, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Face uri={p.avatar_url} name={p.name} size={40} />
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', marginStart: 12, flex: 1 }} numberOfLines={1}>{p.name}</Text>
            {connectOpen ? (
              <Pressable onPress={() => (p.buddy ? null : tap(p))} accessibilityRole="button" accessibilityState={{ selected: !!p.tapped }}>
                <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: p.buddy ? C.greenSoft : p.tapped ? C.purpleSoft : C.purple }}>
                  <Text style={{ color: p.buddy ? C.green : p.tapped ? C.purple : '#FFF', fontSize: 13.5, fontWeight: '600' }}>{w(lang, p.buddy ? 'buddies' : p.tapped ? 'waiting' : 'connect')}</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
          {r.vibes_open ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
              {BADGES.map(([b, e]) => {
                const on = (p.vibes || []).includes(b);
                return (
                  <Pressable key={b} onPress={() => vibe(p, b)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ marginEnd: 6, marginBottom: 6 }}>
                    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: on ? C.purple : C.bg, borderWidth: 1, borderColor: on ? C.purple : C.line }}>
                      <Text style={{ color: on ? '#FFF' : C.text, fontSize: 12.5 }}>{e + ' ' + badgeName(lang, b)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ))}
      {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
    </View>
  );
};
