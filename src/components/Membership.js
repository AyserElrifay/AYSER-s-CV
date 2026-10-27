import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Platform, ActivityIndicator, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, NUM } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { buyTier } from '../services/payments';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ─── WELCOME TO THE CLUB ─────────────────────────────────────────────
   Ayser: Moments is a private, members-only community now. Somebody
   signed in without a membership sees this and only this — the app
   blurred behind it — and it reads as an invitation, not a wall: why
   (quality, safety), two plans, one tap to Lemon Squeezy, and a quiet
   "Why are we charging?" that answers honestly. Monochrome and type
   for Basic; Moments violet — the one colour — for VIP, the plan we
   recommend. The same page opens as a sheet for a member choosing a
   plan; VipSheet is the one-line door for a Basic member who reached
   for messages, a lounge or a full profile. The tiers and every door
   are the server's (RUN_ME.sql, "TWO TIERS"); the prices shown are the
   owner's (app_settings tier_prices) and must match the variants in
   Lemon Squeezy. */

const S = {
  en: ['Welcome to the new Moments. Quality over noise.', 'To keep our community safe, authentic, and focused on real growth, Moments is now a private, members-only platform. No fake accounts, no spam—just real people, real languages, and real meetups.', 'Moments Basic', 'The Essentials.', 'Access the Social Feed', 'Book offline Cafe Meetups', 'View the Global Track Journey', 'Join Basic', 'Moments VIP', 'The Full Experience.', 'Everything in Basic', 'Unlock Direct Messaging (DMs)', 'Access 24/7 Live Language Lounges', 'Priority Meetup Booking', 'Become VIP', 'Recommended', '/ month', 'Why are we charging?', 'Why Moments is paid now', 'Local community managers — real people who host, check in and look after every meetup.', 'The servers, the audio rooms and the safety tools that keep Moments running.', 'Keeping creeps out. A paid membership stops fake accounts and spam before they start.', 'Got it', 'Payments open very soon — thank you for waiting.', 'It did not go through. Try again.', 'Sign out', 'Your plan', 'Done — your plan changes in a moment.', 'Upgrade to Moments VIP', 'Unlock Messaging & Language Rooms.', 'Not now', 'Cancel any time.'],
  ar: ['أهلًا بيك في Moments الجديدة. الجودة قبل الدوشة.', 'عشان مجتمعنا يفضل آمن وحقيقي ومركّز على النمو بجد، Moments بقت منصّة خاصة للأعضاء بس. مفيش حسابات فيك، مفيش سبام — ناس حقيقية، ولغات حقيقية، وخروجات حقيقية.', 'Moments Basic', 'الأساسيات.', 'الفيد الاجتماعي', 'احجز خروجات الكافيهات', 'شوف رحلة الـGlobal Track', 'اشترك في Basic', 'Moments VIP', 'التجربة كاملة.', 'كل اللي في Basic', 'افتح الرسايل الخاصة', 'غرف اللغات المباشرة ٢٤/٧', 'أولوية في حجز الخروجات', 'اشترك VIP', 'ننصحك بيه', '/ شهر', 'ليه بقينا بفلوس؟', 'ليه Moments بقت بفلوس', 'منظّمين محليين — ناس حقيقية بتستضيف وتستقبل وتاخد بالها من كل خروجة.', 'السيرفرات وغرف الصوت وأدوات الأمان اللي مشغّلة Moments.', 'إننا نبعد المزعجين. الاشتراك المدفوع بيوقف الحسابات الفيك والسبام من الأول.', 'تمام', 'الدفع هيفتح قريب جدًا — شكرًا إنك مستني.', 'ماتبعتش. جرّب تاني.', 'تسجيل خروج', 'باقتك', 'تمام — باقتك هتتغيّر كمان شوية.', 'اشترك في Moments VIP', 'افتح الرسايل وغرف اللغات.', 'مش دلوقتي', 'تقدر تلغي في أي وقت.'],
  cs: ['Vítej v novém Moments. Kvalita místo šumu.', 'Aby naše komunita zůstala bezpečná, autentická a zaměřená na skutečný růst, je Moments nyní soukromá platforma jen pro členy. Žádné falešné účty, žádný spam — jen skuteční lidé, skutečné jazyky a skutečná setkání.', 'Moments Basic', 'To podstatné.', 'Přístup k sociálnímu feedu', 'Rezervace setkání v kavárnách', 'Global Track — tvoje cesta', 'Připojit se k Basic', 'Moments VIP', 'Celý zážitek.', 'Vše z Basic', 'Odemkni přímé zprávy', 'Živé jazykové lounge 24/7', 'Přednostní rezervace setkání', 'Stát se VIP', 'Doporučujeme', '/ měsíc', 'Proč si účtujeme?', 'Proč je Moments placené', 'Místní komunitní manažeři — skuteční lidé, kteří hostí, vítají a starají se o každé setkání.', 'Servery, audio místnosti a bezpečnostní nástroje, díky nimž Moments běží.', 'Držíme otravy venku. Placené členství zastaví falešné účty a spam hned na začátku.', 'Rozumím', 'Platby se otevřou velmi brzy — díky za trpělivost.', 'Nepodařilo se. Zkus to znovu.', 'Odhlásit se', 'Tvůj plán', 'Hotovo — plán se za chvíli změní.', 'Přejdi na Moments VIP', 'Odemkni zprávy a jazykové místnosti.', 'Teď ne', 'Zrušit můžeš kdykoli.'],
  es: ['Bienvenido al nuevo Moments. Calidad antes que ruido.', 'Para que nuestra comunidad siga siendo segura, auténtica y centrada en crecer de verdad, Moments es ahora una plataforma privada solo para miembros. Sin cuentas falsas, sin spam: solo gente real, idiomas reales y encuentros reales.', 'Moments Basic', 'Lo esencial.', 'Acceso al feed social', 'Reserva encuentros en cafés', 'Tu camino en el Global Track', 'Unirme a Basic', 'Moments VIP', 'La experiencia completa.', 'Todo lo de Basic', 'Desbloquea los mensajes directos', 'Salas de idiomas en vivo 24/7', 'Prioridad al reservar encuentros', 'Hazte VIP', 'Recomendado', '/ mes', '¿Por qué cobramos?', 'Por qué Moments es de pago', 'Gestores de comunidad locales: personas reales que reciben, organizan y cuidan cada encuentro.', 'Los servidores, las salas de audio y las herramientas de seguridad que mantienen Moments en marcha.', 'Mantener fuera a los pesados. Una membresía de pago frena las cuentas falsas y el spam desde el principio.', 'Entendido', 'Los pagos abren muy pronto: gracias por esperar.', 'No se envió. Inténtalo de nuevo.', 'Cerrar sesión', 'Tu plan', 'Listo: tu plan cambia en un momento.', 'Hazte Moments VIP', 'Desbloquea mensajes y salas de idiomas.', 'Ahora no', 'Cancela cuando quieras.'],
  et: ['Tere tulemast uude Momentsi. Kvaliteet enne müra.', 'Et meie kogukond püsiks turvaline, ehtne ja keskenduks päris arengule, on Moments nüüd privaatne, ainult liikmetele mõeldud platvorm. Ei võltskontosid ega rämpsu — ainult päris inimesed, päris keeled ja päris kohtumised.', 'Moments Basic', 'Olulisim.', 'Ligipääs sotsiaalsele voole', 'Broneeri kohvikukohtumisi', 'Vaata Global Tracki teekonda', 'Liitu Basicuga', 'Moments VIP', 'Täielik kogemus.', 'Kõik, mis on Basicus', 'Ava otsesõnumid', 'Keelelounge’id otse 24/7', 'Kohtumiste eelisbroneerimine', 'Saa VIP-iks', 'Soovitame', '/ kuu', 'Miks me tasu võtame?', 'Miks Moments on nüüd tasuline', 'Kohalikud kogukonnajuhid — päris inimesed, kes võõrustavad ja hoolitsevad iga kohtumise eest.', 'Serverid, helitoad ja turvatööriistad, mis Momentsi töös hoiavad.', 'Tüütajad jäävad välja. Tasuline liikmesus peatab võltskontod ja rämpsu kohe alguses.', 'Selge', 'Maksed avanevad varsti — aitäh ootamast.', 'Ei läinud läbi. Proovi uuesti.', 'Logi välja', 'Sinu pakett', 'Valmis — pakett muutub hetke pärast.', 'Võta Moments VIP', 'Ava sõnumid ja keeletoad.', 'Mitte praegu', 'Tühista millal tahes.'],
  fr: ['Bienvenue dans le nouveau Moments. La qualité plutôt que le bruit.', 'Pour que notre communauté reste sûre, authentique et tournée vers une vraie progression, Moments est désormais une plateforme privée, réservée aux membres. Pas de faux comptes, pas de spam — juste de vraies personnes, de vraies langues et de vraies rencontres.', 'Moments Basic', 'L’essentiel.', 'Accès au fil social', 'Réserver des rencontres au café', 'Voir ton parcours Global Track', 'Rejoindre Basic', 'Moments VIP', 'L’expérience complète.', 'Tout Basic', 'Débloque les messages privés', 'Salons de langues en direct 24h/24', 'Réservation prioritaire des rencontres', 'Devenir VIP', 'Recommandé', '/ mois', 'Pourquoi c’est payant ?', 'Pourquoi Moments est payant', 'Des animateurs locaux — de vraies personnes qui accueillent et prennent soin de chaque rencontre.', 'Les serveurs, les salons audio et les outils de sécurité qui font tourner Moments.', 'Tenir les lourds à l’écart. Une adhésion payante arrête les faux comptes et le spam dès le départ.', 'Compris', 'Les paiements ouvrent très bientôt — merci de patienter.', 'Ça n’est pas passé. Réessaie.', 'Se déconnecter', 'Ton offre', 'C’est fait — ton offre change dans un instant.', 'Passe à Moments VIP', 'Débloque les messages et les salons de langues.', 'Pas maintenant', 'Résiliable à tout moment.'],
  hi: ['नए Moments में स्वागत है। शोर नहीं, क्वालिटी।', 'हमारी कम्युनिटी को सुरक्षित, असली और सच्ची ग्रोथ पर टिकाए रखने के लिए Moments अब सिर्फ़ मेंबर्स का प्राइवेट प्लेटफ़ॉर्म है। कोई फ़ेक अकाउंट नहीं, कोई स्पैम नहीं — बस असली लोग, असली भाषाएँ और असली मीटअप।', 'Moments Basic', 'ज़रूरी चीज़ें।', 'सोशल फ़ीड', 'कैफ़े मीटअप बुक करो', 'Global Track की यात्रा देखो', 'Basic लो', 'Moments VIP', 'पूरा अनुभव।', 'Basic का सब कुछ', 'डायरेक्ट मैसेज खोलो', '24/7 लाइव लैंग्वेज लाउंज', 'मीटअप बुकिंग में प्राथमिकता', 'VIP बनो', 'हमारी सलाह', '/ महीना', 'हम पैसे क्यों ले रहे हैं?', 'Moments अब पेड क्यों है', 'लोकल कम्युनिटी मैनेजर — असली लोग जो हर मीटअप होस्ट करते और संभालते हैं।', 'सर्वर, ऑडियो रूम और सेफ़्टी टूल जो Moments चलाते हैं।', 'परेशान करने वालों को दूर रखना। पेड मेंबरशिप फ़ेक अकाउंट और स्पैम को शुरू में ही रोकती है।', 'समझ गया', 'पेमेंट बहुत जल्द खुलेंगे — इंतज़ार के लिए शुक्रिया।', 'नहीं गया। फिर कोशिश करो।', 'साइन आउट', 'तुम्हारा प्लान', 'हो गया — प्लान थोड़ी देर में बदल जाएगा।', 'Moments VIP लो', 'मैसेज और लैंग्वेज रूम खोलो।', 'अभी नहीं', 'कभी भी कैंसल करो।'],
  it: ['Benvenuto nel nuovo Moments. Qualità, non rumore.', 'Per mantenere la nostra comunità sicura, autentica e concentrata sulla crescita vera, Moments ora è una piattaforma privata, solo per membri. Niente account falsi, niente spam: solo persone vere, lingue vere e incontri veri.', 'Moments Basic', 'L’essenziale.', 'Accesso al feed social', 'Prenota incontri al caffè', 'Il tuo percorso Global Track', 'Entra in Basic', 'Moments VIP', 'L’esperienza completa.', 'Tutto di Basic', 'Sblocca i messaggi diretti', 'Lounge di lingue dal vivo 24/7', 'Prenotazione prioritaria degli incontri', 'Diventa VIP', 'Consigliato', '/ mese', 'Perché è a pagamento?', 'Perché Moments ora è a pagamento', 'Community manager locali: persone vere che accolgono e curano ogni incontro.', 'I server, le stanze audio e gli strumenti di sicurezza che fanno girare Moments.', 'Tenere fuori i molesti. Un abbonamento a pagamento ferma account falsi e spam fin dall’inizio.', 'Ho capito', 'I pagamenti aprono a breve: grazie per l’attesa.', 'Non è andato. Riprova.', 'Esci', 'Il tuo piano', 'Fatto: il piano cambia tra un attimo.', 'Passa a Moments VIP', 'Sblocca messaggi e stanze di lingue.', 'Non ora', 'Disdici quando vuoi.'],
  ja: ['新しい Moments へようこそ。ノイズより質を。', 'コミュニティを安全で本物、そして本当の成長に集中できる場所に保つため、Moments はメンバー限定のプライベートな場所になりました。偽アカウントもスパムもなし。本物の人、本物の言葉、本物のミートアップだけ。', 'Moments Basic', '必要なものを。', 'ソーシャルフィード', 'カフェのミートアップを予約', 'Global Track の道のりを見る', 'Basic に参加', 'Moments VIP', 'すべてを体験。', 'Basic のすべて', 'ダイレクトメッセージを解放', '24時間ライブ語学ラウンジ', 'ミートアップの優先予約', 'VIP になる', 'おすすめ', '/ 月', 'なぜ有料に？', 'Moments が有料になった理由', '地域のコミュニティマネージャー — すべてのミートアップを迎え、見守る本物の人たち。', 'Moments を動かすサーバー、音声ルーム、安全のための仕組み。', '迷惑な人を入れないこと。有料メンバーシップが偽アカウントやスパムを最初から止めます。', 'わかった', 'お支払いはまもなく開始します。お待ちいただきありがとうございます。', '送れませんでした。もう一度どうぞ。', 'ログアウト', '現在のプラン', '完了 — まもなくプランが切り替わります。', 'Moments VIP にアップグレード', 'メッセージと語学ルームを解放。', '今はしない', 'いつでも解約できます。'],
  ko: ['새로운 Moments에 오신 걸 환영해요. 소음보다 품질.', '커뮤니티를 안전하고 진짜이며 진짜 성장에 집중하는 곳으로 지키기 위해, Moments는 이제 회원 전용 비공개 플랫폼이에요. 가짜 계정도, 스팸도 없어요 — 진짜 사람, 진짜 언어, 진짜 만남만.', 'Moments Basic', '꼭 필요한 것.', '소셜 피드 이용', '카페 모임 예약', 'Global Track 여정 보기', 'Basic 가입', 'Moments VIP', '모든 경험.', 'Basic의 모든 것', '다이렉트 메시지 열기', '24시간 라이브 언어 라운지', '모임 우선 예약', 'VIP 되기', '추천', '/ 월', '왜 유료인가요?', 'Moments가 유료가 된 이유', '지역 커뮤니티 매니저 — 모든 모임을 맞이하고 챙기는 진짜 사람들.', 'Moments를 움직이는 서버, 오디오 방, 안전 도구.', '불쾌한 사람을 막기. 유료 멤버십이 가짜 계정과 스팸을 처음부터 막아요.', '알겠어요', '결제가 곧 열려요 — 기다려 주셔서 고마워요.', '전송되지 않았어요. 다시 해 주세요.', '로그아웃', '내 플랜', '완료 — 곧 플랜이 바뀌어요.', 'Moments VIP로 업그레이드', '메시지와 언어 방을 여세요.', '나중에', '언제든 해지할 수 있어요.'],
  nl: ['Welkom bij het nieuwe Moments. Kwaliteit boven ruis.', 'Om onze community veilig, echt en gericht op echte groei te houden, is Moments nu een privéplatform, alleen voor leden. Geen nepaccounts, geen spam — alleen echte mensen, echte talen en echte meetups.', 'Moments Basic', 'De basis.', 'Toegang tot de social feed', 'Boek meetups in cafés', 'Bekijk je Global Track-reis', 'Word Basic', 'Moments VIP', 'De volledige ervaring.', 'Alles van Basic', 'Ontgrendel directe berichten', 'Live taallounges, 24/7', 'Voorrang bij het boeken van meetups', 'Word VIP', 'Aanbevolen', '/ maand', 'Waarom betalen?', 'Waarom Moments nu betaald is', 'Lokale communitymanagers — echte mensen die elke meetup ontvangen en verzorgen.', 'De servers, de audioruimtes en de veiligheidstools die Moments draaiende houden.', 'Engerds buiten houden. Een betaald lidmaatschap stopt nepaccounts en spam bij de start.', 'Begrepen', 'Betalen kan heel binnenkort — bedankt voor je geduld.', 'Het lukte niet. Probeer opnieuw.', 'Uitloggen', 'Je abonnement', 'Klaar — je abonnement verandert zo.', 'Upgrade naar Moments VIP', 'Ontgrendel berichten en taalruimtes.', 'Niet nu', 'Altijd opzegbaar.'],
  pt: ['Bem-vindo ao novo Moments. Qualidade acima do ruído.', 'Para manter a nossa comunidade segura, autêntica e focada em crescer a sério, o Moments é agora uma plataforma privada, só para membros. Sem contas falsas, sem spam — só pessoas reais, línguas reais e encontros reais.', 'Moments Basic', 'O essencial.', 'Acesso ao feed social', 'Reserva encontros em cafés', 'Vê o teu percurso Global Track', 'Aderir ao Basic', 'Moments VIP', 'A experiência completa.', 'Tudo do Basic', 'Desbloqueia mensagens diretas', 'Salas de línguas ao vivo 24/7', 'Prioridade nas reservas de encontros', 'Tornar-me VIP', 'Recomendado', '/ mês', 'Porque cobramos?', 'Porque o Moments passou a ser pago', 'Gestores de comunidade locais — pessoas reais que recebem e cuidam de cada encontro.', 'Os servidores, as salas de áudio e as ferramentas de segurança que mantêm o Moments a funcionar.', 'Manter os inconvenientes à porta. Uma adesão paga trava contas falsas e spam logo à partida.', 'Percebi', 'Os pagamentos abrem muito em breve — obrigado por esperares.', 'Não foi. Tenta outra vez.', 'Terminar sessão', 'O teu plano', 'Feito — o teu plano muda daqui a nada.', 'Passa para o Moments VIP', 'Desbloqueia mensagens e salas de línguas.', 'Agora não', 'Cancela quando quiseres.'],
  ro: ['Bun venit în noul Moments. Calitate, nu zgomot.', 'Ca să rămână comunitatea noastră sigură, autentică și concentrată pe creștere reală, Moments este acum o platformă privată, doar pentru membri. Fără conturi false, fără spam — doar oameni reali, limbi reale și întâlniri reale.', 'Moments Basic', 'Esențialul.', 'Acces la feedul social', 'Rezervă întâlniri la cafenea', 'Vezi drumul tău Global Track', 'Intră în Basic', 'Moments VIP', 'Experiența completă.', 'Tot ce e în Basic', 'Deblochează mesajele directe', 'Lounge-uri de limbi live 24/7', 'Rezervare prioritară la întâlniri', 'Devino VIP', 'Recomandat', '/ lună', 'De ce cerem bani?', 'De ce Moments e acum cu plată', 'Manageri de comunitate locali — oameni reali care primesc și au grijă de fiecare întâlnire.', 'Serverele, camerele audio și uneltele de siguranță care țin Moments în funcțiune.', 'Ținem deranjanții afară. Un abonament plătit oprește conturile false și spamul din start.', 'Am înțeles', 'Plățile se deschid foarte curând — mulțumim că aștepți.', 'Nu a mers. Încearcă din nou.', 'Ieși din cont', 'Planul tău', 'Gata — planul se schimbă imediat.', 'Treci la Moments VIP', 'Deblochează mesajele și camerele de limbi.', 'Nu acum', 'Anulezi oricând.'],
  ru: ['Добро пожаловать в новый Moments. Качество важнее шума.', 'Чтобы наше сообщество оставалось безопасным, настоящим и нацеленным на реальный рост, Moments теперь закрытая платформа только для участников. Никаких фейков и спама — только реальные люди, реальные языки и реальные встречи.', 'Moments Basic', 'Самое главное.', 'Доступ к ленте', 'Бронь встреч в кафе', 'Твой путь Global Track', 'Выбрать Basic', 'Moments VIP', 'Полный опыт.', 'Всё из Basic', 'Личные сообщения', 'Языковые лаунджи 24/7', 'Приоритетная бронь встреч', 'Стать VIP', 'Рекомендуем', '/ месяц', 'Почему платно?', 'Почему Moments теперь платный', 'Местные комьюнити-менеджеры — живые люди, которые встречают гостей и заботятся о каждой встрече.', 'Серверы, аудиокомнаты и инструменты безопасности, на которых держится Moments.', 'Не пускать неприятных людей. Платное членство отсекает фейки и спам с самого начала.', 'Понятно', 'Оплата откроется совсем скоро — спасибо, что ждёшь.', 'Не отправилось. Попробуй ещё раз.', 'Выйти', 'Твой тариф', 'Готово — тариф сменится через минуту.', 'Перейти на Moments VIP', 'Открой сообщения и языковые комнаты.', 'Не сейчас', 'Отменить можно в любой момент.'],
  tr: ['Yeni Moments’a hoş geldin. Gürültü değil, kalite.', 'Topluluğumuzu güvenli, gerçek ve gerçek gelişime odaklı tutmak için Moments artık yalnızca üyelere özel bir platform. Sahte hesap yok, spam yok — sadece gerçek insanlar, gerçek diller ve gerçek buluşmalar.', 'Moments Basic', 'Temel olanlar.', 'Sosyal akışa erişim', 'Kafe buluşmaları ayırt', 'Global Track yolculuğunu gör', 'Basic’e katıl', 'Moments VIP', 'Tam deneyim.', 'Basic’teki her şey', 'Direkt mesajları aç', '7/24 canlı dil salonları', 'Buluşmalarda öncelikli rezervasyon', 'VIP ol', 'Önerilen', '/ ay', 'Neden ücretli?', 'Moments neden artık ücretli', 'Yerel topluluk yöneticileri — her buluşmayı karşılayan ve özenen gerçek insanlar.', 'Moments’ı ayakta tutan sunucular, ses odaları ve güvenlik araçları.', 'Rahatsız edenleri dışarıda tutmak. Ücretli üyelik sahte hesapları ve spamı en baştan durdurur.', 'Anladım', 'Ödemeler çok yakında açılıyor — beklediğin için teşekkürler.', 'Gitmedi. Tekrar dene.', 'Çıkış yap', 'Planın', 'Tamam — planın birazdan değişiyor.', 'Moments VIP’e geç', 'Mesajları ve dil odalarını aç.', 'Şimdi değil', 'İstediğin zaman iptal et.'],
  uk: ['Ласкаво просимо до нового Moments. Якість понад шум.', 'Щоб наша спільнота лишалася безпечною, справжньою й зосередженою на реальному рості, Moments тепер закрита платформа лише для учасників. Жодних фейків і спаму — лише справжні люди, справжні мови й справжні зустрічі.', 'Moments Basic', 'Найголовніше.', 'Доступ до стрічки', 'Бронюй зустрічі в кав’ярнях', 'Твій шлях Global Track', 'Обрати Basic', 'Moments VIP', 'Повний досвід.', 'Усе з Basic', 'Особисті повідомлення', 'Мовні лаунжі 24/7', 'Пріоритетне бронювання зустрічей', 'Стати VIP', 'Рекомендуємо', '/ місяць', 'Чому платно?', 'Чому Moments тепер платний', 'Місцеві ком’юніті-менеджери — живі люди, які зустрічають гостей і дбають про кожну зустріч.', 'Сервери, аудіокімнати й інструменти безпеки, на яких тримається Moments.', 'Не пускати неприємних людей. Платне членство відсікає фейки та спам із самого початку.', 'Зрозуміло', 'Оплата відкриється зовсім скоро — дякуємо, що чекаєш.', 'Не вийшло. Спробуй ще раз.', 'Вийти', 'Твій тариф', 'Готово — тариф зміниться за хвилину.', 'Перейти на Moments VIP', 'Відкрий повідомлення й мовні кімнати.', 'Не зараз', 'Скасувати можна будь-коли.'],
  zh: ['欢迎来到全新的 Moments。重质量，不重喧闹。', '为了让社区保持安全、真实，并专注于真正的成长，Moments 现在是仅限会员的私密平台。没有假账号，没有垃圾信息——只有真实的人、真实的语言和真实的聚会。', 'Moments Basic', '核心功能。', '浏览社交动态', '预订线下咖啡馆聚会', '查看 Global Track 旅程', '加入 Basic', 'Moments VIP', '完整体验。', 'Basic 的全部内容', '解锁私信', '24/7 实时语言休息室', '聚会优先预订', '成为 VIP', '推荐', '/ 月', '为什么收费？', 'Moments 为什么收费', '本地社区管理员——迎接并照顾每一场聚会的真实的人。', '让 Moments 运转的服务器、语音房间和安全工具。', '把骚扰者挡在门外。付费会员从一开始就挡住假账号和垃圾信息。', '明白了', '支付很快开放——感谢你的等待。', '没有成功，再试一次。', '退出登录', '你的方案', '好了——你的方案马上就会更新。', '升级到 Moments VIP', '解锁私信和语言房间。', '以后再说', '随时可以取消。'],
};
const K = ['hero', 'sub', 'basic', 'basicTag', 'f1', 'f2', 'f3', 'joinBasic', 'vip', 'vipTag', 'v1', 'v2', 'v3', 'v4', 'becomeVip', 'rec', 'perMonth', 'why', 'whyTitle', 'w1', 'w2', 'w3', 'gotIt', 'soon', 'err', 'signOut', 'current', 'changed', 'vipTitle', 'vipSub', 'notNow', 'cancel'];
/* VIP is paid by the year when the owner says so (tier_prices.vip_period) */
const PER_YEAR = { en: '/ year', ar: '/ سنة', cs: '/ rok', es: '/ año', et: '/ aastas', fr: '/ an', hi: '/ साल', it: '/ anno', ja: '/ 年', ko: '/ 년', nl: '/ jaar', pt: '/ ano', ro: '/ an', ru: '/ год', tr: '/ yıl', uk: '/ рік', zh: '/ 年' };
const per = (lang, period) => (period === 'year' ? PER_YEAR[lang] || PER_YEAR.en : w(lang, 'perMonth'));
const w = (lang, k) => { const i = K.indexOf(k); return (S[lang] || S.en)[i] || S.en[i] || ''; };

