import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, Image, Animated, Easing, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLang } from '../context/LanguageContext';
import { publicMedia } from '../lib/publicMedia';
import { goToTab } from '../lib/mapBus';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { markTourSeen } from './GestureTour';

/* ─── THE FIRST TIME INSIDE ───────────────────────────────────────────
   Ayser: "اعمل إن أول ما حد يفتح الأبلكيشن أول مرة، الأبلكيشن يوريه
   ويشرحله بشكل شيّق". Six cards, told like stories: a bar at the top
   fills while each one plays, a tap on the right goes on, on the left
   goes back, Skip is always there. Each card is a real photo drifting
   closer, one big line, one small one, and the little thing you will
   actually tap for it — "I'm going", a stamp, a streak — popping in.
   It ends on the one thing worth doing first: finding a plan.
   Seen once (it replaces the gesture cards, which stay in Settings).
   Its words live here so they load only with it. */

export const FIRST_TOUR = 'mm_first_tour_v1';
export function firstTourSeen() { try { return localStorage.getItem(FIRST_TOUR) === '1'; } catch (e) { return true; } }
const markSeen = () => { try { localStorage.setItem(FIRST_TOUR, '1'); } catch (e) {} markTourSeen(); };

const L = {
  en: ['Welcome to Moments', 'Less scrolling. More evenings with people.', 'Plans near you', 'Real people, real places, this week. Tap “I’m going” — that’s it.', 'Go out now', 'Going for a walk or a coffee? Put it on the map; anyone nearby can join.', 'Groups that really meet', 'Plan Roulette, Bingo, and a twin group in another country.', 'Places that welcome you', 'Cafés and stays on Moments. Check in at the counter, collect stamps.', 'Your day, calmer', 'Habits with friends, Focus, and a feed that closes after 10 minutes.', 'Skip', 'Find my first plan', 'Look around first', "✓ I'm going", '📍 On the map · in 20 min', '🎡 3 of 3 are in', '⭐⭐⭐ 3 of 5 stamps', '🔥 4 days in a row'],
  ar: ['أهلاً بيك في Moments', 'سكرول أقل. سهرات أكتر مع ناس.', 'خطط قريبة منك', 'ناس حقيقيين، أماكن حقيقية، الأسبوع ده. دوس "رايح" — وبس كده.', 'اخرج دلوقتي', 'نازل تتمشى أو تشرب قهوة؟ حطها على الخريطة؛ أي حد قريب يقدر ييجي.', 'جروبات بتتقابل بجد', 'عجلة الخروجات، البينجو، وجروب توأم في بلد تانية.', 'أماكن بترحّب بيك', 'كافيهات وأماكن إقامة على Moments. اعمل check-in واجمع أختام.', 'يومك أهدى', 'عادات مع صحابك، Focus، وفيد بيقفل بعد 10 دقايق.', 'تخطي', 'لاقيلي أول خطة', 'هتفرج الأول', '✓ رايح', '📍 على الخريطة · بعد 20 دقيقة', '🎡 3 من 3 معاكم', '⭐⭐⭐ 3 من 5 أختام', '🔥 4 أيام ورا بعض'],
  cs: ['Vítej v Moments', 'Méně scrollování. Víc večerů s lidmi.', 'Plány kolem tebe', 'Skuteční lidé, skutečná místa, tento týden. Klepni „Jdu“ — a je to.', 'Vyraž hned', 'Jdeš na procházku nebo kafe? Dej to na mapu; kdokoli poblíž se přidá.', 'Skupiny, které se scházejí', 'Ruleta plánů, bingo a dvojčecí skupina v jiné zemi.', 'Místa, která tě vítají', 'Kavárny a ubytování na Moments. Odbav se u pultu, sbírej razítka.', 'Klidnější den', 'Návyky s přáteli, Focus a feed, který se po 10 minutách zavře.', 'Přeskočit', 'Najdi mi první plán', 'Nejdřív se rozhlédnu', '✓ Jdu', '📍 Na mapě · za 20 min', '🎡 3 ze 3 jdou', '⭐⭐⭐ 3 z 5 razítek', '🔥 4 dny v řadě'],
  es: ['Bienvenido a Moments', 'Menos scroll. Más tardes con gente.', 'Planes cerca de ti', 'Gente real, sitios reales, esta semana. Toca «Voy» — y listo.', 'Sal ahora', '¿Vas a caminar o a por un café? Ponlo en el mapa; quien esté cerca puede unirse.', 'Grupos que se ven de verdad', 'Ruleta de planes, bingo y un grupo gemelo en otro país.', 'Sitios que te reciben', 'Cafés y alojamientos en Moments. Haz check-in y junta sellos.', 'Tu día, con calma', 'Hábitos con amigos, Focus y un feed que se cierra a los 10 minutos.', 'Saltar', 'Encuéntrame un plan', 'Primero miro', '✓ Voy', '📍 En el mapa · en 20 min', '🎡 3 de 3 se apuntan', '⭐⭐⭐ 3 de 5 sellos', '🔥 4 días seguidos'],
  et: ['Tere tulemast Momentsisse', 'Vähem kerimist. Rohkem õhtuid inimestega.', 'Plaanid sinu lähedal', 'Päris inimesed, päris kohad, sel nädalal. Vajuta „Tulen“ — ja ongi.', 'Mine kohe välja', 'Lähed jalutama või kohvile? Pane see kaardile; igaüks lähedal saab liituda.', 'Grupid, mis päriselt kohtuvad', 'Plaaniruletti, bingo ja kaksikgrupp teises riigis.', 'Kohad, kus sind oodatakse', 'Kohvikud ja majutus Momentsis. Registreeru letis, kogu templeid.', 'Rahulikum päev', 'Harjumused sõpradega, Focus ja voog, mis sulgub 10 minuti pärast.', 'Jäta vahele', 'Leia mulle esimene plaan', 'Vaatan enne ringi', '✓ Tulen', '📍 Kaardil · 20 min pärast', '🎡 3/3 on kaasas', '⭐⭐⭐ 3/5 templit', '🔥 4 päeva järjest'],
  fr: ['Bienvenue sur Moments', 'Moins de scroll. Plus de soirées avec des gens.', 'Des plans près de toi', 'De vraies personnes, de vrais lieux, cette semaine. Touche « J’y vais » — c’est tout.', 'Sors maintenant', 'Une balade ou un café ? Mets-le sur la carte ; quiconque à côté peut venir.', 'Des groupes qui se voient vraiment', 'Roulette de plans, bingo et un groupe jumeau dans un autre pays.', 'Des lieux qui t’accueillent', 'Cafés et logements sur Moments. Check-in au comptoir, collectionne des tampons.', 'Ta journée, plus calme', 'Habitudes entre amis, Focus et un fil qui se ferme après 10 minutes.', 'Passer', 'Trouve-moi un premier plan', 'Je regarde d’abord', '✓ J’y vais', '📍 Sur la carte · dans 20 min', '🎡 3 sur 3 partants', '⭐⭐⭐ 3 tampons sur 5', '🔥 4 jours d’affilée'],
  hi: ['Moments में स्वागत है', 'कम स्क्रॉल। लोगों के साथ ज़्यादा शामें।', 'आपके पास के प्लान', 'असली लोग, असली जगहें, इस हफ़्ते। “मैं आ रहा हूँ” दबाओ — बस।', 'अभी बाहर चलो', 'टहलने या कॉफ़ी पर जा रहे हो? मैप पर डालो; पास का कोई भी जुड़ सकता है।', 'ग्रुप जो सच में मिलते हैं', 'प्लान रूलेट, बिंगो, और दूसरे देश में जुड़वां ग्रुप।', 'जगहें जो स्वागत करती हैं', 'Moments पर कैफ़े और ठहरने की जगहें। काउंटर पर चेक-इन, स्टैम्प जमा करो।', 'आपका दिन, शांत', 'दोस्तों के साथ आदतें, Focus, और फ़ीड जो 10 मिनट बाद बंद होती है।', 'छोड़ो', 'मेरा पहला प्लान ढूँढो', 'पहले देख लूँ', '✓ मैं आ रहा हूँ', '📍 मैप पर · 20 मिनट में', '🎡 3 में से 3 तैयार', '⭐⭐⭐ 5 में से 3 स्टैम्प', '🔥 लगातार 4 दिन'],
  it: ['Benvenuto su Moments', 'Meno scroll. Più serate con le persone.', 'Piani vicino a te', 'Persone vere, posti veri, questa settimana. Tocca «Ci vado» — fatto.', 'Esci adesso', 'Una passeggiata o un caffè? Mettilo sulla mappa; chiunque vicino può unirsi.', 'Gruppi che si vedono davvero', 'Roulette dei piani, bingo e un gruppo gemello in un altro paese.', 'Posti che ti accolgono', 'Caffè e alloggi su Moments. Fai check-in al banco, raccogli timbri.', 'La tua giornata, più calma', 'Abitudini con gli amici, Focus e un feed che si chiude dopo 10 minuti.', 'Salta', 'Trovami un primo piano', 'Prima mi guardo intorno', '✓ Ci vado', '📍 Sulla mappa · tra 20 min', '🎡 3 su 3 ci stanno', '⭐⭐⭐ 3 timbri su 5', '🔥 4 giorni di fila'],
  ja: ['Momentsへようこそ', 'スクロールは少なく。人と過ごす夜を多く。', '近くのプラン', '本物の人、本物の場所、今週。「行く」をタップするだけ。', '今すぐ出かけよう', '散歩やコーヒー？地図にのせれば、近くの誰でも参加できます。', '本当に集まるグループ', 'プランルーレット、ビンゴ、別の国のツイングループ。', '迎えてくれるお店', 'Momentsのカフェと宿。カウンターでチェックイン、スタンプを集めよう。', '穏やかな一日', '友だちと習慣、Focus、10分で閉じるフィード。', 'スキップ', '最初のプランを探す', 'まず見てみる', '✓ 行く', '📍 地図に · 20分後', '🎡 3人中3人参加', '⭐⭐⭐ スタンプ 3/5', '🔥 4日連続'],
  ko: ['Moments에 오신 걸 환영해요', '스크롤은 덜, 사람들과의 저녁은 더.', '가까운 플랜', '진짜 사람, 진짜 장소, 이번 주. “갈래요”만 누르면 끝.', '지금 나가기', '산책이나 커피? 지도에 올리면 근처 누구나 함께할 수 있어요.', '진짜 만나는 그룹', '플랜 룰렛, 빙고, 다른 나라의 쌍둥이 그룹.', '반겨주는 장소', 'Moments의 카페와 숙소. 카운터에서 체크인하고 도장을 모아요.', '더 차분한 하루', '친구와 습관, Focus, 10분 뒤 닫히는 피드.', '건너뛰기', '첫 플랜 찾기', '먼저 둘러볼게요', '✓ 갈래요', '📍 지도에 · 20분 뒤', '🎡 3명 중 3명 참여', '⭐⭐⭐ 도장 3/5', '🔥 4일 연속'],
  nl: ['Welkom bij Moments', 'Minder scrollen. Meer avonden met mensen.', 'Plannen bij jou in de buurt', 'Echte mensen, echte plekken, deze week. Tik op „Ik ga” — klaar.', 'Ga nu naar buiten', 'Wandelen of koffie? Zet het op de kaart; iedereen in de buurt kan mee.', 'Groepen die echt afspreken', 'Planroulette, bingo en een tweelinggroep in een ander land.', 'Plekken die je verwelkomen', 'Cafés en verblijven op Moments. Check in aan de bar, spaar stempels.', 'Je dag, rustiger', 'Gewoontes met vrienden, Focus en een feed die na 10 minuten sluit.', 'Overslaan', 'Vind mijn eerste plan', 'Eerst rondkijken', '✓ Ik ga', '📍 Op de kaart · over 20 min', '🎡 3 van 3 doen mee', '⭐⭐⭐ 3 van 5 stempels', '🔥 4 dagen op rij'],
  pt: ['Bem-vindo ao Moments', 'Menos scroll. Mais noites com pessoas.', 'Planos perto de ti', 'Pessoas reais, sítios reais, esta semana. Toca em «Vou» — e pronto.', 'Sai agora', 'Vais passear ou tomar um café? Põe no mapa; quem estiver perto pode juntar-se.', 'Grupos que se encontram mesmo', 'Roleta de planos, bingo e um grupo gémeo noutro país.', 'Sítios que te recebem', 'Cafés e alojamentos no Moments. Faz check-in no balcão, junta carimbos.', 'O teu dia, mais calmo', 'Hábitos com amigos, Focus e um feed que fecha ao fim de 10 minutos.', 'Saltar', 'Encontra o meu primeiro plano', 'Primeiro vou ver', '✓ Vou', '📍 No mapa · daqui a 20 min', '🎡 3 de 3 alinham', '⭐⭐⭐ 3 de 5 carimbos', '🔥 4 dias seguidos'],
  ro: ['Bine ai venit pe Moments', 'Mai puțin scroll. Mai multe seri cu oameni.', 'Planuri lângă tine', 'Oameni reali, locuri reale, săptămâna asta. Apasă „Vin” — atât.', 'Ieși acum', 'Mergi la o plimbare sau la o cafea? Pune-o pe hartă; oricine din apropiere poate veni.', 'Grupuri care chiar se văd', 'Ruleta planurilor, bingo și un grup geamăn în altă țară.', 'Locuri care te primesc', 'Cafenele și cazări pe Moments. Check-in la tejghea, strânge ștampile.', 'Ziua ta, mai liniștită', 'Obiceiuri cu prietenii, Focus și un feed care se închide după 10 minute.', 'Sari', 'Găsește-mi primul plan', 'Mă uit întâi', '✓ Vin', '📍 Pe hartă · în 20 min', '🎡 3 din 3 vin', '⭐⭐⭐ 3 din 5 ștampile', '🔥 4 zile la rând'],
  ru: ['Добро пожаловать в Moments', 'Меньше скролла. Больше вечеров с людьми.', 'Планы рядом', 'Настоящие люди, настоящие места, на этой неделе. Нажми «Иду» — и всё.', 'Выйти сейчас', 'Идёшь гулять или на кофе? Отметь на карте — любой рядом может присоединиться.', 'Группы, которые встречаются', 'Рулетка планов, бинго и группа-близнец в другой стране.', 'Места, где вам рады', 'Кафе и жильё на Moments. Отмечайся у стойки, собирай штампы.', 'Спокойный день', 'Привычки с друзьями, Focus и лента, которая закрывается через 10 минут.', 'Пропустить', 'Найди мне первый план', 'Сначала осмотрюсь', '✓ Иду', '📍 На карте · через 20 мин', '🎡 3 из 3 идут', '⭐⭐⭐ 3 из 5 штампов', '🔥 4 дня подряд'],
  tr: ['Moments’a hoş geldin', 'Daha az kaydırma. İnsanlarla daha çok akşam.', 'Yakınındaki planlar', 'Gerçek insanlar, gerçek yerler, bu hafta. “Gidiyorum”a dokun — bu kadar.', 'Şimdi çık', 'Yürüyüşe ya da kahveye mi? Haritaya koy; yakındaki herkes katılabilir.', 'Gerçekten buluşan gruplar', 'Plan çarkı, bingo ve başka bir ülkede ikiz grup.', 'Seni ağırlayan yerler', 'Moments’taki kafeler ve konaklamalar. Tezgâhta check-in yap, damga topla.', 'Daha sakin bir gün', 'Arkadaşlarla alışkanlıklar, Focus ve 10 dakikada kapanan akış.', 'Geç', 'İlk planımı bul', 'Önce bir bakayım', '✓ Gidiyorum', '📍 Haritada · 20 dk sonra', '🎡 3 kişiden 3’ü var', '⭐⭐⭐ 5 damgadan 3’ü', '🔥 4 gün üst üste'],
  uk: ['Ласкаво просимо до Moments', 'Менше гортання. Більше вечорів із людьми.', 'Плани поруч', 'Справжні люди, справжні місця, цього тижня. Натисни «Я йду» — і все.', 'Вийди зараз', 'Ідеш на прогулянку чи каву? Додай на мапу; будь-хто поруч може приєднатися.', 'Групи, які справді зустрічаються', 'Рулетка планів, бінго й група-близнюк в іншій країні.', 'Місця, які тобі раді', 'Кафе й житло в Moments. Відмічайся біля каси, збирай штампи.', 'Твій день, спокійніше', 'Звички з друзями, Focus і стрічка, що закривається через 10 хвилин.', 'Пропустити', 'Знайди мені перший план', 'Спершу роздивлюся', '✓ Я йду', '📍 На мапі · за 20 хв', '🎡 3 з 3 з нами', '⭐⭐⭐ 3 з 5 штампів', '🔥 4 дні поспіль'],
  zh: ['欢迎来到 Moments', '少刷手机，多和人一起过晚上。', '你附近的计划', '真实的人，真实的地方，就在本周。点“我去”——就这么简单。', '现在出门', '去散步或喝咖啡？放到地图上，附近的人都能加入。', '真的会见面的群组', '计划转盘、宾果，还有另一个国家的姐妹群。', '欢迎你的地方', 'Moments 上的咖啡馆和住宿。在柜台签到，收集印章。', '更从容的一天', '和朋友一起养成习惯、Focus，还有10分钟就关闭的动态。', '跳过', '帮我找第一个计划', '先随便看看', '✓ 我去', '📍 在地图上 · 20分钟后', '🎡 3人中3人参加', '⭐⭐⭐ 5个印章集了3个', '🔥 连续4天'],
};

