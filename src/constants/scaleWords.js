/* ─── MATCHING · CITY HUBS · CERTIFIED HOSTS, IN EVERY LANGUAGE ──────
   (RUN_ME.sql, "MOMENTS AT SCALE"). A missing line falls back to English. */
const K = ['match', 'official', 'near', 'cities', 'cities_s', 'tables_n', 'ice', 'ice_s', 'ice_more', 'host_t', 'host_s', 'host_go', 'host_prog',
  'goal', 'g_youth_exchange', 'g_digital_nomad', 'g_study_abroad', 'g_work_abroad', 'g_travel', 'global', 'in_now'];
const S = {
  en: ['Vibe Match', 'Official table', 'Near me', 'Cities', 'Moments lives in these cities. Pick one to see its tables.', '{n} upcoming', 'For this table', 'Written for who is here', 'Three more',
    'Certified Host', 'Your tables are Official Moments Tables: check-in QR and the card deck, ready from the first minute.', 'Host an official table', '{n}/5 stamps to become a Certified Host',
    'My Global Track goal', 'Youth exchange', 'Digital nomad', 'Study abroad', 'Work abroad', 'Travel', 'Global', 'in now from'],
  ar: ['توافق', 'ترابيزة رسمية', 'جنبي', 'المدن', 'Moments موجودة في المدن دي. اختار واحدة تشوف ترابيزاتها.', '{n} ترابيزات', 'للترابيزة دي', 'مكتوبة للي قاعدين', 'تلاتة كمان',
    'هوست معتمد', 'ترابيزاتك بقت رسمية: QR الحضور وكروت اللعب جاهزين من أول دقيقة.', 'اعمل ترابيزة رسمية', '{n}/٥ أختام عشان تبقى هوست معتمد',
    'هدفي في Global Track', 'تبادل شبابي', 'ديجيتال نوماد', 'دراسة بره', 'شغل بره', 'سفر', 'عالمية', 'دلوقتي من'],
  cs: ['Shoda', 'Oficiální stůl', 'Poblíž', 'Města', 'Moments žije v těchto městech. Vyber jedno a uvidíš jeho stoly.', '{n} stolů', 'Pro tento stůl', 'Napsáno pro ty, kdo tu jsou', 'Další tři',
    'Certifikovaný hostitel', 'Tvé stoly jsou oficiální: QR pro příchod a karty jsou připravené od první minuty.', 'Uspořádat oficiální stůl', '{n}/5 razítek do certifikovaného hostitele',
    'Můj cíl v Global Track', 'Výměna mládeže', 'Digitální nomád', 'Studium v zahraničí', 'Práce v zahraničí', 'Cestování', 'Globální', 'teď z'],
  es: ['Afinidad', 'Mesa oficial', 'Cerca de mí', 'Ciudades', 'Moments vive en estas ciudades. Elige una para ver sus mesas.', '{n} mesas', 'Para esta mesa', 'Escrito para quienes están aquí', 'Tres más',
    'Anfitrión certificado', 'Tus mesas son oficiales: el QR de llegada y las cartas, listos desde el primer minuto.', 'Organizar una mesa oficial', '{n}/5 sellos para ser anfitrión certificado',
    'Mi meta en Global Track', 'Intercambio juvenil', 'Nómada digital', 'Estudiar fuera', 'Trabajar fuera', 'Viajar', 'Global', 'ahora desde'],
  et: ['Sobivus', 'Ametlik laud', 'Minu lähedal', 'Linnad', 'Moments elab nendes linnades. Vali üks, et näha selle laudu.', '{n} lauda', 'Sellele lauale', 'Kirjutatud neile, kes siin on', 'Veel kolm',
    'Sertifitseeritud võõrustaja', 'Sinu lauad on ametlikud: saabumise QR ja kaardipakk on valmis esimesest minutist.', 'Korralda ametlik laud', '{n}/5 templit sertifitseeritud võõrustajaks',
    'Minu Global Tracki eesmärk', 'Noortevahetus', 'Diginomaad', 'Õpingud välismaal', 'Töö välismaal', 'Reisimine', 'Ülemaailmne', 'praegu riikidest'],
  fr: ['Affinité', 'Table officielle', 'Près de moi', 'Villes', 'Moments vit dans ces villes. Choisis-en une pour voir ses tables.', '{n} tables', 'Pour cette table', 'Écrit pour ceux qui sont là', 'Trois de plus',
    'Hôte certifié', 'Tes tables sont officielles : QR d’arrivée et cartes prêts dès la première minute.', 'Organiser une table officielle', '{n}/5 tampons pour devenir hôte certifié',
    'Mon objectif Global Track', 'Échange de jeunes', 'Nomade digital', 'Études à l’étranger', 'Travail à l’étranger', 'Voyage', 'Mondial', 'en ce moment depuis'],
  hi: ['मैच', 'ऑफ़िशियल टेबल', 'मेरे पास', 'शहर', 'Moments इन शहरों में है। एक चुनें और उसकी टेबल देखें।', '{n} टेबल', 'इस टेबल के लिए', 'यहाँ बैठे लोगों के लिए लिखा', 'तीन और',
    'सर्टिफ़ाइड होस्ट', 'आपकी टेबल ऑफ़िशियल हैं: चेक-इन QR और कार्ड पहले मिनट से तैयार।', 'ऑफ़िशियल टेबल होस्ट करें', 'सर्टिफ़ाइड होस्ट बनने के लिए {n}/5 स्टैम्प',
    'मेरा Global Track लक्ष्य', 'यूथ एक्सचेंज', 'डिजिटल नोमैड', 'विदेश में पढ़ाई', 'विदेश में काम', 'यात्रा', 'ग्लोबल', 'अभी यहाँ से'],
  it: ['Affinità', 'Tavolo ufficiale', 'Vicino a me', 'Città', 'Moments vive in queste città. Scegline una per vedere i suoi tavoli.', '{n} tavoli', 'Per questo tavolo', 'Scritto per chi è qui', 'Altre tre',
    'Host certificato', 'I tuoi tavoli sono ufficiali: QR di arrivo e carte pronti dal primo minuto.', 'Organizza un tavolo ufficiale', '{n}/5 timbri per diventare host certificato',
    'Il mio obiettivo Global Track', 'Scambio giovanile', 'Nomade digitale', 'Studio all’estero', 'Lavoro all’estero', 'Viaggio', 'Globale', 'ora da'],
  ja: ['相性', '公式テーブル', '近く', '都市', 'Moments はこれらの都市にあります。選ぶとテーブルが見られます。', 'テーブル {n}', 'このテーブルに', 'ここにいる人のために', 'あと3つ',
    '認定ホスト', 'あなたのテーブルは公式です。チェックイン QR とカードが最初から用意されます。', '公式テーブルを開く', '認定ホストまでスタンプ {n}/5',
    '私の Global Track の目標', 'ユース交流', 'デジタルノマド', '留学', '海外で働く', '旅行', 'グローバル', '今いる国'],
  ko: ['궁합', '공식 테이블', '내 주변', '도시', 'Moments는 이 도시들에 있어요. 하나를 골라 테이블을 보세요.', '테이블 {n}개', '이 테이블을 위해', '여기 있는 사람들을 위해', '세 개 더',
    '인증 호스트', '당신의 테이블은 공식이에요: 체크인 QR과 카드가 처음부터 준비돼요.', '공식 테이블 열기', '인증 호스트까지 스탬프 {n}/5',
    '나의 Global Track 목표', '청소년 교류', '디지털 노마드', '유학', '해외 취업', '여행', '글로벌', '지금 접속 국가'],
  nl: ['Match', 'Officiële tafel', 'Bij mij', 'Steden', 'Moments leeft in deze steden. Kies er een om de tafels te zien.', '{n} tafels', 'Voor deze tafel', 'Geschreven voor wie er is', 'Nog drie',
    'Gecertificeerde host', 'Je tafels zijn officieel: check-in-QR en kaarten klaar vanaf de eerste minuut.', 'Organiseer een officiële tafel', '{n}/5 stempels tot gecertificeerde host',
    'Mijn Global Track-doel', 'Jongerenuitwisseling', 'Digitale nomade', 'Studeren in het buitenland', 'Werken in het buitenland', 'Reizen', 'Wereldwijd', 'nu vanuit'],
  pt: ['Afinidade', 'Mesa oficial', 'Perto de mim', 'Cidades', 'O Moments vive nestas cidades. Escolhe uma para ver as mesas.', '{n} mesas', 'Para esta mesa', 'Escrito para quem está aqui', 'Mais três',
    'Anfitrião certificado', 'As tuas mesas são oficiais: QR de chegada e cartas prontos desde o primeiro minuto.', 'Organizar uma mesa oficial', '{n}/5 carimbos para seres anfitrião certificado',
    'O meu objetivo Global Track', 'Intercâmbio jovem', 'Nómada digital', 'Estudar fora', 'Trabalhar fora', 'Viajar', 'Global', 'agora de'],
  ro: ['Potrivire', 'Masă oficială', 'Lângă mine', 'Orașe', 'Moments trăiește în aceste orașe. Alege unul ca să-i vezi mesele.', '{n} mese', 'Pentru masa asta', 'Scris pentru cei de aici', 'Încă trei',
    'Gazdă certificată', 'Mesele tale sunt oficiale: QR de sosire și cărțile gata din primul minut.', 'Organizează o masă oficială', '{n}/5 ștampile până la gazdă certificată',
    'Obiectivul meu Global Track', 'Schimb de tineri', 'Nomad digital', 'Studii în străinătate', 'Muncă în străinătate', 'Călătorii', 'Global', 'acum din'],
  ru: ['Совпадение', 'Официальный стол', 'Рядом', 'Города', 'Moments живёт в этих городах. Выбери город, чтобы увидеть его столы.', '{n} столов', 'Для этого стола', 'Написано для тех, кто здесь', 'Ещё три',
    'Сертифицированный хост', 'Твои столы официальные: QR для отметки и карты готовы с первой минуты.', 'Провести официальный стол', '{n}/5 штампов до сертифицированного хоста',
    'Моя цель в Global Track', 'Молодёжный обмен', 'Цифровой кочевник', 'Учёба за границей', 'Работа за границей', 'Путешествия', 'Глобально', 'сейчас из'],
  tr: ['Uyum', 'Resmi masa', 'Yakınımda', 'Şehirler', 'Moments bu şehirlerde. Masalarını görmek için birini seç.', '{n} masa', 'Bu masa için', 'Buradakiler için yazıldı', 'Üç tane daha',
    'Sertifikalı ev sahibi', 'Masaların resmi: giriş QR’ı ve kartlar ilk dakikadan hazır.', 'Resmi bir masa aç', 'Sertifikalı ev sahibine {n}/5 damga',
    'Global Track hedefim', 'Gençlik değişimi', 'Dijital göçebe', 'Yurt dışında okumak', 'Yurt dışında çalışmak', 'Seyahat', 'Küresel', 'şu an buradan'],
  uk: ['Збіг', 'Офіційний стіл', 'Поруч', 'Міста', 'Moments живе в цих містах. Обери місто, щоб побачити його столи.', '{n} столів', 'Для цього столу', 'Написано для тих, хто тут', 'Ще три',
    'Сертифікований хост', 'Твої столи офіційні: QR для відмітки й картки готові з першої хвилини.', 'Провести офіційний стіл', '{n}/5 штампів до сертифікованого хоста',
    'Моя мета в Global Track', 'Молодіжний обмін', 'Цифровий кочівник', 'Навчання за кордоном', 'Робота за кордоном', 'Подорожі', 'Глобально', 'зараз з'],
  zh: ['契合度', '官方桌', '我附近', '城市', 'Moments 在这些城市。选一个看看它的桌。', '{n} 桌', '为这一桌', '为在座的人写的', '再来三个',
    '认证主持人', '你的桌是官方桌：签到二维码和卡牌从第一分钟就准备好。', '开一张官方桌', '还差 {n}/5 个印章成为认证主持人',
    '我的 Global Track 目标', '青年交流', '数字游民', '出国留学', '海外工作', '旅行', '全球', '现在来自'],
};
export const sw = (lang, k, vars) => {
  const i = K.indexOf(k);
  let s = (S[lang] || S.en)[i] || S.en[i] || '';
  Object.keys(vars || {}).forEach((v) => { s = s.replace('{' + v + '}', String(vars[v])); });
  return s;
};
export const GOALS = ['youth_exchange', 'digital_nomad', 'study_abroad', 'work_abroad', 'travel'];