const money = (n, cur, lang) => {
  try { return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : lang || 'en', { style: 'currency', currency: cur || 'EGP', maximumFractionDigits: 0 }).format(n); } catch (e) { return n + ' ' + (cur || 'EGP'); }
};
const blur = Platform.OS === 'web' ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } : null;

const Check = ({ label, strong, onBrand, ink }) => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}>
    <Text style={{ color: onBrand ? C.purple : (ink || C.text), fontSize: 15, fontWeight: '700', width: 18, textAlign: 'center', marginEnd: 10 }}>✓</Text>
    <Text style={{ color: ink || C.text, fontSize: 15, lineHeight: 21, fontWeight: strong ? '700' : '400', flex: 1 }}>{label}</Text>
  </View>
);

/* the gateway's own page is Moments violet, like a brand's front door
   (Lemon Squeezy's way: violet ground, white type, a yellow spark), so
   the plan cards on it are always white paper with ink, day or night */
const PAPER = { ground: '#FFFFFF', ink: '#17131F', muted: '#6F6A75', line: 'rgba(23,19,31,0.10)' };

/* one plan: the name small, the promise large, the price in figures, one button */
const Plan = ({ lang, name, tag, price, cur, period, items, cta, onPress, busy, vip, current, paper }) => {
  const P = paper ? PAPER : { ground: C.glass, ink: C.text, muted: C.dim, line: C.line };
  return (
  <View style={{ marginTop: 18, borderRadius: 28, padding: 26, backgroundColor: P.ground, borderWidth: vip ? (paper ? 3 : 2) : (paper ? 0 : 1), borderColor: vip ? (paper ? C.sun : C.purple) : P.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: vip ? C.purple : P.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }}>{name.toUpperCase()}</Text>
      <View style={{ flex: 1, minWidth: 12 }} />
      {vip ? (
        <View style={{ borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: paper ? C.sun : C.purple }}>
          <Text style={{ color: paper ? '#17131F' : '#FFF', fontSize: 11.5, fontWeight: '800' }}>{w(lang, 'rec')}</Text>
        </View>
      ) : null}
    </View>
    <Text style={{ color: P.ink, fontSize: 26, fontWeight: '700', letterSpacing: -0.7, marginTop: 10 }}>{tag}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14 }}>
      <Text style={[{ color: P.ink, fontSize: 40, fontWeight: '700', letterSpacing: -1.2 }, NUM]}>{money(price, cur, lang)}</Text>
      <Text style={{ color: P.muted, fontSize: 15, marginStart: 6 }}>{per(lang, period)}</Text>
    </View>
    <View style={{ marginTop: 10 }}>
      {items.map(([label, strong]) => <Check key={label} label={label} strong={strong} onBrand={vip} ink={P.ink} />)}
    </View>
    {current ? (
      <Text style={{ color: C.green, fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 22 }}>{'✓ ' + w(lang, 'current')}</Text>
    ) : (
      <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={{ marginTop: 24 }}>
        <View style={{ borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: vip ? C.purple : 'transparent', borderWidth: vip ? 0 : 1.5, borderColor: P.ink }}>
          {busy ? <ActivityIndicator color={vip ? '#FFF' : P.ink} /> : <Text style={{ color: vip ? '#FFF' : P.ink, fontSize: 16.5, fontWeight: '600' }}>{cta}</Text>}
        </View>
      </Pressable>
    )}
  </View>
  );
};

