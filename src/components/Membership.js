import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Platform, ActivityIndicator, Animated, Easing, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, NUM } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { buyTier, promoCode, setPromoCode } from '../services/payments';
import { promoRedeem } from '../services/gifts';
import { tapLight, tapMedium, tapSuccess, tapSelection } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ─── WELCOME TO THE CLUB ─────────────────────────────────────────────
   Ayser: Moments is a private, members-only community now. Somebody
   signed in without a membership sees this and only this — the app
   blurred behind it — and it reads as an invitation, not a wall: why
   (quality, safety), two plans, one tap to Lemon Squeezy, and a quiet
   "Why are we charging?" that answers honestly. Monochrome and type
   for Moments+; Moments violet — the one colour — for Black, the plan we
   recommend. The same page opens as a sheet for a member choosing a
   plan; VipSheet is the one-line door for a Moments+ member who reached
   for messages, a lounge or a full profile. The tiers and every door
   are the server's (RUN_ME.sql, "TWO TIERS"); the prices shown are the
   owner's (app_settings tier_prices) and must match the variants in
   Lemon Squeezy. */

const S = {
  en: ["A private table, every week.", "Curated offline Drops, live language Circles, and the people you meet there.", "Moments+", "The Essentials.", "Access the Social Feed", "Book offline Cafe Meetups", "View the Global Track Journey", "Join Moments+", "Moments Black", "The Full Experience.", "Everything in Moments+", "Unlock Direct Messaging (DMs)", "Access 24/7 Live Language Lounges", "Priority Meetup Booking", "Go Black", "Recommended", "/ month", "Why are we charging?", "Why Moments is paid now", "Local community managers — real people who host, check in and look after every meetup.", "The servers, the audio rooms and the safety tools that keep Moments running.", "Keeping creeps out. A paid membership stops fake accounts and spam before they start.", "Got it", "Payments open very soon — thank you for waiting.", "It did not go through. Try again.", "Sign out", "Your plan", "Done — your plan changes in a moment.", "Upgrade to Moments Black", "Unlock Messaging & Language Rooms.", "Not now", "Cancel any time."],
  ar: ["ترابيزة خاصة، كل أسبوع.", "قعدات مختارة، ودواير لغات مباشرة، والناس اللي بتقابلهم هناك.", "مومنتس بلس", "كل اللي تحتاجه عشان تخرج.", "الفيد", "احجز ترابيزة في كافيه", "مستويات اللغة", "اشترك في مومنتس بلس", "مومنتس بلاك", "كل حاجة مفتوحة.", "كل اللي في بلس", "ابعت رسايل لأي حد", "غرف لغات طول اليوم", "أولوية في الحجز", "اشترك في مومنتس بلاك", "ننصحك بيه", "/ شهر", "ليه الاشتراك بفلوس؟", "ليه الاشتراك بفلوس", "ناس حقيقية بتنظّم كل خروجة وبتستقبلك فيها.", "السيرفرات وغرف الصوت وأدوات الأمان.", "الاشتراك بيبعد الحسابات الفيك والسبام.", "تمام", "الدفع هيفتح قريب. شكرًا إنك مستني.", "ماتبعتش. جرّب تاني.", "تسجيل خروج", "اشتراكك", "تمام، اشتراكك هيتغيّر كمان شوية.", "اشترك في مومنتس بلاك", "ابعت رسايل لأي حد وادخل غرف اللغات.", "مش دلوقتي", "تقدر تلغي في أي وقت."],
  cs: ["Soukromý stůl, každý týden.", "Vybrané offline Drops, živé jazykové Circles a lidé, které tam potkáš.", "Moments+", "To podstatné.", "Přístup k sociálnímu feedu", "Rezervace setkání v kavárnách", "Global Track — tvoje cesta", "Připojit se k Moments+", "Moments Black", "Celý zážitek.", "Vše z Moments+", "Odemkni přímé zprávy", "Živé jazykové lounge 24/7", "Přednostní rezervace setkání", "Stát se Black", "Doporučujeme", "/ měsíc", "Proč si účtujeme?", "Proč je Moments placené", "Místní komunitní manažeři — skuteční lidé, kteří hostí, vítají a starají se o každé setkání.", "Servery, audio místnosti a bezpečnostní nástroje, díky nimž Moments běží.", "Držíme otravy venku. Placené členství zastaví falešné účty a spam hned na začátku.", "Rozumím", "Platby se otevřou velmi brzy — díky za trpělivost.", "Nepodařilo se. Zkus to znovu.", "Odhlásit se", "Tvůj plán", "Hotovo — plán se za chvíli změní.", "Přejdi na Moments Black", "Odemkni zprávy a jazykové místnosti.", "Teď ne", "Zrušit můžeš kdykoli."],
  es: ["Una mesa privada, cada semana.", "Drops presenciales seleccionados, Circles de idiomas en vivo y la gente que conoces allí.", "Moments+", "Lo esencial.", "Acceso al feed social", "Reserva encuentros en cafés", "Tu camino en el Global Track", "Unirme a Moments+", "Moments Black", "La experiencia completa.", "Todo lo de Moments+", "Desbloquea los mensajes directos", "Salas de idiomas en vivo 24/7", "Prioridad al reservar encuentros", "Hazte Black", "Recomendado", "/ mes", "¿Por qué cobramos?", "Por qué Moments es de pago", "Gestores de comunidad locales: personas reales que reciben, organizan y cuidan cada encuentro.", "Los servidores, las salas de audio y las herramientas de seguridad que mantienen Moments en marcha.", "Mantener fuera a los pesados. Una membresía de pago frena las cuentas falsas y el spam desde el principio.", "Entendido", "Los pagos abren muy pronto: gracias por esperar.", "No se envió. Inténtalo de nuevo.", "Cerrar sesión", "Tu plan", "Listo: tu plan cambia en un momento.", "Hazte Moments Black", "Desbloquea mensajes y salas de idiomas.", "Ahora no", "Cancela cuando quieras."],
  et: ["Privaatne laud, iga nädal.", "Valitud offline Dropid, otse keele-Circle'id ja inimesed, keda seal kohtad.", "Moments+", "Olulisim.", "Ligipääs sotsiaalsele voole", "Broneeri kohvikukohtumisi", "Vaata Global Tracki teekonda", "Liitu Moments+-iga", "Moments Black", "Täielik kogemus.", "Kõik, mis on Moments+-is", "Ava otsesõnumid", "Keelelounge’id otse 24/7", "Kohtumiste eelisbroneerimine", "Võta Moments Black", "Soovitame", "/ kuu", "Miks me tasu võtame?", "Miks Moments on nüüd tasuline", "Kohalikud kogukonnajuhid — päris inimesed, kes võõrustavad ja hoolitsevad iga kohtumise eest.", "Serverid, helitoad ja turvatööriistad, mis Momentsi töös hoiavad.", "Tüütajad jäävad välja. Tasuline liikmesus peatab võltskontod ja rämpsu kohe alguses.", "Selge", "Maksed avanevad varsti — aitäh ootamast.", "Ei läinud läbi. Proovi uuesti.", "Logi välja", "Sinu pakett", "Valmis — pakett muutub hetke pärast.", "Võta Moments Black", "Ava sõnumid ja keeletoad.", "Mitte praegu", "Tühista millal tahes."],
  fr: ["Une table privée, chaque semaine.", "Des Drops sélectionnés, des Circles de langues en direct et les gens que tu y rencontres.", "Moments+", "L’essentiel.", "Accès au fil social", "Réserver des rencontres au café", "Voir ton parcours Global Track", "Rejoindre Moments+", "Moments Black", "L’expérience complète.", "Tout Moments+", "Débloque les messages privés", "Salons de langues en direct 24h/24", "Réservation prioritaire des rencontres", "Devenir Black", "Recommandé", "/ mois", "Pourquoi c’est payant ?", "Pourquoi Moments est payant", "Des animateurs locaux — de vraies personnes qui accueillent et prennent soin de chaque rencontre.", "Les serveurs, les salons audio et les outils de sécurité qui font tourner Moments.", "Tenir les lourds à l’écart. Une adhésion payante arrête les faux comptes et le spam dès le départ.", "Compris", "Les paiements ouvrent très bientôt — merci de patienter.", "Ça n’est pas passé. Réessaie.", "Se déconnecter", "Ton offre", "C’est fait — ton offre change dans un instant.", "Passe à Moments Black", "Débloque les messages et les salons de langues.", "Pas maintenant", "Résiliable à tout moment."],
  hi: ["एक निजी टेबल, हर हफ़्ते।", "चुने हुए ऑफ़लाइन Drops, लाइव भाषा Circles, और वहाँ मिलने वाले लोग।", "Moments+", "ज़रूरी चीज़ें।", "सोशल फ़ीड", "कैफ़े मीटअप बुक करो", "Global Track की यात्रा देखो", "Moments+ लो", "Moments Black", "पूरा अनुभव।", "Moments+ का सब कुछ", "डायरेक्ट मैसेज खोलो", "24/7 लाइव लैंग्वेज लाउंज", "मीटअप बुकिंग में प्राथमिकता", "Black बनो", "हमारी सलाह", "/ महीना", "हम पैसे क्यों ले रहे हैं?", "Moments अब पेड क्यों है", "लोकल कम्युनिटी मैनेजर — असली लोग जो हर मीटअप होस्ट करते और संभालते हैं।", "सर्वर, ऑडियो रूम और सेफ़्टी टूल जो Moments चलाते हैं।", "परेशान करने वालों को दूर रखना। पेड मेंबरशिप फ़ेक अकाउंट और स्पैम को शुरू में ही रोकती है।", "समझ गया", "पेमेंट बहुत जल्द खुलेंगे — इंतज़ार के लिए शुक्रिया।", "नहीं गया। फिर कोशिश करो।", "साइन आउट", "तुम्हारा प्लान", "हो गया — प्लान थोड़ी देर में बदल जाएगा।", "Moments Black लो", "मैसेज और लैंग्वेज रूम खोलो।", "अभी नहीं", "कभी भी कैंसल करो।"],
  it: ["Un tavolo privato, ogni settimana.", "Drop dal vivo selezionati, Circle di lingua in diretta e le persone che incontri lì.", "Moments+", "L’essenziale.", "Accesso al feed social", "Prenota incontri al caffè", "Il tuo percorso Global Track", "Entra in Moments+", "Moments Black", "L’esperienza completa.", "Tutto di Moments+", "Sblocca i messaggi diretti", "Lounge di lingue dal vivo 24/7", "Prenotazione prioritaria degli incontri", "Diventa Black", "Consigliato", "/ mese", "Perché è a pagamento?", "Perché Moments ora è a pagamento", "Community manager locali: persone vere che accolgono e curano ogni incontro.", "I server, le stanze audio e gli strumenti di sicurezza che fanno girare Moments.", "Tenere fuori i molesti. Un abbonamento a pagamento ferma account falsi e spam fin dall’inizio.", "Ho capito", "I pagamenti aprono a breve: grazie per l’attesa.", "Non è andato. Riprova.", "Esci", "Il tuo piano", "Fatto: il piano cambia tra un attimo.", "Passa a Moments Black", "Sblocca messaggi e stanze di lingue.", "Non ora", "Disdici quando vuoi."],
  ja: ["プライベートなテーブルを、毎週。", "厳選オフラインDrop、ライブ語学Circle、そこで出会う人たち。", "Moments+", "必要なものを。", "ソーシャルフィード", "カフェのミートアップを予約", "Global Track の道のりを見る", "Moments+ に参加", "Moments Black", "すべてを体験。", "Moments+ のすべて", "ダイレクトメッセージを解放", "24時間ライブ語学ラウンジ", "ミートアップの優先予約", "Black になる", "おすすめ", "/ 月", "なぜ有料に？", "Moments が有料になった理由", "地域のコミュニティマネージャー — すべてのミートアップを迎え、見守る本物の人たち。", "Moments を動かすサーバー、音声ルーム、安全のための仕組み。", "迷惑な人を入れないこと。有料メンバーシップが偽アカウントやスパムを最初から止めます。", "わかった", "お支払いはまもなく開始します。お待ちいただきありがとうございます。", "送れませんでした。もう一度どうぞ。", "ログアウト", "現在のプラン", "完了 — まもなくプランが切り替わります。", "Moments Black にアップグレード", "メッセージと語学ルームを解放。", "今はしない", "いつでも解約できます。"],
  ko: ["매주, 나만의 프라이빗 테이블.", "엄선된 오프라인 Drop, 라이브 언어 Circle, 그리고 그곳에서 만나는 사람들.", "Moments+", "꼭 필요한 것.", "소셜 피드 이용", "카페 모임 예약", "Global Track 여정 보기", "Moments+ 가입", "Moments Black", "모든 경험.", "Moments+의 모든 것", "다이렉트 메시지 열기", "24시간 라이브 언어 라운지", "모임 우선 예약", "Black 되기", "추천", "/ 월", "왜 유료인가요?", "Moments가 유료가 된 이유", "지역 커뮤니티 매니저 — 모든 모임을 맞이하고 챙기는 진짜 사람들.", "Moments를 움직이는 서버, 오디오 방, 안전 도구.", "불쾌한 사람을 막기. 유료 멤버십이 가짜 계정과 스팸을 처음부터 막아요.", "알겠어요", "결제가 곧 열려요 — 기다려 주셔서 고마워요.", "전송되지 않았어요. 다시 해 주세요.", "로그아웃", "내 플랜", "완료 — 곧 플랜이 바뀌어요.", "Moments Black으로 업그레이드", "메시지와 언어 방을 여세요.", "나중에", "언제든 해지할 수 있어요."],
  nl: ["Een privé tafel, elke week.", "Geselecteerde offline Drops, live taal-Circles en de mensen die je daar ontmoet.", "Moments+", "De basis.", "Toegang tot de social feed", "Boek meetups in cafés", "Bekijk je Global Track-reis", "Word Moments+", "Moments Black", "De volledige ervaring.", "Alles van Moments+", "Ontgrendel directe berichten", "Live taallounges, 24/7", "Voorrang bij het boeken van meetups", "Word Black", "Aanbevolen", "/ maand", "Waarom betalen?", "Waarom Moments nu betaald is", "Lokale communitymanagers — echte mensen die elke meetup ontvangen en verzorgen.", "De servers, de audioruimtes en de veiligheidstools die Moments draaiende houden.", "Engerds buiten houden. Een betaald lidmaatschap stopt nepaccounts en spam bij de start.", "Begrepen", "Betalen kan heel binnenkort — bedankt voor je geduld.", "Het lukte niet. Probeer opnieuw.", "Uitloggen", "Je abonnement", "Klaar — je abonnement verandert zo.", "Upgrade naar Moments Black", "Ontgrendel berichten en taalruimtes.", "Niet nu", "Altijd opzegbaar."],
  pt: ["Uma mesa privada, toda semana.", "Drops presenciais selecionados, Circles de idiomas ao vivo e as pessoas que você conhece lá.", "Moments+", "O essencial.", "Acesso ao feed social", "Reserva encontros em cafés", "Vê o teu percurso Global Track", "Aderir ao Moments+", "Moments Black", "A experiência completa.", "Tudo do Moments+", "Desbloqueia mensagens diretas", "Salas de línguas ao vivo 24/7", "Prioridade nas reservas de encontros", "Tornar-me Black", "Recomendado", "/ mês", "Porque cobramos?", "Porque o Moments passou a ser pago", "Gestores de comunidade locais — pessoas reais que recebem e cuidam de cada encontro.", "Os servidores, as salas de áudio e as ferramentas de segurança que mantêm o Moments a funcionar.", "Manter os inconvenientes à porta. Uma adesão paga trava contas falsas e spam logo à partida.", "Percebi", "Os pagamentos abrem muito em breve — obrigado por esperares.", "Não foi. Tenta outra vez.", "Terminar sessão", "O teu plano", "Feito — o teu plano muda daqui a nada.", "Passa para o Moments Black", "Desbloqueia mensagens e salas de línguas.", "Agora não", "Cancela quando quiseres."],
  ro: ["O masă privată, în fiecare săptămână.", "Drops offline selectate, Circles de limbă live și oamenii pe care îi cunoști acolo.", "Moments+", "Esențialul.", "Acces la feedul social", "Rezervă întâlniri la cafenea", "Vezi drumul tău Global Track", "Intră în Moments+", "Moments Black", "Experiența completă.", "Tot ce e în Moments+", "Deblochează mesajele directe", "Lounge-uri de limbi live 24/7", "Rezervare prioritară la întâlniri", "Devino Black", "Recomandat", "/ lună", "De ce cerem bani?", "De ce Moments e acum cu plată", "Manageri de comunitate locali — oameni reali care primesc și au grijă de fiecare întâlnire.", "Serverele, camerele audio și uneltele de siguranță care țin Moments în funcțiune.", "Ținem deranjanții afară. Un abonament plătit oprește conturile false și spamul din start.", "Am înțeles", "Plățile se deschid foarte curând — mulțumim că aștepți.", "Nu a mers. Încearcă din nou.", "Ieși din cont", "Planul tău", "Gata — planul se schimbă imediat.", "Treci la Moments Black", "Deblochează mesajele și camerele de limbi.", "Nu acum", "Anulezi oricând."],
  ru: ["Личный стол, каждую неделю.", "Отобранные офлайн-Drops, живые языковые Circles и люди, которых ты там встретишь.", "Moments+", "Самое главное.", "Доступ к ленте", "Бронь встреч в кафе", "Твой путь Global Track", "Выбрать Moments+", "Moments Black", "Полный опыт.", "Всё из Moments+", "Личные сообщения", "Языковые лаунджи 24/7", "Приоритетная бронь встреч", "Стать Black", "Рекомендуем", "/ месяц", "Почему платно?", "Почему Moments теперь платный", "Местные комьюнити-менеджеры — живые люди, которые встречают гостей и заботятся о каждой встрече.", "Серверы, аудиокомнаты и инструменты безопасности, на которых держится Moments.", "Не пускать неприятных людей. Платное членство отсекает фейки и спам с самого начала.", "Понятно", "Оплата откроется совсем скоро — спасибо, что ждёшь.", "Не отправилось. Попробуй ещё раз.", "Выйти", "Твой тариф", "Готово — тариф сменится через минуту.", "Перейти на Moments Black", "Открой сообщения и языковые комнаты.", "Не сейчас", "Отменить можно в любой момент."],
  tr: ["Her hafta, özel bir masa.", "Seçkin offline Drop'lar, canlı dil Circle'ları ve orada tanıştığın insanlar.", "Moments+", "Temel olanlar.", "Sosyal akışa erişim", "Kafe buluşmaları ayırt", "Global Track yolculuğunu gör", "Moments+’a katıl", "Moments Black", "Tam deneyim.", "Moments+’taki her şey", "Direkt mesajları aç", "7/24 canlı dil salonları", "Buluşmalarda öncelikli rezervasyon", "Black ol", "Önerilen", "/ ay", "Neden ücretli?", "Moments neden artık ücretli", "Yerel topluluk yöneticileri — her buluşmayı karşılayan ve özenen gerçek insanlar.", "Moments’ı ayakta tutan sunucular, ses odaları ve güvenlik araçları.", "Rahatsız edenleri dışarıda tutmak. Ücretli üyelik sahte hesapları ve spamı en baştan durdurur.", "Anladım", "Ödemeler çok yakında açılıyor — beklediğin için teşekkürler.", "Gitmedi. Tekrar dene.", "Çıkış yap", "Planın", "Tamam — planın birazdan değişiyor.", "Moments Black’a geç", "Mesajları ve dil odalarını aç.", "Şimdi değil", "İstediğin zaman iptal et."],
  uk: ["Особистий стіл, щотижня.", "Відібрані офлайн-Drops, живі мовні Circles і люди, яких ти там зустрінеш.", "Moments+", "Найголовніше.", "Доступ до стрічки", "Бронюй зустрічі в кав’ярнях", "Твій шлях Global Track", "Обрати Moments+", "Moments Black", "Повний досвід.", "Усе з Moments+", "Особисті повідомлення", "Мовні лаунжі 24/7", "Пріоритетне бронювання зустрічей", "Стати Black", "Рекомендуємо", "/ місяць", "Чому платно?", "Чому Moments тепер платний", "Місцеві ком’юніті-менеджери — живі люди, які зустрічають гостей і дбають про кожну зустріч.", "Сервери, аудіокімнати й інструменти безпеки, на яких тримається Moments.", "Не пускати неприємних людей. Платне членство відсікає фейки та спам із самого початку.", "Зрозуміло", "Оплата відкриється зовсім скоро — дякуємо, що чекаєш.", "Не вийшло. Спробуй ще раз.", "Вийти", "Твій тариф", "Готово — тариф зміниться за хвилину.", "Перейти на Moments Black", "Відкрий повідомлення й мовні кімнати.", "Не зараз", "Скасувати можна будь-коли."],
  zh: ["每周，一张属于你的桌子。", "精选线下 Drop、实时语言 Circle，以及你在那里遇见的人。", "Moments+", "核心功能。", "浏览社交动态", "预订线下咖啡馆聚会", "查看 Global Track 旅程", "加入 Moments+", "Moments Black", "完整体验。", "Moments+ 的全部内容", "解锁私信", "24/7 实时语言休息室", "聚会优先预订", "成为 Black", "推荐", "/ 月", "为什么收费？", "Moments 为什么收费", "本地社区管理员——迎接并照顾每一场聚会的真实的人。", "让 Moments 运转的服务器、语音房间和安全工具。", "把骚扰者挡在门外。付费会员从一开始就挡住假账号和垃圾信息。", "明白了", "支付很快开放——感谢你的等待。", "没有成功，再试一次。", "退出登录", "你的方案", "好了——你的方案马上就会更新。", "升级到 Moments Black", "解锁私信和语言房间。", "以后再说", "随时可以取消。"],
};
const K = ['hero', 'sub', 'basic', 'basicTag', 'f1', 'f2', 'f3', 'joinBasic', 'vip', 'vipTag', 'v1', 'v2', 'v3', 'v4', 'becomeVip', 'rec', 'perMonth', 'why', 'whyTitle', 'w1', 'w2', 'w3', 'gotIt', 'soon', 'err', 'signOut', 'current', 'changed', 'vipTitle', 'vipSub', 'notNow', 'cancel'];
/* Black is paid by the year when the owner says so (tier_prices.vip_period) */
const PER_YEAR = { en: '/ year', ar: '/ سنة', cs: '/ rok', es: '/ año', et: '/ aastas', fr: '/ an', hi: '/ साल', it: '/ anno', ja: '/ 年', ko: '/ 년', nl: '/ jaar', pt: '/ ano', ro: '/ an', ru: '/ год', tr: '/ yıl', uk: '/ рік', zh: '/ 年' };
const per = (lang, period, cur) => (lang === 'ar' && (cur || 'EGP') === 'EGP' ? 'جنيه ' : '') + (period === 'year' ? PER_YEAR[lang] || PER_YEAR.en : w(lang, 'perMonth'));
const w = (lang, k) => { const i = K.indexOf(k); return (S[lang] || S.en)[i] || S.en[i] || ''; };