const CARDS = [
  { photo: 'intro-people.jpg', e: '👋', chip: null },
  { photo: 'act-coffee-1.jpg', e: '📍', chip: 15 },
  { photo: 'act-walk-1.jpg', e: '🚶', chip: 16 },
  { photo: 'act-talk-3.jpg', e: '🎲', chip: 17 },
  { photo: 'act-coffee-2.jpg', e: '☕', chip: 18 },
  { photo: 'act-read-1.jpg', e: '🌿', chip: 19 },
];
const DUR = 5600;
const still = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const FirstTour = ({ onClose }) => {
  const { lang, rtl } = useLang();
  const w = L[lang] || L.en;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const bar = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const last = CARDS.length - 1;

  const close = (toPlans) => { markSeen(); if (toPlans) { tapSuccess(); goToTab('TOGETHER'); } onClose(); };
  useSheetBack(() => close(false));

  useEffect(() => {
    bar.setValue(0); zoom.setValue(0); pop.setValue(0);
    const quiet = still();
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, delay: 350, useNativeDriver: Platform.OS !== 'web' }).start();
    if (!quiet) Animated.timing(zoom, { toValue: 1, duration: DUR + 1200, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
    // the last card waits for a choice; the others move on by themselves
    if (i >= last) { bar.setValue(1); return undefined; }
    const a = Animated.timing(bar, { toValue: 1, duration: DUR, easing: Easing.linear, useNativeDriver: false });
    a.start(({ finished }) => { if (finished) setI((k) => Math.min(last, k + 1)); });
    return () => a.stop();
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d) => { tapLight(); setI((k) => Math.max(0, Math.min(last, k + d))); };
  const c = CARDS[i];
  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const popS = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Modal visible animationType="fade" onRequestClose={() => close(false)}>
      <View style={{ flex: 1, backgroundColor: '#111' }}>
        <Animated.View key={c.photo} style={{ position: 'absolute', top: 0, left: 0, width, height, transform: [{ scale }] }}>
          <Image source={{ uri: publicMedia(c.photo) }} resizeMode="cover" style={{ width, height }} accessibilityIgnoresInvertColors />
        </Animated.View>
        <LinearGradient colors={['rgba(17,17,17,0.65)', 'rgba(17,17,17,0)', 'rgba(17,17,17,0.45)', 'rgba(17,17,17,0.96)']}
          locations={[0, 0.25, 0.5, 0.82]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

        {/* tap the right side to go on, the left to go back */}
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
          <Pressable style={{ flex: 1, outlineStyle: 'none' }} onPress={() => go(-1)} accessibilityRole="button" accessibilityLabel="Back" />
          <Pressable style={{ flex: 2, outlineStyle: 'none' }} onPress={() => (i < last ? go(1) : null)} accessibilityRole="button" accessibilityLabel="Next" />
        </View>

        {/* the story bars */}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12 }}>
          <View style={{ flexDirection: 'row' }}>
            {CARDS.map((_, k) => (
              <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', marginHorizontal: 2, overflow: 'hidden' }}>
                <Animated.View style={{ height: 3, backgroundColor: '#FFF', width: k < i ? '100%' : k > i ? '0%' : bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
              </View>
            ))}
          </View>
          {i < last ? (
            <Pressable onPress={() => { tapLight(); close(false); }} accessibilityRole="button" hitSlop={12} style={{ alignSelf: rtl ? 'flex-start' : 'flex-end', marginTop: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '800' }}>{w[12]}</Text>
            </Pressable>
          ) : null}
        </View>

        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: insets.bottom + 34 }}>
          <Animated.View style={{ transform: [{ scale: popS }], opacity: pop, alignSelf: 'flex-start', marginBottom: 14 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 34 }}>{c.e}</Text>
            </View>
          </Animated.View>
          <Text style={{ color: '#FFF', fontSize: Math.min(44, width * 0.11), fontWeight: '900', letterSpacing: -1, lineHeight: Math.min(44, width * 0.11) * 1.08 }}>{w[i * 2]}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 16.5, lineHeight: 24, marginTop: 10, maxWidth: 440 }}>{w[i * 2 + 1]}</Text>
          {/* the little thing you'll actually tap for it */}
          {c.chip ? (
            <Animated.View style={{ opacity: pop, transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }], alignSelf: 'flex-start', marginTop: 18 }}>
              <View style={{ borderRadius: 999, backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10 }}>
                <Text style={{ color: '#1A1A1A', fontSize: 14.5, fontWeight: '900' }}>{w[c.chip]}</Text>
              </View>
            </Animated.View>
          ) : null}
          {i === last ? (
            <View style={{ marginTop: 26 }}>
              <Pressable onPress={() => { tapMedium(); close(true); }} accessibilityRole="button">
                <View style={{ borderRadius: 999, backgroundColor: '#7C3AED', paddingVertical: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 16.5, fontWeight: '900' }}>{w[13]}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => { tapLight(); close(false); }} accessibilityRole="button" style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14.5, fontWeight: '800' }}>{w[14]}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};
