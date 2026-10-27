import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { DECK, badgeName, cardText } from '../constants/activityDeck';
import { sw } from '../constants/scaleWords';
import { midnightTable, midnightSpark } from '../services/midnight';
import { askUpgrade } from '../services/membership';
import { goToTab } from '../lib/mapBus';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';

/* ─── THE MIDNIGHT TABLE ──────────────────────────────────────────────
   Ayser: curiosity first. Every evening at 8 a few people picked by
   language and Global Track goal — no name, no photo: what they speak
   and learn, their goal, their tags, an icebreaker. Both tap Spark and
   the photo clears, the name shows and a chat opens. Free accounts have
   one Spark a day; the second opens the plans. The server never sends a
   name, a photo or an account id before the Spark is mutual, so the
   blur hides nothing that could be looked up. */

const K = ['title', 'sub', 'spark', 'sparked', 'mutual', 'say', 'book', 'left1', 'left0', 'next', 'empty', 'speaks', 'learns', 'chats', 'locked', 'seePlus', 'wait'];
const S = {
  en: ['The Midnight Table', 'Every evening at 8, a few people who fit you. No names, no photos — until you both Spark.', 'Spark', 'Sparked', 'Mutual Spark', 'Say hi', 'Book a table together', '1 Spark left today', 'No Sparks left today', 'New table in {t}', 'Nobody at your table yet. Come back at 8.', 'Speaks', 'Learning', 'Chats', 'Moments+ members start chats. When one writes to you, you can answer.', 'See Moments+', 'If they Spark you too, you will both see who it is.'],
  ar: ['ترابيزة نص الليل', 'كل يوم الساعة ٨ بالليل، كام حد شبهك. من غير أسامي ولا صور، لحد ما انتو الاتنين تبعتوا شرارة.', 'ابعت شرارة', 'اتبعتت', 'شرارة متبادلة', 'قول أهلًا', 'احجزوا ترابيزة سوا', 'فاضلك شرارة واحدة النهارده', 'خلصت شراراتك النهارده', 'ترابيزة جديدة كمان {t}', 'لسه مفيش حد على ترابيزتك. ارجع الساعة ٨.', 'بيتكلم', 'بيتعلم', 'الرسايل', 'أعضاء مومنتس بلس هما اللي بيبدأوا الكلام. لما حد فيهم يكلمك، تقدر ترد.', 'شوف مومنتس بلس', 'لو بعتلك شرارة هو كمان، هتشوفوا بعض.'],
  cs: ['Půlnoční stůl', 'Každý večer v 8 pár lidí, kteří ti sednou. Bez jmen a fotek — dokud si oba nepošlete Spark.', 'Spark', 'Odesláno', 'Vzájemný Spark', 'Pozdrav', 'Zarezervujte si stůl spolu', 'Dnes ti zbývá 1 Spark', 'Dnes už nemáš žádný Spark', 'Nový stůl za {t}', 'U tvého stolu zatím nikdo není. Vrať se v 8.', 'Mluví', 'Učí se', 'Zprávy', 'Chaty začínají členové Moments+. Když ti někdo napíše, můžeš odpovědět.', 'Zobrazit Moments+', 'Když ti Spark pošle i on, uvidíte se navzájem.'],
  es: ['La Mesa de Medianoche', 'Cada tarde a las 8, unas pocas personas afines a ti. Sin nombres ni fotos, hasta que los dos enviéis un Spark.', 'Spark', 'Enviado', 'Spark mutuo', 'Saluda', 'Reservad una mesa juntos', 'Te queda 1 Spark hoy', 'Hoy no te quedan Sparks', 'Nueva mesa en {t}', 'Aún no hay nadie en tu mesa. Vuelve a las 8.', 'Habla', 'Aprende', 'Chats', 'Los miembros de Moments+ inician los chats. Cuando uno te escribe, puedes responder.', 'Ver Moments+', 'Si también te envía un Spark, os veréis los dos.'],
  et: ['Kesköölaud', 'Igal õhtul kell 8 mõned sulle sobivad inimesed. Ilma nimede ja piltideta — kuni te mõlemad saadate Sparki.', 'Spark', 'Saadetud', 'Vastastikune Spark', 'Ütle tere', 'Broneerige koos laud', 'Täna on jäänud 1 Spark', 'Täna Sparke enam pole', 'Uus laud {t} pärast', 'Sinu laua taga pole veel kedagi. Tule tagasi kell 8.', 'Räägib', 'Õpib', 'Vestlused', 'Vestlusi alustavad Moments+ liikmed. Kui keegi sulle kirjutab, saad vastata.', 'Vaata Moments+', 'Kui ka tema saadab sulle Sparki, näete teineteist.'],
  fr: ['La Table de Minuit', 'Chaque soir à 20 h, quelques personnes qui te ressemblent. Ni noms ni photos, jusqu’à ce que vous envoyiez tous les deux un Spark.', 'Spark', 'Envoyé', 'Spark mutuel', 'Dis bonjour', 'Réservez une table ensemble', 'Il te reste 1 Spark aujourd’hui', 'Plus de Spark aujourd’hui', 'Nouvelle table dans {t}', 'Personne à ta table pour l’instant. Reviens à 20 h.', 'Parle', 'Apprend', 'Messages', 'Les membres Moments+ lancent les conversations. Quand l’un d’eux t’écrit, tu peux répondre.', 'Voir Moments+', 'S’il t’envoie aussi un Spark, vous vous verrez tous les deux.'],
  hi: ['मिडनाइट टेबल', 'हर शाम 8 बजे, कुछ लोग जो आपसे मेल खाते हैं। न नाम, न फ़ोटो — जब तक आप दोनों Spark न भेजें।', 'Spark', 'भेजा', 'आपसी Spark', 'हाय कहो', 'साथ में टेबल बुक करो', 'आज 1 Spark बचा है', 'आज कोई Spark नहीं बचा', 'नई टेबल {t} में', 'अभी आपकी टेबल पर कोई नहीं। 8 बजे वापस आओ।', 'बोलते हैं', 'सीख रहे हैं', 'चैट', 'चैट Moments+ सदस्य शुरू करते हैं। जब कोई आपको लिखे, आप जवाब दे सकते हैं।', 'Moments+ देखें', 'अगर वे भी आपको Spark भेजें, तो आप दोनों एक-दूसरे को देखेंगे।'],
  it: ['Il Tavolo di Mezzanotte', 'Ogni sera alle 20, alcune persone affini a te. Niente nomi né foto, finché non vi mandate entrambi uno Spark.', 'Spark', 'Inviato', 'Spark reciproco', 'Saluta', 'Prenotate un tavolo insieme', 'Ti resta 1 Spark oggi', 'Oggi non hai più Spark', 'Nuovo tavolo tra {t}', 'Ancora nessuno al tuo tavolo. Torna alle 20.', 'Parla', 'Impara', 'Chat', 'Le chat le iniziano i membri Moments+. Quando uno ti scrive, puoi rispondere.', 'Vedi Moments+', 'Se anche lui ti manda uno Spark, vi vedrete entrambi.'],
  ja: ['ミッドナイト・テーブル', '毎晩8時、あなたに合う数人。名前も写真もなし——お互いにSparkを送るまで。', 'Spark', '送信済み', 'お互いのSpark', 'あいさつする', '一緒にテーブルを予約', '今日のSparkは残り1回', '今日のSparkはもうありません', '新しいテーブルまで {t}', 'まだ誰もいません。8時にまた来てね。', '話す言語', '学習中', 'チャット', 'チャットはMoments+メンバーが始めます。メッセージが来たら返信できます。', 'Moments+を見る', '相手もSparkを送ったら、お互いが見えます。'],
  ko: ['미드나잇 테이블', '매일 저녁 8시, 나와 잘 맞는 몇 사람. 이름도 사진도 없이 — 둘 다 Spark를 보낼 때까지.', 'Spark', '보냄', '서로 Spark', '인사하기', '함께 테이블 예약하기', '오늘 Spark 1개 남음', '오늘 남은 Spark 없음', '새 테이블까지 {t}', '아직 테이블에 아무도 없어요. 8시에 다시 와요.', '사용 언어', '배우는 언어', '채팅', '채팅은 Moments+ 회원이 시작해요. 회원이 먼저 쓰면 답장할 수 있어요.', 'Moments+ 보기', '상대도 Spark를 보내면 서로를 보게 돼요.'],
  nl: ['De Middernachttafel', 'Elke avond om 8 uur een paar mensen die bij je passen. Geen namen, geen foto’s — tot jullie allebei een Spark sturen.', 'Spark', 'Verstuurd', 'Wederzijdse Spark', 'Zeg hoi', 'Boek samen een tafel', 'Nog 1 Spark vandaag', 'Geen Sparks meer vandaag', 'Nieuwe tafel over {t}', 'Nog niemand aan je tafel. Kom om 8 uur terug.', 'Spreekt', 'Leert', 'Chats', 'Moments+-leden beginnen chats. Als iemand jou schrijft, kun je antwoorden.', 'Bekijk Moments+', 'Als die jou ook een Spark stuurt, zien jullie elkaar.'],
  pt: ['A Mesa da Meia-Noite', 'Toda noite às 20h, algumas pessoas que combinam com você. Sem nomes nem fotos — até vocês dois mandarem um Spark.', 'Spark', 'Enviado', 'Spark mútuo', 'Diga oi', 'Reservem uma mesa juntos', 'Resta 1 Spark hoje', 'Sem Sparks hoje', 'Nova mesa em {t}', 'Ainda não tem ninguém na sua mesa. Volte às 20h.', 'Fala', 'Aprende', 'Conversas', 'Membros Moments+ começam as conversas. Quando um te escrever, você pode responder.', 'Ver Moments+', 'Se a pessoa também mandar um Spark, vocês vão se ver.'],
  ro: ['Masa de la Miezul Nopții', 'În fiecare seară la 8, câțiva oameni potriviți pentru tine. Fără nume, fără poze — până vă trimiteți amândoi un Spark.', 'Spark', 'Trimis', 'Spark reciproc', 'Salută', 'Rezervați o masă împreună', 'Îți mai rămâne 1 Spark azi', 'Nu mai ai Spark azi', 'Masă nouă în {t}', 'Încă nu e nimeni la masa ta. Revino la 8.', 'Vorbește', 'Învață', 'Mesaje', 'Conversațiile le încep membrii Moments+. Când unul îți scrie, poți răspunde.', 'Vezi Moments+', 'Dacă îți trimite și el un Spark, vă veți vedea.'],
  ru: ['Полуночный стол', 'Каждый вечер в 8 — несколько подходящих тебе людей. Без имён и фото, пока вы оба не отправите Spark.', 'Spark', 'Отправлено', 'Взаимный Spark', 'Поздороваться', 'Забронируйте стол вместе', 'Сегодня остался 1 Spark', 'Сегодня Spark больше нет', 'Новый стол через {t}', 'За твоим столом пока никого. Возвращайся в 8.', 'Говорит', 'Учит', 'Чаты', 'Чаты начинают участники Moments+. Когда тебе напишут, ты сможешь ответить.', 'Посмотреть Moments+', 'Если тебе тоже отправят Spark, вы увидите друг друга.'],
  tr: ['Gece Yarısı Masası', 'Her akşam 8’de sana uyan birkaç kişi. İsim yok, fotoğraf yok — ikiniz de Spark gönderene kadar.', 'Spark', 'Gönderildi', 'Karşılıklı Spark', 'Selam ver', 'Birlikte masa ayırtın', 'Bugün 1 Spark kaldı', 'Bugün Spark kalmadı', 'Yeni masa {t} sonra', 'Masanda henüz kimse yok. Saat 8’de gel.', 'Konuşuyor', 'Öğreniyor', 'Sohbetler', 'Sohbetleri Moments+ üyeleri başlatır. Biri sana yazınca cevap verebilirsin.', 'Moments+’ı gör', 'O da sana Spark gönderirse birbirinizi göreceksiniz.'],
  uk: ['Опівнічний стіл', 'Щовечора о 8 — кілька людей, які тобі підходять. Без імен і фото, доки ви обоє не надішлете Spark.', 'Spark', 'Надіслано', 'Взаємний Spark', 'Привітатися', 'Забронюйте стіл разом', 'Сьогодні залишився 1 Spark', 'Сьогодні Spark більше немає', 'Новий стіл через {t}', 'За твоїм столом поки нікого. Повертайся о 8.', 'Говорить', 'Вчить', 'Чати', 'Чати починають учасники Moments+. Коли тобі напишуть, ти зможеш відповісти.', 'Переглянути Moments+', 'Якщо тобі теж надішлють Spark, ви побачите одне одного.'],
  zh: ['午夜餐桌', '每晚 8 点，几位和你合拍的人。没有名字、没有照片——直到你们都发出 Spark。', 'Spark', '已发送', '互相 Spark', '打个招呼', '一起订一张桌子', '今天还剩 1 次 Spark', '今天的 Spark 用完了', '{t} 后有新餐桌', '你的餐桌还没有人。8 点再来。', '会说', '在学', '聊天', '聊天由 Moments+ 会员发起。他们给你写信后，你就能回复。', '查看 Moments+', '如果对方也给你发 Spark，你们就能看到彼此。'],
};
export const mw = (lang, k, v) => {
  const i = K.indexOf(k);
  let s = (S[lang] || S.en)[i] || S.en[i] || '';
  if (v) Object.keys(v).forEach((x) => { s = s.replace('{' + x + '}', v[x]); });
  return s;
};