/* Ayser, October 2026: members pay for access, not for a lower price */
const GT_ACCESS = {
  en: '✦ Exclusive Global Track Access|Members-only travel expeditions, cultural retreats and support with Erasmus+ applications.',
  ar: '✦ دخول حصري للمسار العالمي|رحلات واستكشافات للأعضاء بس، وخلوات ثقافية، ومساعدة في التقديم على Erasmus+.',
};

/* the two-card gate (Ayser, the unified architecture): Moments+ is the plan
   we point at, Moments Black the anchor beside it; monthly or yearly */
const G = {
  en: ["Monthly", "Yearly", "MOST POPULAR", "Billed monthly • Cancel in one tap", "Billed yearly • Cancel in one tap", "Curated Offline Drops|Reserve your seat at weekly Thursday tables (2 a month).", "Weekly Language Circles|30-minute live audio sessions, timed by community vote.", "Table Buddy Messaging|Private, distraction-free chat with the people you meet.", "My Day & Private Notes|Your minimalist daily focus canvas.", "Verified Member Badge (✦)|Full access to the curated community feed.", "Everything in Moments+", "4 Offline Drops a month|Book several weeks ahead.", "Unlimited Language Circles", "More than one table booked|No waiting to check in first.", "100% First-Table Guarantee • Cancel in 1 tap", "Save {n}%", "Become a Member", "Explore the app first (read-only)"],
  ar: ["شهري", "سنوي", "الأكثر طلبًا", "بيتحاسب كل شهر • تلغي بضغطة", "بيتحاسب كل سنة • تلغي بضغطة", "قعدات مختارة|احجز كرسيك في قعدات الخميس كل أسبوع (٢ في الشهر).", "دواير لغات كل أسبوع|نص ساعة صوت مباشر، ومعادها بتصويت الأعضاء.", "رسايل أصحاب الترابيزة|شات خاص وهادي مع الناس اللي قابلتهم.", "يومي وملاحظاتي|مساحة بسيطة تركز فيها على يومك.", "علامة العضو (✦)|دخول كامل لفيد المجتمع.", "كل اللي في مومنتس بلس", "٤ قعدات في الشهر|واحجز كذا أسبوع قدام.", "دواير لغات من غير حد", "أكتر من حجز في نفس الوقت|من غير ما تستنى تحضر الأول.", "ضمان ١٠٠٪ لأول قعدة • تلغي بضغطة", "وفّر {n}٪", "انضم للعضوية", "اتفرج على التطبيق الأول (قراءة بس)"],
  cs: ["Měsíčně", "Ročně", "NEJOBLÍBENĚJŠÍ • NEJLEPŠÍ HODNOTA", "Účtováno měsíčně • Zrušení jedním klepnutím", "Účtováno ročně • Zrušení jedním klepnutím", "Vybrané offline Drops|Rezervuj si místo u čtvrtečních stolů (2 měsíčně).", "Týdenní jazykové Circles|30minutová živá audio setkání, čas volí komunita.", "Zprávy s Table Buddies|Soukromý chat bez rušení s lidmi, které potkáš.", "Můj den a soukromé poznámky|Tvé minimalistické plátno pro každodenní soustředění.", "Ověřený odznak člena (✦)|Plný přístup do kurátorského feedu komunity.", "Vše z Moments+", "4 offline Drops měsíčně|Rezervuj i několik týdnů dopředu.", "Neomezené jazykové Circles", "Více stolů najednou|Bez čekání na odbavení.", "100% záruka prvního stolu • Zrušení jedním klepnutím", "Ušetři {n} %", "Stát se členem", "Nejdřív si prohlédnout aplikaci (jen čtení)"],
  es: ["Mensual", "Anual", "EL MÁS POPULAR • MEJOR VALOR", "Facturación mensual • Cancela con un toque", "Facturación anual • Cancela con un toque", "Drops presenciales seleccionados|Reserva tu silla en las mesas de los jueves (2 al mes).", "Circles de idiomas semanales|Sesiones de audio en vivo de 30 minutos, a la hora que vota la comunidad.", "Mensajes con Table Buddies|Chat privado y sin distracciones con la gente que conoces.", "Mi día y notas privadas|Tu lienzo minimalista para enfocarte cada día.", "Insignia de miembro verificado (✦)|Acceso completo al feed curado de la comunidad.", "Todo lo de Moments+", "4 Drops presenciales al mes|Reserva con varias semanas de antelación.", "Circles de idiomas ilimitados", "Más de una mesa reservada|Sin esperar a hacer check-in.", "Garantía 100% en tu primera mesa • Cancela con 1 toque", "Ahorra {n} %", "Hazte miembro", "Explora la app primero (solo lectura)"],
  et: ["Kuu", "Aasta", "POPULAARSEIM • PARIM VÄÄRTUS", "Arveldus iga kuu • Tühista ühe puudutusega", "Arveldus kord aastas • Tühista ühe puudutusega", "Valitud offline Dropid|Broneeri koht neljapäevastes laudades (2 kuus).", "Iganädalased keele-Circle'id|30-minutilised otse helisessioonid, aja valib kogukond.", "Table Buddies sõnumid|Privaatne ja rahulik vestlus inimestega, keda kohtad.", "Minu päev ja privaatsed märkmed|Sinu minimalistlik igapäevase fookuse lõuend.", "Kinnitatud liikme märk (✦)|Täielik ligipääs kureeritud kogukonna voole.", "Kõik, mis Moments+", "4 offline Dropi kuus|Broneeri mitu nädalat ette.", "Piiramatud keele-Circle'id", "Mitu lauda korraga|Ilma esmalt registreerumist ootamata.", "100% esimese laua garantii • Tühista 1 puudutusega", "Säästa {n}%", "Hakka liikmeks", "Vaata enne äppi (ainult lugemine)"],
  fr: ["Mensuel", "Annuel", "LE PLUS POPULAIRE • MEILLEURE VALEUR", "Facturé chaque mois • Résiliable en un geste", "Facturé chaque année • Résiliable en un geste", "Drops sélectionnés|Réserve ta place aux tables du jeudi (2 par mois).", "Circles de langues chaque semaine|30 minutes d’audio en direct, à l’heure votée par la communauté.", "Messages entre Table Buddies|Un chat privé et sans distraction avec les gens que tu rencontres.", "Ma journée et notes privées|Ta toile minimaliste pour te concentrer chaque jour.", "Badge de membre vérifié (✦)|Accès complet au fil sélectionné de la communauté.", "Tout Moments+", "4 Drops par mois|Réserve plusieurs semaines à l’avance.", "Circles de langues illimités", "Plusieurs tables réservées|Sans attendre ton check-in.", "Garantie 100 % sur ta première table • Résiliable en 1 geste", "Économise {n} %", "Devenir membre", "Découvrir l’app d’abord (lecture seule)"],
  hi: ["मासिक", "सालाना", "सबसे लोकप्रिय • बेस्ट वैल्यू", "हर महीने बिल • एक टैप में रद्द", "हर साल बिल • एक टैप में रद्द", "चुने हुए ऑफ़लाइन Drops|हर हफ़्ते गुरुवार की टेबल पर अपनी सीट बुक करो (महीने में 2)।", "हर हफ़्ते भाषा Circles|30 मिनट के लाइव ऑडियो सेशन, समय समुदाय के वोट से।", "Table Buddy मैसेजिंग|जिनसे मिले, उनसे निजी और शांत चैट।", "मेरा दिन और निजी नोट्स|रोज़ के फ़ोकस के लिए आपका सादा कैनवास।", "वेरिफ़ाइड मेंबर बैज (✦)|चुनी हुई कम्युनिटी फ़ीड तक पूरी पहुँच।", "Moments+ की हर चीज़", "महीने में 4 ऑफ़लाइन Drops|कई हफ़्ते पहले बुक करो।", "असीमित भाषा Circles", "एक से ज़्यादा टेबल बुक|पहले चेक-इन का इंतज़ार नहीं।", "पहली टेबल पर 100% गारंटी • 1 टैप में रद्द", "{n}% बचाओ", "मेंबर बनो", "पहले ऐप देखो (सिर्फ़ पढ़ना)"],
  it: ["Mensile", "Annuale", "IL PIÙ SCELTO • MIGLIOR VALORE", "Addebito mensile • Annulli con un tocco", "Addebito annuale • Annulli con un tocco", "Drop dal vivo selezionati|Prenota il tuo posto ai tavoli del giovedì (2 al mese).", "Circle di lingua settimanali|30 minuti di audio dal vivo, all’ora votata dalla community.", "Messaggi con i Table Buddies|Chat privata e senza distrazioni con le persone che incontri.", "La mia giornata e note private|La tua tela minimalista per la concentrazione quotidiana.", "Badge di membro verificato (✦)|Accesso completo al feed curato della community.", "Tutto di Moments+", "4 Drop al mese|Prenota con settimane d’anticipo.", "Circle di lingua illimitati", "Più tavoli prenotati|Senza aspettare il check-in.", "Garanzia 100% sul primo tavolo • Annulli con 1 tocco", "Risparmi il {n}%", "Diventa membro", "Esplora prima l’app (sola lettura)"],
  ja: ["月額", "年額", "一番人気 • ベストバリュー", "毎月請求 • ワンタップで解約", "毎年請求 • ワンタップで解約", "厳選オフラインDrop|毎週木曜のテーブルに席を予約（月2回）。", "毎週の語学Circle|30分のライブ音声。時間はコミュニティの投票で決定。", "Table Buddyメッセージ|出会った人との、静かでプライベートなチャット。", "マイデイとプライベートメモ|毎日の集中のためのミニマルなキャンバス。", "認証メンバーバッジ（✦）|厳選されたコミュニティフィードにフルアクセス。", "Moments+のすべて", "月4回のオフラインDrop|数週間先まで予約可能。", "語学Circleは無制限", "複数のテーブルを予約|チェックインを待たずに。", "最初のテーブル100%保証 • ワンタップで解約", "{n}%お得", "メンバーになる", "まずアプリを見てみる（閲覧のみ）"],
  ko: ["월간", "연간", "가장 인기 • 최고의 가치", "매월 결제 • 한 번에 해지", "매년 결제 • 한 번에 해지", "엄선된 오프라인 Drop|매주 목요일 테이블에 자리를 예약하세요(월 2회).", "매주 언어 Circle|커뮤니티 투표로 정한 시간의 30분 라이브 오디오.", "Table Buddy 메시지|만난 사람들과의 조용하고 사적인 채팅.", "마이 데이와 개인 메모|매일의 집중을 위한 미니멀한 캔버스.", "인증 회원 배지(✦)|엄선된 커뮤니티 피드 전체 이용.", "Moments+의 모든 것", "월 4회 오프라인 Drop|몇 주 앞까지 예약.", "언어 Circle 무제한", "여러 테이블 동시 예약|체크인을 기다릴 필요 없이.", "첫 테이블 100% 보장 • 한 번에 해지", "{n}% 절약", "회원 되기", "먼저 앱 둘러보기(읽기 전용)"],
  nl: ["Maandelijks", "Jaarlijks", "MEEST GEKOZEN • BESTE WAARDE", "Maandelijks gefactureerd • Opzeggen met één tik", "Jaarlijks gefactureerd • Opzeggen met één tik", "Geselecteerde offline Drops|Reserveer je plek aan de tafels op donderdag (2 per maand).", "Wekelijkse taal-Circles|30 minuten live audio, op het tijdstip dat de community kiest.", "Berichten met Table Buddies|Privé chat zonder afleiding met de mensen die je ontmoet.", "Mijn dag en privénotities|Jouw minimalistische canvas voor dagelijkse focus.", "Geverifieerde ledenbadge (✦)|Volledige toegang tot de geselecteerde communityfeed.", "Alles van Moments+", "4 offline Drops per maand|Reserveer weken vooruit.", "Onbeperkt taal-Circles", "Meer dan één tafel geboekt|Zonder eerst in te checken.", "100% garantie op je eerste tafel • Opzeggen met 1 tik", "Bespaar {n}%", "Word lid", "Eerst de app verkennen (alleen lezen)"],
  pt: ["Mensal", "Anual", "O MAIS POPULAR • MELHOR VALOR", "Cobrança mensal • Cancele com um toque", "Cobrança anual • Cancele com um toque", "Drops presenciais selecionados|Reserve seu lugar nas mesas de quinta (2 por mês).", "Circles de idiomas semanais|30 minutos de áudio ao vivo, no horário votado pela comunidade.", "Mensagens com Table Buddies|Chat privado e sem distrações com quem você conhece.", "Meu dia e notas privadas|Sua tela minimalista para o foco diário.", "Selo de membro verificado (✦)|Acesso total ao feed selecionado da comunidade.", "Tudo do Moments+", "4 Drops presenciais por mês|Reserve com semanas de antecedência.", "Circles de idiomas ilimitados", "Mais de uma mesa reservada|Sem esperar o check-in.", "Garantia de 100% na primeira mesa • Cancele com 1 toque", "Poupa {n}%", "Seja membro", "Explore o app primeiro (só leitura)"],
  ro: ["Lunar", "Anual", "CEL MAI ALES • CEA MAI BUNĂ VALOARE", "Facturat lunar • Anulezi dintr-o atingere", "Facturat anual • Anulezi dintr-o atingere", "Drops offline selectate|Rezervă-ți locul la mesele de joi (2 pe lună).", "Circles de limbă săptămânale|30 de minute audio live, la ora votată de comunitate.", "Mesaje cu Table Buddies|Chat privat, fără distrageri, cu oamenii pe care îi cunoști.", "Ziua mea și notițe private|Pânza ta minimalistă pentru concentrarea zilnică.", "Insignă de membru verificat (✦)|Acces complet la feedul selectat al comunității.", "Tot ce are Moments+", "4 Drops offline pe lună|Rezervă cu săptămâni înainte.", "Circles de limbă nelimitate", "Mai multe mese rezervate|Fără să aștepți check-in-ul.", "Garanție 100% la prima masă • Anulezi dintr-o atingere", "Economisești {n}%", "Devino membru", "Explorează aplicația întâi (doar citire)"],
  ru: ["Ежемесячно", "Ежегодно", "САМЫЙ ПОПУЛЯРНЫЙ • ЛУЧШАЯ ЦЕНА", "Списание раз в месяц • Отмена в одно касание", "Списание раз в год • Отмена в одно касание", "Отобранные офлайн-Drops|Бронируй место за столами по четвергам (2 в месяц).", "Языковые Circles каждую неделю|30 минут живого аудио, время выбирает сообщество.", "Сообщения с Table Buddies|Личный спокойный чат с теми, с кем ты познакомился.", "Мой день и личные заметки|Твой минималистичный холст для ежедневного фокуса.", "Значок проверенного участника (✦)|Полный доступ к отобранной ленте сообщества.", "Всё из Moments+", "4 офлайн-Drops в месяц|Бронируй на несколько недель вперёд.", "Языковые Circles без ограничений", "Несколько столов сразу|Не дожидаясь отметки на месте.", "100% гарантия первого стола • Отмена в одно касание", "Экономия {n}%", "Стать участником", "Сначала посмотреть приложение (только чтение)"],
  tr: ["Aylık", "Yıllık", "EN POPÜLER • EN İYİ DEĞER", "Aylık faturalandırılır • Tek dokunuşla iptal", "Yıllık faturalandırılır • Tek dokunuşla iptal", "Seçkin offline Drop'lar|Her perşembe masalarında yerini ayırt (ayda 2).", "Haftalık dil Circle'ları|Topluluğun oylayarak seçtiği saatte 30 dakikalık canlı sesli oturumlar.", "Table Buddy mesajları|Tanıştığın kişilerle özel ve sakin sohbet.", "Günüm ve özel notlar|Günlük odak için minimalist tuvalin.", "Doğrulanmış üye rozeti (✦)|Seçkin topluluk akışına tam erişim.", "Moments+'ın her şeyi", "Ayda 4 offline Drop|Haftalar öncesinden ayırt.", "Sınırsız dil Circle'ı", "Birden fazla masa ayırtma|Önce giriş yapmayı beklemeden.", "İlk masada %100 garanti • Tek dokunuşla iptal", "%{n} tasarruf", "Üye ol", "Önce uygulamayı keşfet (yalnızca okuma)"],
  uk: ["Щомісяця", "Щороку", "НАЙПОПУЛЯРНІШИЙ • НАЙКРАЩА ЦІНА", "Оплата щомісяця • Скасування в один дотик", "Оплата щороку • Скасування в один дотик", "Відібрані офлайн-Drops|Бронюй місце за столами щочетверга (2 на місяць).", "Мовні Circles щотижня|30 хвилин живого аудіо, час обирає спільнота.", "Повідомлення з Table Buddies|Особистий спокійний чат із людьми, яких ти зустрів.", "Мій день і особисті нотатки|Твоє мінімалістичне полотно для щоденного фокусу.", "Значок перевіреного учасника (✦)|Повний доступ до відібраної стрічки спільноти.", "Усе з Moments+", "4 офлайн-Drops на місяць|Бронюй на кілька тижнів наперед.", "Мовні Circles без обмежень", "Кілька столів одночасно|Без очікування відмітки на місці.", "100% гарантія першого столу • Скасування в один дотик", "Економія {n}%", "Стати учасником", "Спершу переглянути застосунок (лише читання)"],
  zh: ["按月", "按年", "最受欢迎 • 最超值", "按月计费 • 一键取消", "按年计费 • 一键取消", "精选线下 Drop|每周四的餐桌，预订你的座位（每月 2 次）。", "每周语言 Circle|30 分钟实时语音，时间由社区投票决定。", "Table Buddy 私信|和你认识的人，安静私密地聊天。", "我的一天与私人笔记|你的极简每日专注画布。", "认证会员徽章（✦）|完整访问精选社区动态。", "Moments+ 的全部内容", "每月 4 次线下 Drop|可提前数周预订。", "不限次数的语言 Circle", "同时预订多张餐桌|无需先签到。", "首桌 100% 保障 • 一键取消", "省 {n}%", "成为会员", "先逛逛应用（只读）"],
};
const GK = ['month', 'year', 'pop', 'billedM', 'billedY', 'p1', 'p2', 'p3', 'p4', 'p5', 'b1', 'b2', 'b3', 'b4', 'guar', 'save', 'become', 'explore'];
const g = (lang, k, n) => { const i = GK.indexOf(k); return ((G[lang] || G.en)[i] || G.en[i] || '').replace('{n}', n == null ? '' : n); };


