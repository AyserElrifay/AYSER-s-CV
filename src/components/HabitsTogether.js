import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { AV_NEUTRAL } from '../constants/mockData';
import { myHabits, createHabit, joinHabit, checkHabit, leaveHabit } from '../services/habits';
import { shareLink, appLink } from '../utils/share';
import { tapLight, tapSelection, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { Glyph } from '../ui/Glyph';

/* ─── HABITS TOGETHER ─────────────────────────────────────────────────
   Ayser: "Habit together (streaks, code to join together)". One small
   habit, a six-letter code you send a friend, and every day each of you
   ticks it once: you see who did, and your days in a row. Nothing to
   write, nothing to manage — tick, see your friends, keep the flame.

   Opened from My day; its words live here so they load only with it. */

const S = {
  en: { door: 'Habits', title: 'Habits together', sub: 'One small habit, with friends. Tick it once a day and keep each other going.', done: 'Done today', undo: 'Done ✓', days: '{n} days in a row', day1: '1 day — keep going', none: 'Start today', code: 'Code', share: 'Send the code', shareText: 'Do this habit with me on Moments — code {code}', leave: 'Leave', newT: 'Start a habit', namePh: 'e.g. Read 10 pages', start: 'Start', joinT: 'Got a code?', codePh: 'ABC123', join: 'Join', empty: 'No habit yet. Start one and send the code to a friend.', who: '{d} of {n} did it today', err: 'That did not work — try again', no_code: 'No habit with that code', full: 'That habit is full (12 people)', too_many: 'You are on 10 habits already' },
  ar: { door: 'عادات', title: 'عادات سوا', sub: 'عادة صغيرة مع صحابك. علّم عليها مرة كل يوم وشجّعوا بعض.', done: 'خلصتها النهارده', undo: 'خلصت ✓', days: '{n} يوم ورا بعض', day1: 'يوم واحد — كمّل', none: 'ابدأ النهارده', code: 'الكود', share: 'ابعت الكود', shareText: 'تعالى نعمل العادة دي سوا على Moments — الكود {code}', leave: 'اخرج', newT: 'ابدأ عادة', namePh: 'مثلاً: اقرا 10 صفحات', start: 'ابدأ', joinT: 'معاك كود؟', codePh: 'ABC123', join: 'ادخل', empty: 'لسه مفيش عادة. ابدأ واحدة وابعت الكود لصاحبك.', who: '{d} من {n} عملوها النهارده', err: 'ماحصلش — جرّب تاني', no_code: 'مفيش عادة بالكود ده', full: 'العادة دي كملت (12 واحد)', too_many: 'إنت في 10 عادات خلاص' },
  cs: { door: 'Návyky', title: 'Návyky spolu', sub: 'Jeden malý návyk s přáteli. Odškrtni ho jednou denně.', done: 'Hotovo dnes', undo: 'Hotovo ✓', days: '{n} dní v řadě', day1: '1 den — pokračuj', none: 'Začni dnes', code: 'Kód', share: 'Poslat kód', shareText: 'Dělej se mnou tenhle návyk na Moments — kód {code}', leave: 'Odejít', newT: 'Začít návyk', namePh: 'např. Přečíst 10 stran', start: 'Začít', joinT: 'Máš kód?', codePh: 'ABC123', join: 'Přidat se', empty: 'Zatím žádný návyk. Začni jeden a pošli kód kamarádovi.', who: '{d} z {n} dnes splnili', err: 'Nepovedlo se — zkus znovu', no_code: 'Návyk s tímto kódem neexistuje', full: 'Návyk je plný (12 lidí)', too_many: 'Už máš 10 návyků' },
  es: { door: 'Hábitos', title: 'Hábitos juntos', sub: 'Un pequeño hábito con amigos. Márcalo una vez al día.', done: 'Hecho hoy', undo: 'Hecho ✓', days: '{n} días seguidos', day1: '1 día — sigue', none: 'Empieza hoy', code: 'Código', share: 'Enviar el código', shareText: 'Haz este hábito conmigo en Moments — código {code}', leave: 'Salir', newT: 'Empezar un hábito', namePh: 'p. ej. Leer 10 páginas', start: 'Empezar', joinT: '¿Tienes un código?', codePh: 'ABC123', join: 'Unirme', empty: 'Aún no hay hábitos. Empieza uno y envía el código.', who: '{d} de {n} lo hicieron hoy', err: 'No funcionó — inténtalo otra vez', no_code: 'No hay hábito con ese código', full: 'Ese hábito está lleno (12)', too_many: 'Ya tienes 10 hábitos' },
  et: { door: 'Harjumused', title: 'Harjumused koos', sub: 'Üks väike harjumus sõpradega. Märgi see kord päevas.', done: 'Täna tehtud', undo: 'Tehtud ✓', days: '{n} päeva järjest', day1: '1 päev — jätka', none: 'Alusta täna', code: 'Kood', share: 'Saada kood', shareText: 'Tee seda harjumust minuga Momentsis — kood {code}', leave: 'Lahku', newT: 'Alusta harjumust', namePh: 'nt Loe 10 lehekülge', start: 'Alusta', joinT: 'Sul on kood?', codePh: 'ABC123', join: 'Liitu', empty: 'Veel pole harjumust. Alusta ja saada kood sõbrale.', who: '{d}/{n} tegid täna', err: 'Ei õnnestunud — proovi uuesti', no_code: 'Sellise koodiga harjumust pole', full: 'Harjumus on täis (12)', too_many: 'Sul on juba 10 harjumust' },
  fr: { door: 'Habitudes', title: 'Habitudes ensemble', sub: 'Une petite habitude, entre amis. Coche-la une fois par jour.', done: 'Fait aujourd’hui', undo: 'Fait ✓', days: '{n} jours d’affilée', day1: '1 jour — continue', none: 'Commence aujourd’hui', code: 'Code', share: 'Envoyer le code', shareText: 'Fais cette habitude avec moi sur Moments — code {code}', leave: 'Quitter', newT: 'Lancer une habitude', namePh: 'ex. Lire 10 pages', start: 'Lancer', joinT: 'Un code ?', codePh: 'ABC123', join: 'Rejoindre', empty: 'Pas encore d’habitude. Lance-en une et envoie le code.', who: '{d} sur {n} l’ont fait', err: 'Ça n’a pas marché — réessaie', no_code: 'Aucune habitude avec ce code', full: 'Habitude complète (12)', too_many: 'Tu as déjà 10 habitudes' },
  hi: { door: 'आदतें', title: 'साथ में आदतें', sub: 'दोस्तों के साथ एक छोटी आदत। रोज़ एक बार टिक करो।', done: 'आज हो गया', undo: 'हो गया ✓', days: 'लगातार {n} दिन', day1: '1 दिन — जारी रखो', none: 'आज शुरू करो', code: 'कोड', share: 'कोड भेजो', shareText: 'Moments पर मेरे साथ यह आदत करो — कोड {code}', leave: 'छोड़ो', newT: 'आदत शुरू करो', namePh: 'जैसे 10 पन्ने पढ़ना', start: 'शुरू', joinT: 'कोड है?', codePh: 'ABC123', join: 'जुड़ो', empty: 'अभी कोई आदत नहीं। एक शुरू करो और कोड भेजो।', who: '{n} में से {d} ने आज किया', err: 'नहीं हुआ — फिर कोशिश करो', no_code: 'इस कोड की कोई आदत नहीं', full: 'आदत भर गई (12)', too_many: 'तुम पहले से 10 आदतों में हो' },
  it: { door: 'Abitudini', title: 'Abitudini insieme', sub: 'Una piccola abitudine con gli amici. Spuntala una volta al giorno.', done: 'Fatto oggi', undo: 'Fatto ✓', days: '{n} giorni di fila', day1: '1 giorno — continua', none: 'Inizia oggi', code: 'Codice', share: 'Invia il codice', shareText: 'Fai questa abitudine con me su Moments — codice {code}', leave: 'Esci', newT: 'Inizia un’abitudine', namePh: 'es. Leggere 10 pagine', start: 'Inizia', joinT: 'Hai un codice?', codePh: 'ABC123', join: 'Unisciti', empty: 'Nessuna abitudine. Iniziane una e manda il codice.', who: '{d} su {n} oggi', err: 'Non è andata — riprova', no_code: 'Nessuna abitudine con questo codice', full: 'Abitudine piena (12)', too_many: 'Hai già 10 abitudini' },
  ja: { door: '習慣', title: 'いっしょに習慣', sub: '友だちと小さな習慣をひとつ。1日1回チェック。', done: '今日できた', undo: 'できた ✓', days: '{n}日連続', day1: '1日目 — 続けよう', none: '今日から', code: 'コード', share: 'コードを送る', shareText: 'Moments でこの習慣をいっしょに — コード {code}', leave: '抜ける', newT: '習慣を始める', namePh: '例: 10ページ読む', start: '始める', joinT: 'コードある？', codePh: 'ABC123', join: '参加', empty: 'まだ習慣がありません。始めてコードを送ろう。', who: '今日 {n}人中{d}人', err: 'うまくいきませんでした', no_code: 'そのコードの習慣はありません', full: '満員です（12人）', too_many: 'すでに10個参加しています' },
  ko: { door: '습관', title: '함께하는 습관', sub: '친구와 작은 습관 하나. 하루 한 번 체크해요.', done: '오늘 완료', undo: '완료 ✓', days: '{n}일 연속', day1: '1일 — 계속해요', none: '오늘 시작', code: '코드', share: '코드 보내기', shareText: 'Moments에서 이 습관 같이 해요 — 코드 {code}', leave: '나가기', newT: '습관 시작', namePh: '예: 10쪽 읽기', start: '시작', joinT: '코드 있어요?', codePh: 'ABC123', join: '참여', empty: '아직 습관이 없어요. 시작하고 코드를 보내요.', who: '오늘 {n}명 중 {d}명', err: '안 됐어요 — 다시 해봐요', no_code: '그 코드의 습관이 없어요', full: '정원이 찼어요 (12명)', too_many: '이미 습관이 10개예요' },
  nl: { door: 'Gewoontes', title: 'Samen gewoontes', sub: 'Eén kleine gewoonte met vrienden. Vink hem één keer per dag af.', done: 'Vandaag gedaan', undo: 'Gedaan ✓', days: '{n} dagen op rij', day1: '1 dag — ga door', none: 'Begin vandaag', code: 'Code', share: 'Stuur de code', shareText: 'Doe deze gewoonte met me op Moments — code {code}', leave: 'Verlaten', newT: 'Begin een gewoonte', namePh: 'bv. 10 pagina’s lezen', start: 'Beginnen', joinT: 'Een code?', codePh: 'ABC123', join: 'Meedoen', empty: 'Nog geen gewoonte. Begin er een en stuur de code.', who: '{d} van {n} vandaag', err: 'Lukte niet — probeer opnieuw', no_code: 'Geen gewoonte met die code', full: 'Gewoonte is vol (12)', too_many: 'Je hebt al 10 gewoontes' },
  pt: { door: 'Hábitos', title: 'Hábitos juntos', sub: 'Um pequeno hábito com amigos. Marca uma vez por dia.', done: 'Feito hoje', undo: 'Feito ✓', days: '{n} dias seguidos', day1: '1 dia — continua', none: 'Começa hoje', code: 'Código', share: 'Enviar o código', shareText: 'Faz este hábito comigo no Moments — código {code}', leave: 'Sair', newT: 'Começar um hábito', namePh: 'ex. Ler 10 páginas', start: 'Começar', joinT: 'Tens um código?', codePh: 'ABC123', join: 'Entrar', empty: 'Ainda sem hábitos. Começa um e envia o código.', who: '{d} de {n} hoje', err: 'Não deu — tenta outra vez', no_code: 'Não há hábito com esse código', full: 'Hábito cheio (12)', too_many: 'Já tens 10 hábitos' },
  ro: { door: 'Obiceiuri', title: 'Obiceiuri împreună', sub: 'Un obicei mic, cu prietenii. Bifează-l o dată pe zi.', done: 'Făcut azi', undo: 'Făcut ✓', days: '{n} zile la rând', day1: '1 zi — continuă', none: 'Începe azi', code: 'Cod', share: 'Trimite codul', shareText: 'Fă obiceiul ăsta cu mine pe Moments — cod {code}', leave: 'Ieși', newT: 'Începe un obicei', namePh: 'ex. Citește 10 pagini', start: 'Începe', joinT: 'Ai un cod?', codePh: 'ABC123', join: 'Intră', empty: 'Niciun obicei încă. Începe unul și trimite codul.', who: '{d} din {n} azi', err: 'N-a mers — încearcă iar', no_code: 'Niciun obicei cu acest cod', full: 'Obiceiul e plin (12)', too_many: 'Ai deja 10 obiceiuri' },
  ru: { door: 'Привычки', title: 'Привычки вместе', sub: 'Одна маленькая привычка с друзьями. Отмечай раз в день.', done: 'Сделано сегодня', undo: 'Сделано ✓', days: '{n} дней подряд', day1: '1 день — продолжай', none: 'Начни сегодня', code: 'Код', share: 'Отправить код', shareText: 'Давай вместе эту привычку в Moments — код {code}', leave: 'Выйти', newT: 'Начать привычку', namePh: 'напр. Читать 10 страниц', start: 'Начать', joinT: 'Есть код?', codePh: 'ABC123', join: 'Войти', empty: 'Пока нет привычек. Начни и отправь код другу.', who: '{d} из {n} сегодня', err: 'Не вышло — попробуй ещё', no_code: 'Нет привычки с таким кодом', full: 'Привычка заполнена (12)', too_many: 'У тебя уже 10 привычек' },
  tr: { door: 'Alışkanlık', title: 'Birlikte alışkanlık', sub: 'Arkadaşlarla küçük bir alışkanlık. Günde bir kez işaretle.', done: 'Bugün yaptım', undo: 'Yaptım ✓', days: '{n} gün üst üste', day1: '1 gün — devam', none: 'Bugün başla', code: 'Kod', share: 'Kodu gönder', shareText: 'Moments’ta bu alışkanlığı benimle yap — kod {code}', leave: 'Ayrıl', newT: 'Alışkanlık başlat', namePh: 'örn. 10 sayfa oku', start: 'Başlat', joinT: 'Kodun var mı?', codePh: 'ABC123', join: 'Katıl', empty: 'Henüz alışkanlık yok. Başlat ve kodu gönder.', who: 'Bugün {n} kişiden {d}', err: 'Olmadı — tekrar dene', no_code: 'Bu kodla alışkanlık yok', full: 'Alışkanlık dolu (12)', too_many: 'Zaten 10 alışkanlıktasın' },
  uk: { door: 'Звички', title: 'Звички разом', sub: 'Одна маленька звичка з друзями. Відмічай її раз на день і підтримуйте одне одного.', done: 'Зроблено сьогодні', undo: 'Зроблено ✓', days: '{n} днів поспіль', day1: '1 день — продовжуй', none: 'Почни сьогодні', code: 'Код', share: 'Надіслати код', shareText: 'Тримай зі мною цю звичку в Moments — код {code}', leave: 'Вийти', newT: 'Почати звичку', namePh: 'напр. Читати 10 сторінок', start: 'Почати', joinT: 'Маєш код?', codePh: 'ABC123', join: 'Приєднатися', empty: 'Звички ще немає. Почни одну й надішли код другові.', who: '{d} з {n} зробили сьогодні', err: 'Не вийшло — спробуй ще раз', no_code: 'Звички з таким кодом немає', full: 'Ця звичка заповнена (12 людей)', too_many: 'У тебе вже 10 звичок' },
  zh: { door: '习惯', title: '一起养成习惯', sub: '和朋友一起的小习惯，每天打卡一次。', done: '今天完成', undo: '已完成 ✓', days: '连续 {n} 天', day1: '第1天 — 继续', none: '今天开始', code: '邀请码', share: '发送邀请码', shareText: '在 Moments 和我一起坚持这个习惯 — 邀请码 {code}', leave: '退出', newT: '开始一个习惯', namePh: '例如：读10页书', start: '开始', joinT: '有邀请码？', codePh: 'ABC123', join: '加入', empty: '还没有习惯。开始一个，把邀请码发给朋友。', who: '今天 {n} 人中 {d} 人完成', err: '没成功，再试一次', no_code: '没有这个邀请码的习惯', full: '人数已满（12人）', too_many: '你已经有10个习惯' },
};
export const hs = (lang, k) => ((S[lang] && S[lang][k]) || S.en[k]);

// kept as emoji keys (old habits have them), drawn as outline icons (ui/Glyph)
const EMOJIS = ['🔥', '📖', '🏃', '💧', '🧘', '🗣️', '🎸', '🥗', '😴', '✍️'];
const reasonOf = (r) => (r && r.reason && S.en[r.reason] ? r.reason : 'err');

const Card = ({ h, lang, onTick, onLeave }) => {
  const me = (h.members || []).find((m) => m.me) || {};
  const did = (h.members || []).filter((m) => m.done).length;
  const streak = me.streak || 0;
  return (
    <View style={{ borderRadius: 20, borderWidth: 1, borderColor: me.done ? C.green : C.line, backgroundColor: C.glass, padding: 14, marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginEnd: 10 }}>
          <Glyph e={h.emoji || '🔥'} size={20} color={C.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '900' }} numberOfLines={2}>{h.name}</Text>
          <Text style={{ color: streak ? '#E8590C' : C.dim, fontSize: 13, fontWeight: '800', marginTop: 2 }}>
            {streak > 1 ? hs(lang, 'days').replace('{n}', String(streak)) : streak === 1 ? hs(lang, 'day1') : hs(lang, 'none')}
          </Text>
        </View>
      </View>
      {/* who is on it, and who already did it today */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        {(h.members || []).slice(0, 8).map((m, i) => (
          <View key={m.id} style={{ marginStart: i ? -8 : 0 }}>
            <Image source={{ uri: m.avatar || AV_NEUTRAL }} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: m.done ? C.green : C.bg2, opacity: m.done ? 1 : 0.55 }} />
          </View>
        ))}
        <Text style={{ color: C.dim, fontSize: 12.5, fontWeight: '700', marginStart: 10, flex: 1 }} numberOfLines={1}>
          {hs(lang, 'who').replace('{d}', String(did)).replace('{n}', String((h.members || []).length))}
        </Text>
      </View>
      <Pressable onPress={() => onTick(h, !me.done)} accessibilityRole="checkbox" accessibilityState={{ checked: !!me.done }} style={{ marginTop: 12 }}>
        <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: me.done ? C.greenSoft : C.purple }}>
          <Text style={{ color: me.done ? C.green : '#FFF', fontSize: 15, fontWeight: '900' }}>{hs(lang, me.done ? 'undo' : 'done')}</Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <Pressable onPress={() => { tapLight(); shareLink({ url: appLink({ tab: 'PROFILE' }), title: h.name, text: hs(lang, 'shareText').replace('{code}', h.code) + ' · ' + h.name }); }} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={{ color: C.faint, fontSize: 12, fontWeight: '800' }}>{hs(lang, 'code') + ' '}</Text>
          <Text selectable style={{ color: C.text, fontSize: 14, fontWeight: '900', letterSpacing: 2 }}>{h.code}</Text>
          <Text style={{ color: C.purple, fontSize: 12.5, fontWeight: '900', marginStart: 10 }}>{hs(lang, 'share')}</Text>
        </Pressable>
        <Pressable onPress={() => onLeave(h)} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: C.faint, fontSize: 12.5, fontWeight: '800' }}>{hs(lang, 'leave')}</Text>
        </Pressable>
      </View>
    </View>
  );
};