/* "Why are we charging?" — three honest reasons, nothing more */
const WhySheet = ({ lang, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,13,20,0.4)' }} onPress={onClose} accessibilityLabel={w(lang, 'gotIt')} />
      <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24 }}>
        <View style={{ alignItems: 'center', marginTop: -8, marginBottom: 10 }}><SheetHandle onClose={onClose} /></View>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6 }}>{w(lang, 'whyTitle')}</Text>
        {['w1', 'w2', 'w3'].map((k, i) => (
          <View key={k} style={{ flexDirection: 'row', marginTop: 16 }}>
            <Text style={[{ color: C.purple, fontSize: 15, fontWeight: '700', width: 18, textAlign: 'center', marginEnd: 10 }, NUM]}>{String(i + 1)}</Text>
            <Text style={{ color: C.text, fontSize: 15.5, lineHeight: 23, flex: 1 }}>{w(lang, k)}</Text>
          </View>
        ))}
        <Pressable onPress={onClose} accessibilityRole="button" style={{ marginTop: 24 }}>
          <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: C.text }}>
            <Text style={{ color: C.bg, fontSize: 15, fontWeight: '600' }}>{w(lang, 'gotIt')}</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};

const useBuy = (lang, m) => {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const buy = async (tier) => {
    if (busy) return;
    tapMedium(); setBusy(tier); setNote(null);
    const r = await buyTier(tier, m);
    setBusy(null);
    if (r.ok && r.changed) { tapSuccess(); setNote(w(lang, 'changed')); }
    else if (!r.ok) setNote(w(lang, r.reason === 'not_configured' ? 'soon' : 'err'));
  };
  return { busy, note, buy };
};