/* Arabic: the figure in plain digits, "جنيه" said beside the period —
   the big "١٢٩ ج.م.‏" read badly */
const money = (n, cur, lang) => {
  if (lang === 'ar' && (cur || 'EGP') === 'EGP') return Math.round(n).toLocaleString('en');
  try { return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : lang || 'en', { style: 'currency', currency: cur || 'EGP', maximumFractionDigits: 0 }).format(n); } catch (e) { return n + ' ' + (cur || 'EGP'); }
};
const blur = Platform.OS === 'web' ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } : null;

const Check = ({ label, strong, onBrand, ink, mark }) => {
  const [head, more] = String(label).split('|');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 12 }}>
      <Text style={{ color: mark || (onBrand ? C.purple : (ink || C.text)), fontSize: 15, fontWeight: '700', width: 18, textAlign: 'center', marginEnd: 10 }}>✓</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: ink || C.text, fontSize: 15, lineHeight: 21, fontWeight: strong || more ? '600' : '400' }}>{head}</Text>
        {more ? <Text style={{ color: '#A3A3A3', fontSize: 13.5, lineHeight: 19, marginTop: 2 }}>{more}</Text> : null}
      </View>
    </View>
  );
};

/* The gateway is Moments Black's front door, so it is black and white
   for everybody, day or night (Ayser: "Pure Monochrome … Swiss"): OLED
   black, two dark glass cards with crisp white hairlines, Moments Black
   lit by a white glow and an inverted "Recommended" pill, and its button
   solid white with a black label. Moments+ is the outlined one. */