// the language names the exchange pickers store, said in the reader's language
const CODE = { Arabic: 'ar', English: 'en', French: 'fr', Spanish: 'es', German: 'de', Italian: 'it', Portuguese: 'pt', Turkish: 'tr', Russian: 'ru',
  Chinese: 'zh', Japanese: 'ja', Korean: 'ko', Hindi: 'hi', Dutch: 'nl', Greek: 'el', Romanian: 'ro', Persian: 'fa', Urdu: 'ur' };
const langName = (name, lang) => {
  if (!name) return null;
  try { return new Intl.DisplayNames([lang], { type: 'language' }).of(CODE[name] || name) || name; } catch (e) { return name; }
};
const until = (iso, lang) => {
  const ms = Math.max(0, Date.parse(iso) - Date.now());
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
  const n = (x) => x.toLocaleString(lang === 'ar' ? 'ar-EG' : lang);
  return h ? n(h) + (lang === 'ar' ? ' س ' : 'h ') + n(m) + (lang === 'ar' ? ' د' : 'm') : n(m) + (lang === 'ar' ? ' دقيقة' : ' min');
};

/* the ✦ members wear beside their name */
export const Mark = ({ size = 12 }) => <Text style={{ color: C.text, fontSize: size, marginStart: 5 }} accessibilityLabel="Moments+">✦</Text>;