/* the gateway: `hard` when somebody without a membership signed in (nothing else to tap),
   or a sheet for a member choosing a plan */
export const PricingGate = ({ m, hard, onClose, onSignOut }) => {
  // as a sheet, back closes it; as the gate there is nothing behind it to go back to
  useSheetBack(hard ? () => {} : onClose);
  const { lang } = useLang();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [why, setWhy] = useState(false);
  const { busy, note, buy } = useBuy(lang, m);
  const pr = (m && m.prices) || { basic: 118, vip: 1300, vip_period: 'year', currency: 'EGP' };
  const tier = m ? m.tier : 'FREE';

  const page = (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: insets.top + 44, paddingBottom: insets.bottom + 44, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 480 }}>
        <Text style={{ color: C.sun, fontSize: 13, fontWeight: '800', letterSpacing: 2.6 }}>✦ MOMENTS</Text>
        <Text style={{ color: '#FFF', fontSize: 38, fontWeight: '700', letterSpacing: -1.3, lineHeight: 43, marginTop: 18 }}>{w(lang, 'hero')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 16.5, lineHeight: 25, marginTop: 16, marginBottom: 14 }}>{w(lang, 'sub')}</Text>

        {/* Basic, then VIP — the plan we recommend carries the one colour */}
        <Plan lang={lang} name={w(lang, 'basic')} tag={w(lang, 'basicTag')} price={pr.basic} cur={pr.currency}
          items={[[w(lang, 'f1')], [w(lang, 'f2')], [w(lang, 'f3')]]}
          cta={w(lang, 'joinBasic')} busy={busy === 'basic'} onPress={() => buy('basic')} current={tier === 'BASIC'} paper />

        <Plan lang={lang} vip name={w(lang, 'vip')} tag={w(lang, 'vipTag')} price={pr.vip} cur={pr.currency} period={pr.vip_period}
          items={[[w(lang, 'v1')], [w(lang, 'v2'), true], [w(lang, 'v3'), true], [w(lang, 'v4')]]}
          cta={w(lang, 'becomeVip')} busy={busy === 'vip'} onPress={() => buy('vip')} current={tier === 'VIP'} paper />
        {note ? <Text style={{ color: '#FFF', fontSize: 14.5, textAlign: 'center', marginTop: 18 }}>{note}</Text> : null}
        <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13.5, textAlign: 'center', marginTop: 24 }}>{w(lang, 'cancel')}</Text>
        <Pressable onPress={() => { tapLight(); setWhy(true); }} accessibilityRole="link" hitSlop={10} style={{ alignSelf: 'center', marginTop: 10 }}>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>{w(lang, 'why')}</Text>
        </Pressable>
        {hard && onSignOut ? (
          <Pressable onPress={() => { tapLight(); onSignOut(); }} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'center', marginTop: 26 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5 }}>{w(lang, 'signOut')}</Text>
          </Pressable>
        ) : null}
        {!hard && onClose ? (
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'center', marginTop: 26 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5 }}>{w(lang, 'notNow')}</Text>
          </Pressable>
        ) : null}
      </View>
      {why ? <WhySheet lang={lang} onClose={() => setWhy(false)} /> : null}
    </ScrollView>
  );

  if (hard) {
    // over everything, the app blurred behind it; there is nothing else to tap
    return (
      <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000,
        backgroundColor: Platform.OS !== 'web' ? C.purple : isDark ? 'rgba(91,33,182,0.97)' : 'rgba(124,58,237,0.97)' }, blur]} accessibilityViewIsModal>
        {page}
      </View>
    );
  }
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.purple }}>{page}</View>
    </Modal>
  );
};