const MONO = { ground: 'rgba(10,10,10,0.78)', ink: '#FFFFFF', muted: '#A3A3A3', line: 'rgba(255,255,255,0.22)' };
const glow = Platform.OS === 'web' ? { boxShadow: '0 0 0 1px #FFFFFF, 0 0 28px rgba(255,255,255,0.22)' } : null;

/* one plan: the name small, the promise large, the price in figures, one button */
const Plan = ({ lang, name, tag, price, cur, period, items, cta, onPress, busy, vip, current, badge, sub, under }) => {
  const P = MONO;
  const sp = (v) => (lang === 'ar' ? 0 : v);   // spacing pulls Arabic letters apart
  return (
  <View style={[{ marginTop: 18, borderRadius: 24, padding: 26, backgroundColor: P.ground, borderWidth: 1, borderColor: vip ? '#FFFFFF' : P.line }, blur, vip ? glow : null]}>
    {badge ? (
      <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: '#FFFFFF', marginBottom: 12 }}>
        <Text style={{ color: '#000000', fontSize: 10.5, fontWeight: '800', letterSpacing: sp(0.6) }}>{badge}</Text>
      </View>
    ) : null}
    <Text style={{ color: vip ? '#FFFFFF' : P.muted, fontSize: 12, fontWeight: '800', letterSpacing: sp(1.6) }}>{name.toUpperCase()}</Text>
    <Text style={{ color: P.ink, fontSize: 26, fontWeight: '700', letterSpacing: sp(-0.7), marginTop: 10 }}>{tag}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14 }}>
      <Text style={[{ color: P.ink, fontSize: 40, fontWeight: '700', letterSpacing: sp(-1.2) }, NUM]}>{money(price, cur, lang)}</Text>
      <Text style={{ color: P.muted, fontSize: 15, marginStart: 6 }}>{per(lang, period, cur)}</Text>
    </View>
    {sub ? <Text style={{ color: P.muted, fontSize: 13.5, marginTop: 4 }}>{sub}</Text> : null}
    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', paddingTop: 4 }}>
      {items.map(([label, strong]) => <Check key={label} label={label} strong={strong} ink={P.ink} mark="#FFFFFF" />)}
    </View>
    {current ? (
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 22 }}>{'✓ ' + w(lang, 'current')}</Text>
    ) : (
      <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" style={{ marginTop: 24 }}>
        {({ pressed }) => (
          <View style={{ borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: vip ? (pressed ? '#E5E5E5' : '#FFFFFF') : (pressed ? 'rgba(255,255,255,0.08)' : 'transparent'), borderWidth: vip ? 0 : 1, borderColor: '#FFFFFF' }}>
            {busy ? <ActivityIndicator color={vip ? '#000000' : '#FFFFFF'} /> : <Text style={{ color: vip ? '#000000' : '#FFFFFF', fontSize: 16.5, fontWeight: '600' }}>{cta}</Text>}
          </View>
        )}
      </Pressable>
    )}
    {under && !current ? <Text style={{ color: P.muted, fontSize: 12.5, textAlign: 'center', marginTop: 10 }}>{under}</Text> : null}
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
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.6 }}>{w(lang, 'whyTitle')}</Text>
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
  const buy = async (tier, period) => {
    if (busy) return;
    tapMedium(); setBusy(tier); setNote(null);
    const r = await buyTier(tier, m, period);
    setBusy(null);
    if (r.ok && r.changed) { tapSuccess(); setNote(w(lang, 'changed')); }
    else if (!r.ok) setNote(w(lang, r.reason === 'not_configured' ? 'soon' : 'err'));
  };
  return { busy, note, buy };
};

