import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { useLang } from '../context/LanguageContext';
import { topicCircles, createTopicCircle, joinCircle, lastFix } from '../services/squadAdmin';
import { openChat } from '../lib/chatBus';
import { kept, keep } from '../lib/kept';
import { tapLight, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { SheetHandle } from './SheetHandle';

/* ─── GROUP CHATS ON ONE TOPIC ─────────────────────────────────────────
   Friends, self-development, languages: the open group chats on that
   topic (topic_circles in RUN_ME.sql), nearest first when we know where
   you are, with how many are in each — never who. Join opens the chat.
   None yet: start the first one, with a name already written. For
   languages there is also the one-to-one way, language partners. */
export const TOPICS = {
  friends: { emoji: '🤝' },
  growth: { emoji: '🌱' },
  language: { emoji: '🗣️' },
  neighbours: { emoji: '🏘️' },
};

/* Neighbours' words live here, with the only screen that says them.
   btn · title · sub · def(ault name) · about · where (no location yet) · kids */
const NB = {
  en: ['Neighbours', 'Neighbours', 'The people who live around you, within 3 km: family outings, the kids playing together, a hand when it is needed.', 'Our neighbours', 'Neighbours who look out for each other. Family outings, kids’ activities with their parents, kind words only.', 'Turn on location to find the neighbours around you.', 'Children do not have accounts here — their parents join, and sign them up.'],
  ar: ['الجيران', 'الجيران', 'الناس اللي ساكنين حواليك، في حدود ٣ كم: خروجات للعيلة، الولاد يلعبوا مع بعض، وإيد تساعد وقت الحاجة.', 'جيراننا', 'جيران بيسألوا على بعض. خروجات للعيلة، أنشطة للأطفال مع أهاليهم، والكلام الحلو بس.', 'شغّل الموقع عشان نلاقيلك الجيران اللي حواليك.', 'الأطفال مالهمش حسابات هنا — الأهالي هما اللي بيشتركوا وبيسجلوهم.'],
  cs: ['Sousedé', 'Sousedé', 'Lidé, kteří bydlí kolem tebe do 3 km: rodinné výlety, děti spolu, pomoc, když je potřeba.', 'Naši sousedé', 'Sousedé, kteří na sebe dávají pozor. Rodinné výlety, aktivity pro děti s rodiči, jen laskavá slova.', 'Zapni polohu a najdeme sousedy kolem tebe.', 'Děti tu nemají účty — přidávají se rodiče a přihlašují je.'],
  es: ['Vecinos', 'Vecinos', 'La gente que vive cerca, a menos de 3 km: salidas en familia, los niños jugando juntos, una mano cuando hace falta.', 'Nuestros vecinos', 'Vecinos que se cuidan. Salidas en familia, actividades para niños con sus padres, solo palabras amables.', 'Activa la ubicación para encontrar a tus vecinos.', 'Los niños no tienen cuenta aquí: se unen sus padres y los inscriben.'],
  et: ['Naabrid', 'Naabrid', 'Inimesed, kes elavad 3 km raadiuses: pereväljasõidud, lapsed koos mängimas, abi, kui seda vaja.', 'Meie naabrid', 'Naabrid, kes hoolivad teineteisest. Pereväljasõidud, laste tegevused koos vanematega, ainult head sõnad.', 'Lülita asukoht sisse, et leida ümberkaudsed naabrid.', 'Lastel siin kontot pole — liituvad vanemad ja panevad nad kirja.'],
  fr: ['Voisins', 'Voisins', 'Les gens qui vivent autour de toi, à moins de 3 km : sorties en famille, les enfants qui jouent ensemble, un coup de main quand il faut.', 'Nos voisins', 'Des voisins qui veillent les uns sur les autres. Sorties en famille, activités pour enfants avec leurs parents, que des mots gentils.', 'Active la localisation pour trouver tes voisins.', 'Les enfants n’ont pas de compte ici : ce sont les parents qui rejoignent et les inscrivent.'],
  hi: ['पड़ोसी', 'पड़ोसी', 'तुम्हारे आसपास 3 किमी में रहने वाले लोग: परिवार के साथ घूमना, बच्चे साथ खेलें, ज़रूरत पर मदद।', 'हमारे पड़ोसी', 'पड़ोसी जो एक-दूसरे का ख़याल रखते हैं। परिवार के साथ घूमना, माता-पिता के साथ बच्चों की गतिविधियाँ, सिर्फ़ अच्छी बातें।', 'आसपास के पड़ोसी ढूँढने के लिए लोकेशन चालू करो।', 'बच्चों के यहाँ अकाउंट नहीं होते — माता-पिता जुड़ते हैं और उन्हें शामिल करते हैं।'],
  it: ['Vicini', 'Vicini', 'Le persone che vivono intorno a te, entro 3 km: uscite in famiglia, i bambini che giocano insieme, una mano quando serve.', 'I nostri vicini', 'Vicini che si guardano le spalle. Uscite in famiglia, attività per bambini con i genitori, solo parole gentili.', 'Attiva la posizione per trovare i vicini intorno a te.', 'I bambini qui non hanno un account: si iscrivono i genitori e li registrano.'],
  ja: ['ご近所', 'ご近所', '3km以内に住む人たち：家族でのお出かけ、子ども同士の遊び、困ったときの助け合い。', 'ご近所さん', 'お互いを気にかけるご近所。家族のお出かけ、親子で参加する子どもの活動、やさしい言葉だけ。', '位置情報をオンにすると近くのご近所が見つかります。', '子どものアカウントはありません。親が参加して申し込みます。'],
  ko: ['이웃', '이웃', '반경 3km 안에 사는 사람들: 가족 나들이, 함께 노는 아이들, 필요할 때 내미는 손.', '우리 이웃', '서로 챙기는 이웃. 가족 나들이, 부모와 함께하는 아이 활동, 다정한 말만.', '위치를 켜면 주변 이웃을 찾을 수 있어요.', '아이들은 계정이 없어요 — 부모님이 가입하고 신청해요.'],
  nl: ['Buren', 'Buren', 'De mensen die binnen 3 km om je heen wonen: uitjes met het gezin, kinderen die samen spelen, een hand als het nodig is.', 'Onze buren', 'Buren die op elkaar letten. Gezinsuitjes, activiteiten voor kinderen met hun ouders, alleen vriendelijke woorden.', 'Zet je locatie aan om je buren te vinden.', 'Kinderen hebben hier geen account — hun ouders doen mee en schrijven ze in.'],
  pt: ['Vizinhos', 'Vizinhos', 'As pessoas que vivem à tua volta, até 3 km: passeios em família, as crianças a brincar juntas, uma ajuda quando é preciso.', 'Os nossos vizinhos', 'Vizinhos que olham uns pelos outros. Passeios em família, atividades para crianças com os pais, só palavras gentis.', 'Liga a localização para encontrar os teus vizinhos.', 'As crianças não têm conta aqui — os pais é que entram e as inscrevem.'],
  ro: ['Vecini', 'Vecini', 'Oamenii care locuiesc în jurul tău, pe o rază de 3 km: ieșiri în familie, copiii jucându-se împreună, o mână de ajutor la nevoie.', 'Vecinii noștri', 'Vecini care au grijă unii de alții. Ieșiri în familie, activități pentru copii cu părinții lor, doar vorbe bune.', 'Pornește locația ca să-ți găsim vecinii.', 'Copiii nu au cont aici — părinții se alătură și îi înscriu.'],
  ru: ['Соседи', 'Соседи', 'Люди, которые живут рядом, в пределах 3 км: семейные выходы, дети играют вместе, помощь, когда нужна.', 'Наши соседи', 'Соседи, которые присматривают друг за другом. Семейные выходы, занятия для детей вместе с родителями, только добрые слова.', 'Включи геолокацию, чтобы найти соседей рядом.', 'У детей здесь нет аккаунтов — вступают родители и записывают их.'],
  tr: ['Komşular', 'Komşular', 'Çevrende, 3 km içinde yaşayanlar: aile gezmeleri, birlikte oynayan çocuklar, gerektiğinde bir yardım eli.', 'Komşularımız', 'Birbirini kollayan komşular. Aile gezmeleri, ebeveynleriyle çocuk etkinlikleri, sadece güzel sözler.', 'Çevrendeki komşuları bulmak için konumu aç.', 'Çocukların burada hesabı yok — ebeveynler katılır ve onları kaydeder.'],
  uk: ['Сусіди', 'Сусіди', 'Люди, які живуть поруч, у межах 3 км: сімейні виходи, діти граються разом, допомога, коли треба.', 'Наші сусіди', 'Сусіди, які дбають одне про одного. Сімейні виходи, заняття для дітей разом із батьками, лише добрі слова.', 'Увімкни геолокацію, щоб знайти сусідів поруч.', 'Діти тут не мають акаунтів — долучаються батьки й записують їх.'],
  zh: ['邻居', '邻居', '住在你身边3公里内的人：家庭出游、孩子们一起玩、需要时搭把手。', '我们的邻居', '彼此照应的邻居。家庭出游、亲子一起参加的儿童活动，只说友善的话。', '打开定位，找到你身边的邻居。', '孩子在这里没有账号——由父母加入并为他们报名。'],
};
const NB_K = ['btn', 'title', 'sub', 'default', 'about', 'where', 'kids'];
export const nbWord = (lang, k) => ((NB[lang] || NB.en)[NB_K.indexOf(k)] || NB.en[NB_K.indexOf(k)]);

export const TopicCircles = ({ topic, onClose, onPartners }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const { t, lang } = useLang();
  const at = lastFix();
  const nb = topic === 'neighbours';
  // the topic's own words: Neighbours keeps its here, the others in the app's strings
  const w = (k) => (nb ? nbWord(lang, k) : t('tc_' + k + '_' + topic));
  const K = 'topic.' + topic;
  const [list, setList] = useState(() => kept(K));
  const [busy, setBusy] = useState(null);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState(null);
  const load = () => topicCircles(topic, at).then((r) => setList(keep(K, r)));
  useEffect(() => { load(); }, [topic]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (c) => { onClose(); openChat({ id: c.id, name: c.name, emoji: c.emoji || TOPICS[topic].emoji }); };
  const join = async (c) => {
    if (busy) return;
    tapLight(); setBusy(c.id);
    const r = c.mine ? { ok: true } : await joinCircle(c.id);
    setBusy(null);
    if (r && r.ok) { tapSuccess(); open(c); } else setErr(t('gc_failed'));
  };
  const start = async () => {
    const n = (name || w('default')).trim();
    if (busy) return;
    tapLight(); setBusy('new'); setErr(null);
    const r = await createTopicCircle(topic, n, w('about'), at);
    setBusy(null);
    if (r && r.ok) { tapSuccess(); open({ id: r.id, name: n }); }
    else setErr(r && r.reason === 'where' ? nbWord(lang, 'where') : t(r && r.reason === 'too_many' ? 'tc_too_many' : 'gc_failed'));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(6,4,18,0.55)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: insets.bottom + 20, maxHeight: '86%' }}>
        <View style={{ alignItems: 'center', marginTop: -6, marginBottom: 6 }}><SheetHandle onClose={onClose} /></View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{TOPICS[topic].emoji + ' ' + w('title')}</Text>
        <Text style={{ color: C.dim, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>{w('sub')}</Text>

        {nb ? (
          <Text style={{ color: C.dim, fontSize: 12.5, lineHeight: 18, marginTop: 8 }}>{'👨‍👩‍👧 ' + nbWord(lang, 'kids')}</Text>
        ) : null}
        {nb && !at ? (
          <Text style={{ color: C.text, fontSize: 14, marginTop: 12 }}>{nbWord(lang, 'where')}</Text>
        ) : null}

        {topic === 'language' && onPartners ? (
          <Pressable onPress={() => { tapLight(); onPartners(); }} accessibilityRole="button" style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12 }}>
              <Text style={{ fontSize: 20, marginEnd: 10 }}>🌍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '800' }}>{t('tc_partners')}</Text>
                <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }}>{t('tc_partners_sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={C.dim} />
            </View>
          </Pressable>
        ) : null}

        <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
          {list == null ? <ActivityIndicator color={C.dim} style={{ marginVertical: 20 }} />
            : !list.length ? (nb && !at ? null : <Text style={{ color: C.dim, fontSize: 14, marginVertical: 8 }}>{t('tc_none')}</Text>)
            : list.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '900' }} numberOfLines={1}>{c.name}</Text>
                  <Text style={{ color: C.dim, fontSize: 12.5, marginTop: 2 }} numberOfLines={1}>
                    {[t('gc_members_n').replace('{n}', String(c.members)), c.km != null ? c.km + ' km' : t('tc_online'), c.place_name].filter(Boolean).join(' · ')}
                  </Text>
                  {c.about ? <Text style={{ color: C.text, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{c.about}</Text> : null}
                </View>
                <Pressable onPress={() => join(c)} accessibilityRole="button" style={{ marginStart: 10 }}>
                  <View style={{ borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: c.mine ? 'transparent' : C.purple, borderWidth: 1, borderColor: c.mine ? C.line : C.purple, opacity: busy === c.id ? 0.6 : 1 }}>
                    <Text style={{ color: c.mine ? C.text : '#FFF', fontSize: 13, fontWeight: '900' }}>{c.mine ? t('ci_open') : t('ci_join')}</Text>
                  </View>
                </Pressable>
              </View>
            ))}

          {nb && !at ? null : making ? (
            <View style={{ marginTop: 8 }}>
              <TextInput value={name} onChangeText={setName} maxLength={80} placeholder={w('default')} placeholderTextColor={C.faint}
                style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 }} />
              <Pressable onPress={start} accessibilityRole="button" style={{ marginTop: 10 }}>
                <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.purple, opacity: busy === 'new' ? 0.6 : 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{t('tc_start')}</Text>
                </View>
              </Pressable>
              <Text style={{ color: C.faint, fontSize: 12, marginTop: 8, textAlign: 'center' }}>{at ? t('tc_where_near') : t('tc_where_online')}</Text>
            </View>
          ) : (
            <Pressable onPress={() => { tapLight(); setMaking(true); }} accessibilityRole="button" style={{ marginTop: 8 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: C.purple }}>
                <Text style={{ color: C.purple, fontSize: 15, fontWeight: '900' }}>{'＋ ' + t('tc_start_new')}</Text>
              </View>
            </Pressable>
          )}
          {err ? <Text style={{ color: '#E11D48', fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
};