/* a Basic member reached for messages, a lounge or a full profile: one sentence, one button */
export const VipSheet = ({ m, onClose }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const { busy, note, buy } = useBuy(lang, m);
  const pr = (m && m.prices) || { vip: 1300, vip_period: 'year', currency: 'EGP' };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,13,20,0.4)' }} onPress={onClose} accessibilityLabel={w(lang, 'notNow')} />
      <View style={{ backgroundColor: C.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: insets.bottom + 24 }}>
        <View style={{ alignItems: 'center', marginTop: -8, marginBottom: 10 }}><SheetHandle onClose={onClose} /></View>
        <Text style={{ color: C.purple, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>MOMENTS VIP</Text>
        <Text style={{ color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.8, lineHeight: 33, marginTop: 8 }}>{w(lang, 'vipTitle')}</Text>
        <Text style={{ color: C.dim, fontSize: 16, marginTop: 6 }}>{w(lang, 'vipSub')}</Text>
        <View style={{ marginTop: 10 }}>
          {['v2', 'v3', 'v4'].map((k) => <Check key={k} label={w(lang, k)} onBrand />)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 18 }}>
          <Text style={[{ color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.6 }, NUM]}>{money(pr.vip, pr.currency, lang)}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginStart: 6 }}>{per(lang, pr.vip_period)}</Text>
        </View>
        <Pressable onPress={() => buy('vip')} disabled={!!busy} accessibilityRole="button" style={{ marginTop: 18 }}>
          <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: C.purple }}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>{w(lang, 'becomeVip')}</Text>}
          </View>
        </Pressable>
        {note ? <Text style={{ color: C.dim, fontSize: 14, textAlign: 'center', marginTop: 12 }}>{note}</Text> : null}
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'center', marginTop: 14 }}>
          <Text style={{ color: C.faint, fontSize: 14 }}>{w(lang, 'notNow')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
};