/* a promo code: one quiet line that opens into a field. Lemon Squeezy
   checks the code at the checkout and takes it off there. */
const PROMO = {
  en: ['Have a promo code?', 'Promo code', 'Apply', 'Code {c} — it comes off at checkout', 'Remove', '{t} is yours until {d}.', 'You already used this code.', 'This code has ended.', 'You already pay for longer than this.', 'This code is all used up.'],
  ar: ['معاك كود خصم؟', 'كود الخصم', 'تمام', 'الكود {c} — هيتخصم في صفحة الدفع', 'شيله', '{t} بقى عندك لحد {d}.', 'انت استخدمت الكود ده قبل كده.', 'الكود ده خلص.', 'انت دافع لمدة أطول من كده.', 'الكود ده اتستخدم بالكامل.'],
};
const pw = (lang, i) => (PROMO[lang] || PROMO.en)[i];
const Promo = ({ lang }) => {
  const [code, setCode] = useState(promoCode);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (msg) return <Text style={{ color: '#FFFFFF', fontSize: 14, textAlign: 'center', marginTop: 16, lineHeight: 20 }}>{msg}</Text>;
  if (code) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13.5 }}>{pw(lang, 3).replace('{c}', code)}</Text>
        <Pressable onPress={() => { tapLight(); setCode(setPromoCode('')); }} accessibilityRole="button" hitSlop={8} style={{ marginStart: 10 }}>
          <Text style={{ color: '#A3A3A3', fontSize: 13.5, textDecorationLine: 'underline' }}>{pw(lang, 4)}</Text>
        </Pressable>
      </View>
    );
  }
  if (!open) {
    return (
      <Pressable onPress={() => { tapLight(); setOpen(true); }} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'center', marginTop: 16 }}>
        <Text style={{ color: '#A3A3A3', fontSize: 13.5, textDecorationLine: 'underline' }}>{pw(lang, 0)}</Text>
      </Pressable>
    );
  }
  /* a free-days code is taken here and now; a % code (or one made in
     Lemon Squeezy itself) goes with them to the checkout */
  const apply = async () => {
    const c = draft.trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    const r = await promoRedeem(c);
    setBusy(false);
    if (r && r.ok) {
      tapSuccess();
      const d = new Date(r.until).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'long' });
      setMsg(pw(lang, 5).replace('{t}', r.tier === 'vip' ? 'Moments Black' : 'Moments+').replace('{d}', d));
      setTimeout(() => { try { window.location.reload(); } catch (e) {} }, 2200);
      return;
    }
    const why = r && r.reason;
    if (why === 'used' || why === 'expired' || why === 'paying' || why === 'full') {
      setDraft(''); setOpen(false);
      setMsg(pw(lang, { used: 6, expired: 7, paying: 8, full: 9 }[why]));
      setTimeout(() => setMsg(null), 3500);
      return;
    }
    const kept = setPromoCode(c);
    if (kept) { tapSuccess(); setCode(kept); setOpen(false); }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
      <TextInput value={draft} onChangeText={(x) => setDraft(x.toUpperCase())} placeholder={pw(lang, 1)} placeholderTextColor="#737373" autoCapitalize="characters" autoCorrect={false} maxLength={32} onSubmitEditing={apply}
        style={{ flex: 1, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: '#262626', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, outlineStyle: 'none' }} />
      <Pressable onPress={apply} accessibilityRole="button" style={{ marginStart: 8 }}>
        <View style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#FFFFFF' }}>
          <Text style={{ color: '#000000', fontSize: 14, fontWeight: '600' }}>{pw(lang, 2)}</Text>
        </View>
      </Pressable>
    </View>
  );
};