export const HabitsTogether = ({ onClose, lang }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🔥');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => myHabits().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const run = async (key, fn) => {
    setBusy(key); setErr(null);
    try {
      const r = await fn();
      if (r && r.ok === false) setErr(hs(lang, reasonOf(r)));
      else { tapSuccess(); await load(); return true; }
    } catch (e) { setErr(hs(lang, 'err')); }
    finally { setBusy(null); }
    return false;
  };
  const tick = (h, on) => {
    tapSelection();
    // seen at once; the server's answer follows
    setList((l) => (l || []).map((x) => (x.id !== h.id ? x : { ...x, members: x.members.map((m) => (m.me ? { ...m, done: on, streak: Math.max(0, (m.streak || 0) + (on ? 1 : -1)) } : m)) })));
    checkHabit(h.id, on).then(load).catch(() => { setErr(hs(lang, 'err')); load(); });
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 }}>{hs(lang, 'title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14, marginTop: 4, lineHeight: 20 }}>{hs(lang, 'sub')}</Text>

          {list == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 30 }} />
            : list.length ? list.map((h) => <Card key={h.id} h={h} lang={lang} onTick={tick} onLeave={(x) => run('leave', () => leaveHabit(x.id))} />)
              : <Text style={{ color: C.dim, fontSize: 14, marginTop: 18, lineHeight: 20 }}>{hs(lang, 'empty')}</Text>}

          {err ? <Text style={{ color: C.coral, fontSize: 13.5, fontWeight: '700', marginTop: 14 }}>{err}</Text> : null}

          {/* start one: a name, an emoji, done */}
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 26 }}>{hs(lang, 'newT').toUpperCase()}</Text>
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => { tapSelection(); setEmoji(e); }} accessibilityRole="radio" accessibilityState={{ selected: emoji === e }} style={{ marginEnd: 6 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: emoji === e ? C.text : C.line, backgroundColor: emoji === e ? C.text : 'transparent' }}>
                  <Glyph e={e} size={19} color={emoji === e ? C.bg : C.dim} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <TextInput value={name} onChangeText={setName} maxLength={60} placeholder={hs(lang, 'namePh')} placeholderTextColor={C.faint}
              style={{ flex: 1, color: C.text, fontSize: 15, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingHorizontal: 14, paddingVertical: 12, outlineStyle: 'none' }} />
            <Pressable onPress={async () => { if (name.trim() && await run('new', () => createHabit(name.trim(), emoji))) setName(''); }} disabled={!name.trim() || !!busy} accessibilityRole="button" style={{ marginStart: 8 }}>
              <View style={{ borderRadius: 999, backgroundColor: name.trim() ? C.text : C.glassHi, paddingHorizontal: 18, paddingVertical: 13 }}>
                {busy === 'new' ? <ActivityIndicator color={C.bg} /> : <Text style={{ color: name.trim() ? C.bg : C.dim, fontSize: 14.5, fontWeight: '700' }}>{hs(lang, 'start')}</Text>}
              </View>
            </Pressable>
          </View>

          {/* or join a friend's, with the code they sent */}
          <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1, marginTop: 22 }}>{hs(lang, 'joinT').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} autoCapitalize="characters" autoCorrect={false} placeholder={hs(lang, 'codePh')} placeholderTextColor={C.faint}
              style={{ flex: 1, color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: 4, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, paddingHorizontal: 14, paddingVertical: 11, outlineStyle: 'none' }} />
            <Pressable onPress={async () => { if (code.length === 6 && await run('join', () => joinHabit(code))) setCode(''); }} disabled={code.length !== 6 || !!busy} accessibilityRole="button" style={{ marginStart: 8 }}>
              <View style={{ borderRadius: 999, backgroundColor: code.length === 6 ? C.text : C.glassHi, paddingHorizontal: 18, paddingVertical: 13 }}>
                {busy === 'join' ? <ActivityIndicator color={C.bg} /> : <Text style={{ color: C.bg, fontSize: 14.5, fontWeight: '900' }}>{hs(lang, 'join')}</Text>}
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