const web = Platform.OS === 'web';
// the hidden face: a soft blot of grey, never their photo
const Blind = () => (
  <View style={{ width: 84, height: 84, borderRadius: 42, overflow: 'hidden', backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center' }}>
    <View style={[{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#3A3A3A', marginTop: 18 }, web ? { filter: 'blur(9px)' } : null]} />
    <View style={[{ position: 'absolute', top: 16, width: 26, height: 26, borderRadius: 13, backgroundColor: '#4A4A4A' }, web ? { filter: 'blur(7px)' } : null]} />
  </View>
);
// the reveal: the photo clears from a heavy blur
const Reveal = ({ uri }) => {
  const [clear, setClear] = useState(false);
  useEffect(() => { const t = setTimeout(() => setClear(true), 60); return () => clearTimeout(t); }, []);
  return uri ? (
    <Image source={{ uri }} style={[{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#141414' },
      web ? { filter: clear ? 'blur(0px)' : 'blur(18px)', transition: 'filter 900ms ease' } : null]} />
  ) : <Blind />;
};

const Chip = ({ label }) => (
  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingVertical: 5, marginEnd: 6, marginTop: 6 }}>
    <Text style={{ color: C.text, fontSize: 12.5 }}>{label}</Text>
  </View>
);

const Card = ({ p, lang, onSpark, onSay }) => {
  const tags = String(p.tags || '').split(/[,،·]/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
  const vibes = (p.vibes || []).map((b) => badgeName(lang, b)).filter(Boolean);
  const ice = DECK.warm && DECK.warm[p.card] ? cardText(DECK.warm[p.card], lang) : null;
  const goal = p.goal ? sw(lang, 'g_' + p.goal) : null;
  const who = p.who || null;
  return (
    <View style={{ marginTop: 14, borderRadius: 24, borderWidth: 1, borderColor: p.mutual ? C.text : C.line, backgroundColor: C.glass, padding: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {p.mutual && who ? <Reveal uri={who.avatar_url} /> : <Blind />}
        <View style={{ flex: 1, marginStart: 14 }}>
          {p.mutual && who ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 19, fontWeight: '700' }} numberOfLines={1}>{who.name}</Text>
              {p.premium ? <Mark size={14} /> : null}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 110, height: 14, borderRadius: 7, backgroundColor: '#1F1F1F' }} />
              {p.premium ? <Mark size={14} /> : null}
            </View>
          )}
          {p.speaks ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 8 }}>{mw(lang, 'speaks') + ' · ' + langName(p.speaks, lang)}</Text> : null}
          {p.learning ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 2 }}>{mw(lang, 'learns') + ' · ' + langName(p.learning, lang) + (p.level ? ' · ' + p.level : '')}</Text> : null}
        </View>
      </View>
      {goal || tags.length || vibes.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          {goal ? <Chip label={goal} /> : null}
          {tags.map((x) => <Chip key={'t' + x} label={x} />)}
          {vibes.map((x) => <Chip key={'v' + x} label={x} />)}
        </View>
      ) : null}
      {ice ? <Text style={{ color: C.text, fontSize: 15.5, lineHeight: 22, marginTop: 14 }}>{'“' + ice + '”'}</Text> : null}
      {p.mutual ? (
        <>
          <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '700', marginTop: 14 }}>{'✦ ' + mw(lang, 'mutual')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Pressable onPress={() => onSay(p)} accessibilityRole="button" style={{ flex: 1, marginEnd: 8 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.text }}>
                <Text style={{ color: C.bg, fontSize: 15, fontWeight: '700' }}>{mw(lang, 'say')}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => { tapLight(); goToTab('TOGETHER'); try { window.dispatchEvent(new CustomEvent('mm-close-buddies')); } catch (e) {} }} accessibilityRole="button" style={{ flex: 1 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.text }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{mw(lang, 'book')}</Text>
              </View>
            </Pressable>
          </View>
        </>
      ) : p.sparked ? (
        <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 14 }}>{mw(lang, 'sparked') + ' · ' + mw(lang, 'wait')}</Text>
      ) : (
        <Pressable onPress={() => onSpark(p)} accessibilityRole="button" style={{ marginTop: 14 }}>
          {({ pressed }) => (
            <View style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: pressed ? C.dim : C.text }}>
              <Text style={{ color: C.bg, fontSize: 16, fontWeight: '700' }}>{'✦ ' + mw(lang, 'spark')}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
};