/* the gateway: `hard` when somebody without a membership signed in (nothing else to tap),
   or a sheet for a member choosing a plan */
export const PricingGate = ({ m, hard, onClose, onSignOut }) => {
  // as a sheet, back closes it; as the gate there is nothing behind it to go back to
  useSheetBack(hard ? () => {} : onClose);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [why, setWhy] = useState(false);
  const { busy, note, buy } = useBuy(lang, m);
  const pr = (m && m.prices) || { basic: 129, basic_year: 990, vip_month: 299, vip: 1300, vip_period: 'year', currency: 'EGP' };
  const tier = m ? m.tier : 'FREE';
  const [period, setPeriod] = useState('month');
  const yearly = period === 'year';

  const page = (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: insets.top + 44, paddingBottom: insets.bottom + 44, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 480 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 2.6 }}>✦ MOMENTS</Text>
        <Text style={{ color: '#FFF', fontSize: lang === 'ar' ? 32 : 38, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -1.3, lineHeight: lang === 'ar' ? 48 : 43, marginTop: 18 }}>{w(lang, 'hero')}</Text>
        <Text style={{ color: '#A3A3A3', fontSize: 16.5, lineHeight: 25, marginTop: 16, marginBottom: 14 }}>{w(lang, 'sub')}</Text>

        {/* monthly or yearly, then Moments+ (the one we point at) beside Black (the anchor) */}
        <View style={{ flexDirection: 'row', alignSelf: 'center', marginTop: 6, borderRadius: 999, borderWidth: 1, borderColor: '#1F1F1F', padding: 4 }} accessibilityRole="tablist">
          {['month', 'year'].map((k) => (
            <Pressable key={k} onPress={() => { tapSelection(); setPeriod(k); }} accessibilityRole="tab" accessibilityState={{ selected: period === k }}>
              <View style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: period === k ? '#FFFFFF' : 'transparent' }}>
                <Text style={{ color: period === k ? '#000000' : '#A3A3A3', fontSize: 13.5, fontWeight: '700' }}>{g(lang, k)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <Plan lang={lang} vip badge={g(lang, 'pop')} name={w(lang, 'basic')} tag={w(lang, 'basicTag')}
          price={yearly ? pr.basic_year || 990 : pr.basic || 129} cur={pr.currency} period={period}
          sub={g(lang, yearly ? 'billedY' : 'billedM')}
          items={[[GT_ACCESS[lang] || GT_ACCESS.en], [g(lang, 'p1')], [g(lang, 'p2')], [g(lang, 'p3')], [g(lang, 'p4')], [g(lang, 'p5')]]}
          cta={g(lang, 'become')} under={g(lang, 'guar')} busy={busy === 'basic'} onPress={() => buy('basic', period)} current={tier === 'BASIC'} />
        <Plan lang={lang} name={w(lang, 'vip')} tag={w(lang, 'vipTag')}
          price={yearly ? pr.vip || 1300 : pr.vip_month || 299} cur={pr.currency} period={period}
          sub={g(lang, yearly ? 'billedY' : 'billedM')}
          items={[[g(lang, 'b1')], [g(lang, 'b2')], [g(lang, 'b3')], [g(lang, 'b4')]]}
          cta={w(lang, 'becomeVip')} busy={busy === 'vip'} onPress={() => buy('vip', period)} current={tier === 'VIP'} />
        {note ? <Text style={{ color: '#FFF', fontSize: 14.5, textAlign: 'center', marginTop: 18 }}>{note}</Text> : null}
        <Promo lang={lang} />
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
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13.5 }}>{g(lang, 'explore')}</Text>
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
        backgroundColor: Platform.OS !== 'web' ? '#000000' : 'rgba(0,0,0,0.96)' }, blur]} accessibilityViewIsModal>
        {page}
      </View>
    );
  }
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>{page}</View>
    </Modal>
  );
};