/* ─── WELCOME TO THE VIP CLUB ────────────────────────────────────────
   Ayser: the moment somebody comes back from paying for VIP, once. The
   app has just become theirs; this turns that into a first evening out:
   30% off a first Level 1 workshop, for 24 hours. Warm canvas, one glass
   card, the clock in figures, one button that breathes, and a quiet way
   out. The offer, its clock and the discount are the server's — this
   only shows them, and closing it closes it for good. */
const OTO = {
  en: ['Welcome to the VIP Club 🥂', 'Your digital access is unlocked. Now, let’s get you offline.', 'A welcome gift', '30% OFF', 'your first Level 1 Global Track Workshop', 'Offer ends in', 'Claim 30% Off & Book Level 1', 'No thanks, I’ll explore the app first.', 'Only for new VIP members, once.'],
  ar: ['أهلًا بيك في نادي VIP 🥂', 'التطبيق كله بقى مفتوح ليك. يلا نخرج بقى من الشاشة.', 'هدية ترحيب', 'خصم ٣٠٪', 'على أول ورشة Level 1 في Global Track', 'العرض بيخلص بعد', 'خد خصم ٣٠٪ واحجز Level 1', 'لأ شكرًا، هتفرّج على التطبيق الأول.', 'لأعضاء VIP الجداد بس، مرة واحدة.'],
  cs: ['Vítej ve VIP klubu 🥂', 'Digitální přístup máš odemčený. Teď tě dostaneme ven.', 'Uvítací dárek', 'SLEVA 30 %', 'na tvůj první workshop Global Track, Level 1', 'Nabídka končí za', 'Získat 30 % a rezervovat Level 1', 'Ne, díky, nejdřív si projdu aplikaci.', 'Jen pro nové členy VIP, jednou.'],
  es: ['Bienvenido al VIP Club 🥂', 'Tu acceso digital está desbloqueado. Ahora, salgamos de la pantalla.', 'Un regalo de bienvenida', '30% DE DESCUENTO', 'en tu primer taller Global Track de Nivel 1', 'La oferta termina en', 'Obtén el 30% y reserva el Nivel 1', 'No, gracias, primero exploraré la app.', 'Solo para nuevos miembros VIP, una vez.'],
  et: ['Tere tulemast VIP-klubisse 🥂', 'Digitaalne ligipääs on avatud. Nüüd viime su päriselu juurde.', 'Tervituskingitus', '30% SOODSAMALT', 'sinu esimene Global Tracki 1. taseme töötuba', 'Pakkumine lõpeb', 'Võta 30% ja broneeri 1. tase', 'Ei, aitäh, uurin enne äppi.', 'Ainult uutele VIP-liikmetele, üks kord.'],
  fr: ['Bienvenue au VIP Club 🥂', 'Ton accès numérique est débloqué. Maintenant, sortons de l’écran.', 'Un cadeau de bienvenue', '-30 %', 'sur ton premier atelier Global Track de niveau 1', 'L’offre se termine dans', 'Profiter des -30 % et réserver le niveau 1', 'Non merci, je vais d’abord explorer l’app.', 'Réservé aux nouveaux membres VIP, une seule fois.'],
  hi: ['VIP क्लब में स्वागत है 🥂', 'आपका डिजिटल एक्सेस खुल गया है। अब चलिए आपको ऑफ़लाइन ले चलें।', 'स्वागत तोहफ़ा', '30% छूट', 'आपकी पहली Level 1 Global Track वर्कशॉप पर', 'ऑफ़र ख़त्म होगा', '30% छूट लें और Level 1 बुक करें', 'नहीं, धन्यवाद, पहले ऐप देखूँगा।', 'सिर्फ़ नए VIP मेंबर्स के लिए, एक बार।'],
  it: ['Benvenuto nel VIP Club 🥂', 'Il tuo accesso digitale è sbloccato. Ora usciamo dallo schermo.', 'Un regalo di benvenuto', '30% DI SCONTO', 'sul tuo primo workshop Global Track di Livello 1', 'L’offerta scade tra', 'Prendi il 30% e prenota il Livello 1', 'No grazie, prima esploro l’app.', 'Solo per i nuovi membri VIP, una volta.'],
  ja: ['VIP クラブへようこそ 🥂', 'デジタルのアクセスは解放されました。次はオフラインへ。', 'ウェルカムギフト', '30% OFF', '初めての Global Track レベル1 ワークショップ', '終了まで', '30%オフでレベル1を予約', 'いいえ、まずアプリを見てみます。', '新しい VIP メンバー限定・一度だけ。'],
  ko: ['VIP 클럽에 오신 걸 환영해요 🥂', '디지털 접근이 열렸어요. 이제 오프라인으로 나가 볼까요.', '웰컴 선물', '30% 할인', '첫 Global Track 레벨 1 워크숍', '남은 시간', '30% 할인받고 레벨 1 예약하기', '괜찮아요, 앱부터 둘러볼게요.', '새 VIP 회원만, 한 번.'],
  nl: ['Welkom bij de VIP Club 🥂', 'Je digitale toegang is ontgrendeld. Nu gaan we offline.', 'Een welkomstcadeau', '30% KORTING', 'op je eerste Global Track-workshop van Level 1', 'Aanbod eindigt over', 'Pak 30% korting en boek Level 1', 'Nee, bedankt, ik verken eerst de app.', 'Alleen voor nieuwe VIP-leden, één keer.'],
  pt: ['Bem-vindo ao VIP Club 🥂', 'O teu acesso digital está desbloqueado. Agora, vamos sair do ecrã.', 'Um presente de boas-vindas', '30% DE DESCONTO', 'no teu primeiro workshop Global Track de Nível 1', 'A oferta termina em', 'Aproveita 30% e reserva o Nível 1', 'Não, obrigado, primeiro vou explorar a app.', 'Só para novos membros VIP, uma vez.'],
  ro: ['Bun venit în VIP Club 🥂', 'Accesul digital e deblocat. Acum, hai să ieșim din ecran.', 'Un cadou de bun venit', '30% REDUCERE', 'la primul tău atelier Global Track de Nivel 1', 'Oferta se termină în', 'Ia 30% reducere și rezervă Nivelul 1', 'Nu, mulțumesc, explorez mai întâi aplicația.', 'Doar pentru membrii VIP noi, o singură dată.'],
  ru: ['Добро пожаловать в VIP Club 🥂', 'Цифровой доступ открыт. Теперь — в офлайн.', 'Подарок в честь знакомства', 'СКИДКА 30%', 'на твой первый воркшоп Global Track уровня 1', 'Предложение закончится через', 'Взять 30% и записаться на уровень 1', 'Нет, спасибо, сначала посмотрю приложение.', 'Только для новых участников VIP, один раз.'],
  tr: ['VIP Club’a hoş geldin 🥂', 'Dijital erişimin açıldı. Şimdi seni ekrandan çıkaralım.', 'Hoş geldin hediyesi', '%30 İNDİRİM', 'ilk Global Track Seviye 1 atölyende', 'Teklifin bitmesine', '%30 indirimi al ve Seviye 1’i ayırt', 'Hayır, teşekkürler, önce uygulamayı keşfedeceğim.', 'Yalnızca yeni VIP üyelere, bir kez.'],
  uk: ['Ласкаво просимо до VIP Club 🥂', 'Цифровий доступ відкрито. Тепер — в офлайн.', 'Подарунок на знайомство', 'ЗНИЖКА 30%', 'на твій перший воркшоп Global Track рівня 1', 'Пропозиція закінчиться через', 'Взяти 30% і записатися на рівень 1', 'Ні, дякую, спершу подивлюся застосунок.', 'Лише для нових учасників VIP, один раз.'],
  zh: ['欢迎加入 VIP 俱乐部 🥂', '你的线上权限已解锁。现在，让我们走到线下。', '欢迎礼物', '7 折', '你的第一场 Global Track 一级工作坊', '优惠剩余', '领取 7 折并预订一级', '不用了，我先逛逛应用。', '仅限新 VIP 会员，仅此一次。'],
};
const OK = ['title', 'hook', 'gift', 'off', 'first', 'ends', 'cta', 'no', 'once'];
const ow = (lang, k) => { const i = OK.indexOf(k); return (OTO[lang] || OTO.en)[i] || OTO.en[i] || ''; };