export const MidnightTable = ({ lang, onBack, onChat }) => {
  const [t, setT] = useState(null);
  const [, tick] = useState(0);
  const load = () => midnightTable().then((x) => setT(x && x.ok ? x : { ok: false, picks: [] }));
  useEffect(() => { load(); const i = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(i); }, []);

  const spark = async (p) => {
    tapMedium();
    const r = await midnightSpark(p.key);
    if (r && r.reason === 'quota') { askUpgrade('member'); return; }
    if (r && r.ok) {
      if (r.mutual) tapSuccess();
      setT((x) => ({ ...x, left: x.left == null ? null : Math.max(0, x.left - 1),
        picks: x.picks.map((q) => (q.key === p.key ? { ...q, sparked: true, mutual: !!r.mutual, who: r.who || q.who } : q)) }));
    }
  };
  const say = (p) => { tapLight(); if (p.who) onChat({ id: p.who.id, name: p.who.name, avatar_url: p.who.avatar_url }); };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="back">
          <Ionicons name={lang === 'ar' ? 'chevron-forward' : 'chevron-back'} size={26} color={C.text} />
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 48 }}>
        <Text style={{ color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.8 }}>{mw(lang, 'title')}</Text>
        <Text style={{ color: C.dim, fontSize: 14.5, lineHeight: 21, marginTop: 8 }}>{mw(lang, 'sub')}</Text>
        {t && t.ok ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
            {t.next_at ? <Text style={[{ color: C.dim, fontSize: 13, marginEnd: 12 }, NUM]}>{mw(lang, 'next', { t: until(t.next_at, lang) })}</Text> : null}
            {t.left != null ? (
              <View style={{ borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: C.text, fontSize: 12.5 }}>{mw(lang, t.left > 0 ? 'left1' : 'left0')}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {t == null ? <ActivityIndicator color={C.text} style={{ marginTop: 30 }} /> : !t.picks || !t.picks.length ? (
          <Text style={{ color: C.dim, fontSize: 15, lineHeight: 22, marginTop: 28 }}>{mw(lang, 'empty')}</Text>
        ) : t.picks.map((p) => <Card key={p.key} p={p} lang={lang} onSpark={spark} onSay={say} />)}
        {t && t.left === 0 ? (
          <Pressable onPress={() => { tapLight(); askUpgrade('member'); }} accessibilityRole="button" style={{ marginTop: 18, alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '600', textDecorationLine: 'underline' }}>{mw(lang, 'seePlus')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
};