/* a Moments+ member reached for messages, a lounge or a full profile: one sentence, one button */
export const VipSheet = ({ m, onClose }) => {
  useSheetBack(onClose);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const { busy, note, buy } = useBuy(lang, m);
  const pr = (m && m.prices) || { vip: 1300, vip_month: 299, vip_period: 'year', currency: 'EGP' };
  // monthly or yearly, as on the pricing page (Ayser: "مش فيه أوبشن الشهر")
  const [period, setPeriod] = useState('month');
  const price = period === 'year' ? pr.vip || 1300 : pr.vip_month || 299;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,13,20,0.4)' }} onPress={onClose} accessibilityLabel={w(lang, 'notNow')} />
      <View style={{ backgroundColor: '#0A0A0A', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: '#262626', padding: 24, paddingBottom: insets.bottom + 24 }}>
        <View style={{ alignItems: 'center', marginTop: -8, marginBottom: 10 }}><SheetHandle onClose={onClose} /></View>
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 1.6 }}>{lang === 'ar' ? 'مومنتس بلاك' : 'MOMENTS BLACK'}</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.8, lineHeight: lang === 'ar' ? 40 : 33, marginTop: 8 }}>{w(lang, 'vipTitle')}</Text>
        <Text style={{ color: '#A3A3A3', fontSize: 16, marginTop: 6 }}>{g(lang, 'b1')}</Text>
        <View style={{ marginTop: 10 }}>
          {/* what Black really adds today — the same lines as the pricing page */}
          {['b2', 'b3', 'b4'].map((k) => <Check key={k} label={g(lang, k)} ink="#FFFFFF" mark="#FFFFFF" />)}
        </View>
        <View style={{ flexDirection: 'row', alignSelf: 'flex-start', marginTop: 18, borderRadius: 999, borderWidth: 1, borderColor: '#262626', padding: 3 }} accessibilityRole="tablist">
          {['month', 'year'].map((k) => (
            <Pressable key={k} onPress={() => { tapSelection(); setPeriod(k); }} accessibilityRole="tab" accessibilityState={{ selected: period === k }}>
              <View style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: period === k ? '#FFFFFF' : 'transparent' }}>
                <Text style={{ color: period === k ? '#000000' : '#A3A3A3', fontSize: 13, fontWeight: '700' }}>{g(lang, k)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14 }}>
          <Text style={[{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -0.6 }, NUM]}>{money(price, pr.currency, lang)}</Text>
          <Text style={{ color: '#A3A3A3', fontSize: 14, marginStart: 6 }}>{per(lang, period, pr.currency)}</Text>
        </View>
        <Pressable onPress={() => buy('vip', period)} disabled={!!busy} accessibilityRole="button" style={{ marginTop: 18 }}>
          <View style={{ borderRadius: 999, paddingVertical: 15, alignItems: 'center', backgroundColor: '#FFFFFF' }}>
            {busy ? <ActivityIndicator color="#000000" /> : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '600' }}>{w(lang, 'becomeVip')}</Text>}
          </View>
        </Pressable>
        {note ? <Text style={{ color: '#A3A3A3', fontSize: 14, textAlign: 'center', marginTop: 12 }}>{note}</Text> : null}
        <Promo lang={lang} />
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={10} style={{ alignSelf: 'center', marginTop: 14 }}>
          <Text style={{ color: '#737373', fontSize: 14 }}>{w(lang, 'notNow')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
};

/* ─── WELCOME TO THE Black CLUB ────────────────────────────────────────
   Ayser: the moment somebody comes back from paying for Black, once. The
   app has just become theirs; this turns that into a first evening out:
   30% off a first Level 1 workshop, for 24 hours. Warm canvas, one glass
   card, the clock in figures, one button that breathes, and a quiet way
   out. The offer, its clock and the discount are the server's — this
   only shows them, and closing it closes it for good. */