const two = (n) => (n < 10 ? '0' : '') + n;
const hms = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return two(Math.floor(s / 3600)) + ':' + two(Math.floor((s % 3600) / 60)) + ':' + two(s % 60); };

// a handful of brand-colour flecks that drift down once, then are gone
const FLECKS = Array.from({ length: 14 }, (_, i) => ({ x: (i * 37) % 100, d: (i % 5) * 140, s: 6 + (i % 3) * 2, c: i % 3 === 0 ? C.sun : C.purple }));
const Fleck = ({ f }) => {
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => { Animated.timing(v, { toValue: 1, duration: 2600, delay: f.d, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -20, left: f.x + '%', width: f.s, height: f.s, borderRadius: f.s / 2, backgroundColor: f.c,
      opacity: v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.6, 0] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', (f.x % 2 ? 200 : -200) + 'deg'] }) }] }} />
  );
};

/* `offer` is my_welcome_offer(): { live, pct, now, expires_at, workshop } */
export const WelcomeOTO = ({ offer, onClaim, onClose }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  // the server's clock, not the phone's: skew is how far apart they are
  const skew = React.useMemo(() => { const t = Date.parse(offer && offer.now); return isNaN(t) ? 0 : t - Date.now(); }, [offer]);
  const end = Date.parse(offer && offer.expires_at) || 0;
  const [left, setLeft] = useState(() => end - (Date.now() + skew));
  React.useEffect(() => {
    const id = setInterval(() => { const l = end - (Date.now() + skew); setLeft(l); if (l <= 0) { clearInterval(id); onClose && onClose(); } }, 1000);
    return () => clearInterval(id);
  }, [end, skew]); // eslint-disable-line react-hooks/exhaustive-deps
  const breathe = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    tapSuccess();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ws = offer && offer.workshop;
  const wsTitle = ws ? ((lang === 'ar' && ws.title_ar) || ws.title) : null;
  const glow = Platform.OS === 'web'
    ? { backgroundImage: 'radial-gradient(90% 55% at 50% 0%, ' + (isDark ? 'rgba(124,58,237,0.32)' : 'rgba(124,58,237,0.16)') + ', transparent 70%)' }
    : null;
  const glass = Platform.OS === 'web'
    ? { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.62)', backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)' }
    : { backgroundColor: C.glass };

  return (
    <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9100, backgroundColor: C.bg }, glow]} accessibilityViewIsModal>
      {FLECKS.map((f, i) => <Fleck key={i} f={f} />)}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 440 }}>
          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800', letterSpacing: 2.4, textAlign: 'center' }}>MOMENTS VIP</Text>
          <Text style={{ color: C.text, fontSize: 34, fontWeight: '700', letterSpacing: -1.1, lineHeight: 40, marginTop: 14, textAlign: 'center' }}>{ow(lang, 'title')}</Text>
          <Text style={{ color: C.dim, fontSize: 17, lineHeight: 25, marginTop: 12, textAlign: 'center' }}>{ow(lang, 'hook')}</Text>

          {/* the offer: one pane of glass */}
          <View style={[{ marginTop: 32, borderRadius: 28, padding: 26, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(124,58,237,0.16)' }, glass]}>
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textAlign: 'center' }}>{ow(lang, 'gift').toUpperCase()}</Text>
            <Text style={[{ color: C.purple, fontSize: lang === 'ar' ? 46 : 52, lineHeight: lang === 'ar' ? 92 : 64, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : -1.8, textAlign: 'center', marginTop: 4 }, NUM]}>{ow(lang, 'off')}</Text>
            <Text style={{ color: C.text, fontSize: 16.5, lineHeight: 23, textAlign: 'center', marginTop: 2 }}>{ow(lang, 'first')}</Text>
            {ws ? (
              <View style={{ marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>{wsTitle}</Text>
                {ws.price != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                    <Text style={[{ color: C.faint, fontSize: 15, textDecorationLine: 'line-through', marginEnd: 8 }, NUM]}>{money(ws.price, ws.currency, lang)}</Text>
                    <Text style={[{ color: C.text, fontSize: 22, fontWeight: '700' }, NUM]}>{money(ws.price_after, ws.currency, lang)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 20 }}>{ow(lang, 'ends')}</Text>
            <Text style={[{ color: C.text, fontSize: 30, fontWeight: '600', letterSpacing: 1, textAlign: 'center', marginTop: 4, writingDirection: 'ltr' }, NUM]} accessibilityLiveRegion="polite">{hms(left)}</Text>
          </View>

          <Animated.View style={{ marginTop: 26, transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }}>
            <Pressable onPress={() => { tapMedium(); onClaim && onClaim(); }} accessibilityRole="button">
              <View style={{ borderRadius: 999, paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center', backgroundColor: C.purple }}>
                <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '700', textAlign: 'center' }}>{ow(lang, 'cta')}</Text>
              </View>
            </Pressable>
          </Animated.View>
          <Pressable onPress={() => { tapLight(); onClose && onClose(); }} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'center', marginTop: 18 }}>
            <Text style={{ color: C.dim, fontSize: 14.5, textAlign: 'center' }}>{ow(lang, 'no')}</Text>
          </Pressable>
          <Text style={{ color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 22 }}>{ow(lang, 'once')}</Text>
        </View>
      </ScrollView>
    </View>
  );
};