const OTO = {
  en: ['Welcome to the Black Club', 'Your digital access is unlocked. Now, let’s get you offline.', 'A welcome gift', '30% OFF', 'your first Level 1 Global Track Workshop', 'Offer ends in', 'Claim 30% Off & Book Level 1', 'No thanks, I’ll explore the app first.', 'Only for new Black members, once.'],
  ar: ['أهلًا بيك\nفي مومنتس بلاك', 'التطبيق كله بقى مفتوح ليك. يلا نخرج بقى من الشاشة.', 'هدية ترحيب', 'خصم ٣٠٪', 'على أول ورشة من المستوى الأول', 'العرض بيخلص بعد', 'خد خصم ٣٠٪ واحجز المستوى الأول', 'لأ شكرًا، هتفرّج على التطبيق الأول.', 'لأعضاء Black الجداد بس، ومرة واحدة.'],
  cs: ['Vítej ve Black klubu', 'Digitální přístup máš odemčený. Teď tě dostaneme ven.', 'Uvítací dárek', 'SLEVA 30 %', 'na tvůj první workshop Global Track, Level 1', 'Nabídka končí za', 'Získat 30 % a rezervovat Level 1', 'Ne, díky, nejdřív si projdu aplikaci.', 'Jen pro nové členy Black, jednou.'],
  es: ['Bienvenido al Black Club', 'Tu acceso digital está desbloqueado. Ahora, salgamos de la pantalla.', 'Un regalo de bienvenida', '30% DE DESCUENTO', 'en tu primer taller Global Track de Nivel 1', 'La oferta termina en', 'Obtén el 30% y reserva el Nivel 1', 'No, gracias, primero exploraré la app.', 'Solo para nuevos miembros Black, una vez.'],
  et: ['Tere tulemast Black-klubisse', 'Digitaalne ligipääs on avatud. Nüüd viime su päriselu juurde.', 'Tervituskingitus', '30% SOODSAMALT', 'sinu esimene Global Tracki 1. taseme töötuba', 'Pakkumine lõpeb', 'Võta 30% ja broneeri 1. tase', 'Ei, aitäh, uurin enne äppi.', 'Ainult uutele Black-liikmetele, üks kord.'],
  fr: ['Bienvenue au Black Club', 'Ton accès numérique est débloqué. Maintenant, sortons de l’écran.', 'Un cadeau de bienvenue', '-30 %', 'sur ton premier atelier Global Track de niveau 1', 'L’offre se termine dans', 'Profiter des -30 % et réserver le niveau 1', 'Non merci, je vais d’abord explorer l’app.', 'Réservé aux nouveaux membres Black, une seule fois.'],
  hi: ['Black क्लब में स्वागत है', 'आपका डिजिटल एक्सेस खुल गया है। अब चलिए आपको ऑफ़लाइन ले चलें।', 'स्वागत तोहफ़ा', '30% छूट', 'आपकी पहली Level 1 Global Track वर्कशॉप पर', 'ऑफ़र ख़त्म होगा', '30% छूट लें और Level 1 बुक करें', 'नहीं, धन्यवाद, पहले ऐप देखूँगा।', 'सिर्फ़ नए Black मेंबर्स के लिए, एक बार।'],
  it: ['Benvenuto nel Black Club', 'Il tuo accesso digitale è sbloccato. Ora usciamo dallo schermo.', 'Un regalo di benvenuto', '30% DI SCONTO', 'sul tuo primo workshop Global Track di Livello 1', 'L’offerta scade tra', 'Prendi il 30% e prenota il Livello 1', 'No grazie, prima esploro l’app.', 'Solo per i nuovi membri Black, una volta.'],
  ja: ['Black クラブへようこそ', 'デジタルのアクセスは解放されました。次はオフラインへ。', 'ウェルカムギフト', '30% OFF', '初めての Global Track レベル1 ワークショップ', '終了まで', '30%オフでレベル1を予約', 'いいえ、まずアプリを見てみます。', '新しい Black メンバー限定・一度だけ。'],
  ko: ['Black 클럽에 오신 걸 환영해요', '디지털 접근이 열렸어요. 이제 오프라인으로 나가 볼까요.', '웰컴 선물', '30% 할인', '첫 Global Track 레벨 1 워크숍', '남은 시간', '30% 할인받고 레벨 1 예약하기', '괜찮아요, 앱부터 둘러볼게요.', '새 Black 회원만, 한 번.'],
  nl: ['Welkom bij de Black Club', 'Je digitale toegang is ontgrendeld. Nu gaan we offline.', 'Een welkomstcadeau', '30% KORTING', 'op je eerste Global Track-workshop van Level 1', 'Aanbod eindigt over', 'Pak 30% korting en boek Level 1', 'Nee, bedankt, ik verken eerst de app.', 'Alleen voor nieuwe Black-leden, één keer.'],
  pt: ['Bem-vindo ao Black Club', 'O teu acesso digital está desbloqueado. Agora, vamos sair do ecrã.', 'Um presente de boas-vindas', '30% DE DESCONTO', 'no teu primeiro workshop Global Track de Nível 1', 'A oferta termina em', 'Aproveita 30% e reserva o Nível 1', 'Não, obrigado, primeiro vou explorar a app.', 'Só para novos membros Black, uma vez.'],
  ro: ['Bun venit în Black Club', 'Accesul digital e deblocat. Acum, hai să ieșim din ecran.', 'Un cadou de bun venit', '30% REDUCERE', 'la primul tău atelier Global Track de Nivel 1', 'Oferta se termină în', 'Ia 30% reducere și rezervă Nivelul 1', 'Nu, mulțumesc, explorez mai întâi aplicația.', 'Doar pentru membrii Black noi, o singură dată.'],
  ru: ['Добро пожаловать в Black Club', 'Цифровой доступ открыт. Теперь — в офлайн.', 'Подарок в честь знакомства', 'СКИДКА 30%', 'на твой первый воркшоп Global Track уровня 1', 'Предложение закончится через', 'Взять 30% и записаться на уровень 1', 'Нет, спасибо, сначала посмотрю приложение.', 'Только для новых участников Black, один раз.'],
  tr: ['Black Club’a hoş geldin', 'Dijital erişimin açıldı. Şimdi seni ekrandan çıkaralım.', 'Hoş geldin hediyesi', '%30 İNDİRİM', 'ilk Global Track Seviye 1 atölyende', 'Teklifin bitmesine', '%30 indirimi al ve Seviye 1’i ayırt', 'Hayır, teşekkürler, önce uygulamayı keşfedeceğim.', 'Yalnızca yeni Black üyelere, bir kez.'],
  uk: ['Ласкаво просимо до Black Club', 'Цифровий доступ відкрито. Тепер — в офлайн.', 'Подарунок на знайомство', 'ЗНИЖКА 30%', 'на твій перший воркшоп Global Track рівня 1', 'Пропозиція закінчиться через', 'Взяти 30% і записатися на рівень 1', 'Ні, дякую, спершу подивлюся застосунок.', 'Лише для нових учасників Black, один раз.'],
  zh: ['欢迎加入 Black 俱乐部', '你的线上权限已解锁。现在，让我们走到线下。', '欢迎礼物', '7 折', '你的第一场 Global Track 一级工作坊', '优惠剩余', '领取 7 折并预订一级', '不用了，我先逛逛应用。', '仅限新 Black 会员，仅此一次。'],
};
const OK = ['title', 'hook', 'gift', 'off', 'first', 'ends', 'cta', 'no', 'once'];
const ow = (lang, k) => { const i = OK.indexOf(k); return (OTO[lang] || OTO.en)[i] || OTO.en[i] || ''; };

const two = (n) => (n < 10 ? '0' : '') + n;
const AR_DIGITS = (t) => t.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
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
  const { isDark, black } = useTheme();
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
    ? { backgroundImage: 'radial-gradient(90% 55% at 50% 0%, ' + (black ? 'rgba(255,255,255,0.10)' : isDark ? 'rgba(124,58,237,0.32)' : 'rgba(124,58,237,0.16)') + ', transparent 70%)' }
    : null;
  const glass = Platform.OS === 'web'
    ? { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.62)', backdropFilter: 'blur(24px) saturate(1.4)', WebkitBackdropFilter: 'blur(24px) saturate(1.4)' }
    : { backgroundColor: C.glass };

  return (
    <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9100, backgroundColor: C.bg }, glow]} accessibilityViewIsModal>
      {FLECKS.map((f, i) => <Fleck key={i} f={f} />)}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 440 }}>
          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : 2.4, textAlign: 'center' }}>{lang === 'ar' ? 'مومنتس بلاك' : 'MOMENTS BLACK'}</Text>
          <Text style={{ color: C.text, fontSize: lang === 'ar' ? 32 : 34, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -1.1, lineHeight: lang === 'ar' ? 50 : 40, marginTop: 14, textAlign: 'center' }}>{ow(lang, 'title')}</Text>
          <Text style={{ color: C.dim, fontSize: 17, lineHeight: 25, marginTop: 12, textAlign: 'center' }}>{ow(lang, 'hook')}</Text>

          {/* the offer: one pane of glass */}
          <View style={[{ marginTop: 32, borderRadius: 28, padding: 26, borderWidth: 1, borderColor: black ? '#262626' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(124,58,237,0.16)' }, glass]}>
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textAlign: 'center' }}>{ow(lang, 'gift').toUpperCase()}</Text>
            <Text style={[{ color: C.purple, fontSize: lang === 'ar' ? 46 : 52, lineHeight: lang === 'ar' ? 92 : 64, fontWeight: '800', letterSpacing: lang === 'ar' ? 0 : -1.8, textAlign: 'center', marginTop: 4 }, NUM]}>{ow(lang, 'off')}</Text>
            <Text style={{ color: C.text, fontSize: 16.5, lineHeight: 23, textAlign: 'center', marginTop: 2 }}>{ow(lang, 'first')}</Text>
            {ws ? (
              <View style={{ marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '600', textAlign: 'center' }} numberOfLines={2}>{wsTitle}</Text>
                {ws.price != null ? (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                    <Text style={[{ color: C.faint, fontSize: 15, textDecorationLine: 'line-through' }, NUM]}>{money(ws.price, ws.currency, lang)}</Text>
                    <View style={{ width: 12 }} />
                    <Text style={[{ color: C.text, fontSize: 22, fontWeight: '700' }, NUM]}>{money(ws.price_after, ws.currency, lang)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginTop: 20 }}>{ow(lang, 'ends')}</Text>
            <Text style={[{ color: C.text, fontSize: 30, fontWeight: '600', letterSpacing: 1, textAlign: 'center', marginTop: 4, writingDirection: 'ltr' }, NUM]} accessibilityLiveRegion="polite">{lang === 'ar' ? AR_DIGITS(hms(left)) : hms(left)}</Text>
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
