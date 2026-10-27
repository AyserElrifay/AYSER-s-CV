import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../constants/theme';
import { myJourney, journeyBook, money } from '../services/offers';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { myWelcomeOffer } from '../services/membership';
import { myLevel2Offer } from '../services/passport';
import { useSheetBack } from '../hooks/useSheetBack';

/* ─── THE LEARNING JOURNEY ────────────────────────────────────────────
   Ayser: the workshops as one straight path — Level 1 → 2 → 3 → 4 — so
   nobody has to decide what comes next. Read top to bottom: where you
   are, one thing to do now, and what opens after. Levels below yours are
   done and folded; yours is open, with its workshops and one button;
   the ones above are visible but locked, so you can see where it goes.
   The server decides all of it (my_journey, journey_book in RUN_ME.sql):
   a locked workshop cannot be booked from anywhere. A ticket is paid by
   InstaPay or Vodafone Cash and the transfer's reference is given here;
   the team checks it. When they mark you as having finished a workshop
   at your level, the next one opens — and this page says so once. */

const S = {
  en: ['Your journey', 'One step at a time. Finish a workshop and the next level opens.', 'Level {n}', 'You are here', 'Opens after level {n}', 'Done', 'Workshops for this level are on their way.', 'Book · {p}', 'Send {p} by InstaPay or Vodafone Cash, then write the transfer’s reference here.', 'Transfer reference', 'Book my seat', 'Booked ✓ We will confirm once the payment is checked.', 'Confirmed ✓', 'Checking your payment', 'Payment details are being set up — try again soon.', 'It did not go through. Try again.', 'Level {n} is open 🎉', 'Level {n} of {t}'],
  ar: ['رحلتك', 'خطوة خطوة. خلّص ورشة والمستوى اللي بعده يفتح.', 'المستوى {n}', 'إنت هنا', 'يفتح بعد المستوى {n}', 'خلصته', 'ورش المستوى ده جاية قريب.', 'احجز · {p}', 'ابعت {p} بإنستاباي أو فودافون كاش، واكتب رقم التحويل هنا.', 'رقم التحويل', 'احجز مكاني', 'اتحجز ✓ هنأكدلك أول ما نراجع التحويل.', 'اتأكد ✓', 'بنراجع التحويل', 'بيانات الدفع لسه بتتجهز — جرّب كمان شوية.', 'ماتبعتش. جرّب تاني.', 'المستوى {n} اتفتح 🎉', 'المستوى {n} من {t}'],
  cs: ['Tvoje cesta', 'Krok za krokem. Dokonči workshop a otevře se další úroveň.', 'Úroveň {n}', 'Tady jsi', 'Otevře se po úrovni {n}', 'Hotovo', 'Workshopy pro tuto úroveň se chystají.', 'Rezervovat · {p}', 'Pošli {p} přes InstaPay nebo Vodafone Cash a napiš sem číslo platby.', 'Číslo platby', 'Rezervovat místo', 'Rezervováno ✓ Potvrdíme po kontrole platby.', 'Potvrzeno ✓', 'Kontrolujeme platbu', 'Platební údaje se připravují — zkus to brzy znovu.', 'Nepodařilo se. Zkus to znovu.', 'Úroveň {n} je otevřená 🎉', 'Úroveň {n} z {t}'],
  es: ['Tu camino', 'Paso a paso. Termina un taller y se abre el siguiente nivel.', 'Nivel {n}', 'Estás aquí', 'Se abre tras el nivel {n}', 'Hecho', 'Los talleres de este nivel llegan pronto.', 'Reservar · {p}', 'Envía {p} por InstaPay o Vodafone Cash y escribe aquí la referencia.', 'Referencia de la transferencia', 'Reservar mi plaza', 'Reservado ✓ Confirmaremos al revisar el pago.', 'Confirmado ✓', 'Revisando tu pago', 'Los datos de pago se están preparando; prueba pronto.', 'No se envió. Inténtalo de nuevo.', 'El nivel {n} está abierto 🎉', 'Nivel {n} de {t}'],
  et: ['Sinu teekond', 'Samm sammult. Lõpeta töötuba ja järgmine tase avaneb.', 'Tase {n}', 'Sa oled siin', 'Avaneb pärast taset {n}', 'Tehtud', 'Selle taseme töötoad on tulekul.', 'Broneeri · {p}', 'Saada {p} InstaPay või Vodafone Cashiga ja kirjuta siia makse viide.', 'Makse viide', 'Broneeri koht', 'Broneeritud ✓ Kinnitame pärast makse kontrolli.', 'Kinnitatud ✓', 'Kontrollime makset', 'Makseandmed on valmimas — proovi varsti uuesti.', 'Ei läinud läbi. Proovi uuesti.', 'Tase {n} on avatud 🎉', 'Tase {n} / {t}'],
  fr: ['Ton parcours', 'Une étape à la fois. Termine un atelier et le niveau suivant s’ouvre.', 'Niveau {n}', 'Tu es ici', 'S’ouvre après le niveau {n}', 'Fait', 'Les ateliers de ce niveau arrivent bientôt.', 'Réserver · {p}', 'Envoie {p} par InstaPay ou Vodafone Cash, puis écris ici la référence du virement.', 'Référence du virement', 'Réserver ma place', 'Réservé ✓ On confirme dès que le paiement est vérifié.', 'Confirmé ✓', 'Vérification du paiement', 'Les moyens de paiement se préparent — réessaie bientôt.', 'Ça n’est pas passé. Réessaie.', 'Le niveau {n} est ouvert 🎉', 'Niveau {n} sur {t}'],
  hi: ['तुम्हारी यात्रा', 'एक-एक कदम। एक वर्कशॉप पूरी करो और अगला लेवल खुलेगा।', 'लेवल {n}', 'तुम यहाँ हो', 'लेवल {n} के बाद खुलेगा', 'पूरा', 'इस लेवल की वर्कशॉप जल्द आ रही हैं।', 'बुक करो · {p}', '{p} InstaPay या Vodafone Cash से भेजो, फिर यहाँ ट्रांसफ़र का रेफ़रेंस लिखो।', 'ट्रांसफ़र रेफ़रेंस', 'मेरी सीट बुक करो', 'बुक हो गया ✓ पेमेंट जाँचने के बाद पुष्टि करेंगे।', 'पक्का ✓', 'पेमेंट जाँच रहे हैं', 'पेमेंट की जानकारी तैयार हो रही है — थोड़ी देर बाद कोशिश करो।', 'नहीं गया। फिर कोशिश करो।', 'लेवल {n} खुल गया 🎉', 'लेवल {n} / {t}'],
  it: ['Il tuo percorso', 'Un passo alla volta. Finisci un workshop e si apre il livello successivo.', 'Livello {n}', 'Sei qui', 'Si apre dopo il livello {n}', 'Fatto', 'I workshop di questo livello arrivano presto.', 'Prenota · {p}', 'Invia {p} con InstaPay o Vodafone Cash, poi scrivi qui il riferimento del bonifico.', 'Riferimento del bonifico', 'Prenota il mio posto', 'Prenotato ✓ Confermiamo appena verificato il pagamento.', 'Confermato ✓', 'Stiamo verificando il pagamento', 'I dati di pagamento sono in arrivo — riprova presto.', 'Non è andato. Riprova.', 'Il livello {n} è aperto 🎉', 'Livello {n} di {t}'],
  ja: ['あなたの道のり', '一歩ずつ。ワークショップを終えると次のレベルが開きます。', 'レベル {n}', '現在地', 'レベル {n} の後に開きます', '完了', 'このレベルのワークショップは準備中です。', '予約 · {p}', '{p} を InstaPay か Vodafone Cash で送り、振込番号をここに入力してください。', '振込番号', '席を予約', '予約しました ✓ 支払い確認後にお知らせします。', '確定 ✓', '支払いを確認中', '支払い情報を準備中です。少し後でもう一度。', '送れませんでした。もう一度どうぞ。', 'レベル {n} が開きました 🎉', 'レベル {n} / {t}'],
  ko: ['나의 여정', '한 걸음씩. 워크숍을 마치면 다음 레벨이 열려요.', '레벨 {n}', '지금 여기', '레벨 {n} 이후 열려요', '완료', '이 레벨의 워크숍이 곧 열려요.', '예약 · {p}', '{p}을(를) InstaPay나 Vodafone Cash로 보내고, 이체 번호를 여기에 적어 주세요.', '이체 번호', '자리 예약', '예약됨 ✓ 결제 확인 후 확정해 드려요.', '확정 ✓', '결제 확인 중', '결제 정보를 준비 중이에요 — 잠시 후 다시 해 주세요.', '전송되지 않았어요. 다시 해 주세요.', '레벨 {n}이 열렸어요 🎉', '레벨 {n} / {t}'],
  nl: ['Jouw reis', 'Stap voor stap. Rond een workshop af en het volgende niveau gaat open.', 'Niveau {n}', 'Je bent hier', 'Opent na niveau {n}', 'Klaar', 'Workshops voor dit niveau komen eraan.', 'Boeken · {p}', 'Stuur {p} via InstaPay of Vodafone Cash en schrijf hier de referentie.', 'Referentie van de overboeking', 'Mijn plek boeken', 'Geboekt ✓ We bevestigen zodra de betaling is gecontroleerd.', 'Bevestigd ✓', 'Betaling wordt gecontroleerd', 'Betaalgegevens worden klaargezet — probeer het straks.', 'Het lukte niet. Probeer opnieuw.', 'Niveau {n} is open 🎉', 'Niveau {n} van {t}'],
  pt: ['A tua jornada', 'Um passo de cada vez. Termina um workshop e abre o nível seguinte.', 'Nível {n}', 'Estás aqui', 'Abre depois do nível {n}', 'Feito', 'Os workshops deste nível estão a chegar.', 'Reservar · {p}', 'Envia {p} por InstaPay ou Vodafone Cash e escreve aqui a referência.', 'Referência da transferência', 'Reservar o meu lugar', 'Reservado ✓ Confirmamos quando o pagamento for verificado.', 'Confirmado ✓', 'A verificar o pagamento', 'Os dados de pagamento estão a ser preparados — tenta daqui a pouco.', 'Não foi. Tenta outra vez.', 'O nível {n} está aberto 🎉', 'Nível {n} de {t}'],
  ro: ['Drumul tău', 'Pas cu pas. Termină un atelier și se deschide nivelul următor.', 'Nivelul {n}', 'Ești aici', 'Se deschide după nivelul {n}', 'Gata', 'Atelierele acestui nivel vin în curând.', 'Rezervă · {p}', 'Trimite {p} prin InstaPay sau Vodafone Cash, apoi scrie aici referința.', 'Referința transferului', 'Rezervă-mi locul', 'Rezervat ✓ Confirmăm după ce verificăm plata.', 'Confirmat ✓', 'Verificăm plata', 'Datele de plată se pregătesc — încearcă în curând.', 'Nu a mers. Încearcă din nou.', 'Nivelul {n} e deschis 🎉', 'Nivelul {n} din {t}'],
  ru: ['Твой путь', 'Шаг за шагом. Пройди мастер-класс — откроется следующий уровень.', 'Уровень {n}', 'Ты здесь', 'Откроется после уровня {n}', 'Пройдено', 'Мастер-классы этого уровня скоро появятся.', 'Записаться · {p}', 'Отправь {p} через InstaPay или Vodafone Cash и впиши сюда номер перевода.', 'Номер перевода', 'Записаться', 'Записан ✓ Подтвердим после проверки оплаты.', 'Подтверждено ✓', 'Проверяем оплату', 'Платёжные данные готовятся — попробуй чуть позже.', 'Не отправилось. Попробуй ещё раз.', 'Уровень {n} открыт 🎉', 'Уровень {n} из {t}'],
  tr: ['Yolculuğun', 'Adım adım. Bir atölyeyi bitir, sonraki seviye açılsın.', 'Seviye {n}', 'Buradasın', 'Seviye {n} sonrası açılır', 'Bitti', 'Bu seviyenin atölyeleri yolda.', 'Ayırt · {p}', '{p} tutarını InstaPay ya da Vodafone Cash ile gönder, sonra havale numarasını buraya yaz.', 'Havale numarası', 'Yerimi ayırt', 'Ayrıldı ✓ Ödeme kontrol edilince onaylayacağız.', 'Onaylandı ✓', 'Ödeme kontrol ediliyor', 'Ödeme bilgileri hazırlanıyor — birazdan tekrar dene.', 'Gitmedi. Tekrar dene.', 'Seviye {n} açıldı 🎉', 'Seviye {n} / {t}'],
  uk: ['Твій шлях', 'Крок за кроком. Пройди майстер-клас — відкриється наступний рівень.', 'Рівень {n}', 'Ти тут', 'Відкриється після рівня {n}', 'Пройдено', 'Майстер-класи цього рівня скоро з’являться.', 'Записатися · {p}', 'Надішли {p} через InstaPay або Vodafone Cash і впиши сюди номер переказу.', 'Номер переказу', 'Записатися', 'Записано ✓ Підтвердимо після перевірки оплати.', 'Підтверджено ✓', 'Перевіряємо оплату', 'Платіжні дані готуються — спробуй трохи згодом.', 'Не вийшло. Спробуй ще раз.', 'Рівень {n} відкрито 🎉', 'Рівень {n} з {t}'],
  zh: ['你的旅程', '一步一步来。完成一个工作坊，下一级就会开启。', '第 {n} 级', '你在这里', '完成第 {n} 级后开启', '已完成', '这一级的工作坊即将推出。', '预订 · {p}', '用 InstaPay 或 Vodafone Cash 转账 {p}，然后在这里填写转账编号。', '转账编号', '预订我的位置', '已预订 ✓ 核对付款后我们会确认。', '已确认 ✓', '正在核对付款', '付款信息正在准备中，请稍后再试。', '没有发送成功，再试一次。', '第 {n} 级已开启 🎉', '第 {n} 级 / 共 {t} 级'],
};
const K = ['title', 'sub', 'level', 'here', 'locked', 'done', 'none', 'book', 'pay', 'ref', 'send', 'sent', 'paid', 'checking', 'paysoon', 'err', 'up', 'of'];
export const jw = (lang, k, vars) => {
  const row = S[lang] || S.en; const i = K.indexOf(k);
  let s = row[i] || S.en[i] || '';
  // Arabic reads its own digits, like the prices beside them
  const num = (x) => (lang === 'ar' ? String(x).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : String(x));
  Object.keys(vars || {}).forEach((v) => { s = s.replace('{' + v + '}', num(vars[v])); });
  return s;
};

const SEEN = 'mm.journey.seen';
const seen = () => { try { return Number(localStorage.getItem(SEEN)) || 1; } catch (e) { return 1; } };

/* the entry on the Together page: where you are, one tap to the map */
export const JourneyCard = ({ lang, onOpen }) => {
  const [j, setJ] = useState(null);
  useEffect(() => { myJourney().then((r) => setJ(r && r.levels ? r : null)).catch(() => {}); }, []);
  if (!j || !Object.keys(j.levels).length) return null;
  const fresh = j.level > seen();
  return (
    <Pressable onPress={() => { tapLight(); onOpen(); }} accessibilityRole="button" style={{ marginBottom: 16 }}>
      <View style={{ borderRadius: 20, padding: 16, backgroundColor: C.purple }}>
        <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '900' }}>{'🧭 ' + jw(lang, 'title')}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, marginTop: 4 }}>{fresh ? jw(lang, 'up', { n: j.level }) : jw(lang, 'of', { n: j.level, t: j.top })}</Text>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 12, overflow: 'hidden' }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: '#FFF', width: Math.round(((j.level - 1) / Math.max(1, j.top)) * 100) + '%' }} />
        </View>
      </View>
    </Pressable>
  );
};

const when = (iso, lang) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return ''; }
};

export const JourneyMap = ({ lang, onClose }) => {
  useSheetBack(onClose);
  const insets = useSafeAreaInsets();
  const [j, setJ] = useState(null);
  const [open, setOpen] = useState(null);           // the workshop whose payment panel is open
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [cheer, setCheer] = useState(null);         // the level that just opened, said once
  const pop = useRef(new Animated.Value(0)).current;

  const load = () => myJourney().then((r) => {
    if (!r || !r.levels) { setJ(false); return; }
    setJ(r);
    if (r.level > seen()) {
      setCheer(r.level);
      try { localStorage.setItem(SEEN, String(r.level)); } catch (e) {}
      tapSuccess();
      Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
  }).catch(() => setJ(false));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // a new VIP's welcome 30% off a first Level 1 — journey_book takes it off; this only shows it
  const [offer, setOffer] = useState(null);
  // and ten passport stamps: 30% off a Level 2
  const [l2, setL2] = useState(null);
  useEffect(() => {
    myWelcomeOffer().then((o) => setOffer(o && o.live ? o : null));
    myLevel2Offer().then((o) => setL2(o && o.live ? o : null));
  }, []);
  const off = (n) => (n === 1 && offer) || (n === 2 && l2) || null;
  const cost = (w, n) => (off(n) ? Math.round(Number(w.price) * (100 - (off(n).pct || 30)) / 100) : w.price);
  const shown = (w, n) => money(cost(w, n), w.currency, lang) + (off(n) && w.price ? (lang === 'ar' ? ' (خصم ٣٠٪)' : ' (−' + (off(n).pct || 30) + '%)') : '');

  const pay = j && j.pay && typeof j.pay === 'object' ? j.pay : null;
  const book = async (w) => {
    if (busy) return;
    if (ref.trim().length < 4) { setMsg(jw(lang, 'ref')); return; }
    tapMedium(); setBusy(true); setMsg(null);
    const r = await journeyBook(w.id, ref.trim());
    setBusy(false);
    if (r && r.ok) { tapSuccess(); setOpen(null); setRef(''); setMsg(jw(lang, 'sent')); if (r.discount) { setOffer(null); setL2(null); } load(); }
    else setMsg(jw(lang, 'err'));
  };

  const levels = j ? Array.from({ length: j.top }, (_, i) => i + 1) : [];
  const title = (w) => (lang === 'ar' && w.title_ar ? w.title_ar : w.title);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
            <Ionicons name="chevron-down" size={26} color={C.text} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 6, paddingBottom: insets.bottom + 40 }}>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '900' }}>{jw(lang, 'title')}</Text>
          <Text style={{ color: C.dim, fontSize: 14.5, lineHeight: 21, marginTop: 4 }}>{jw(lang, 'sub')}</Text>

          {cheer ? (
            <Animated.View style={{ marginTop: 16, borderRadius: 18, padding: 16, backgroundColor: C.greenSoft, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }], opacity: pop }}>
              <Text style={{ color: C.green, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>{jw(lang, 'up', { n: cheer })}</Text>
            </Animated.View>
          ) : null}

          {j == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} /> : j === false ? (
            <Text style={{ color: C.dim, fontSize: 14, marginTop: 30 }}>{jw(lang, 'err')}</Text>
          ) : (
            <>
              {/* how far: one bar, one sentence */}
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 20 }}>{jw(lang, 'of', { n: j.level, t: j.top })}</Text>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: C.glassHi, marginTop: 8, overflow: 'hidden' }}>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: C.purple, width: Math.round(((j.level - 1) / Math.max(1, j.top)) * 100) + '%' }} />
              </View>

              <View style={{ marginTop: 22 }}>
                {levels.map((n, idx) => {
                  const done = n < j.level, here = n === j.level, locked = n > j.level;
                  const list = j.levels[String(n)] || [];
                  return (
                    <View key={n} style={{ flexDirection: 'row' }}>
                      {/* the path: a node, and the line down to the next */}
                      <View style={{ width: 40, alignItems: 'center' }}>
                        <View style={{ width: here ? 36 : 28, height: here ? 36 : 28, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                          backgroundColor: done ? C.green : here ? C.purple : C.glassHi, marginTop: here ? 0 : 4 }}>
                          {done ? <Ionicons name="checkmark" size={16} color="#FFF" />
                            : locked ? <Ionicons name="lock-closed" size={13} color={C.faint} />
                            : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '900' }}>{lang === 'ar' ? '٠١٢٣٤٥٦٧٨٩'[n] || n : n}</Text>}
                        </View>
                        {idx < levels.length - 1 ? <View style={{ flex: 1, width: 2, minHeight: 24, backgroundColor: done ? C.green : C.line, marginVertical: 4 }} /> : null}
                      </View>

                      <View style={{ flex: 1, minWidth: 0, marginStart: 12, paddingBottom: 22, opacity: locked ? 0.5 : 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
                          <Text style={{ color: C.text, fontSize: here ? 19 : 16, fontWeight: '900' }}>{jw(lang, 'level', { n })}</Text>
                          {here ? (
                            <View style={{ marginStart: 8, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: C.purpleSoft }}>
                              <Text style={{ color: C.purple, fontSize: 12, fontWeight: '800' }}>{jw(lang, 'here')}</Text>
                            </View>
                          ) : null}
                        </View>
                        {done ? <Text style={{ color: C.green, fontSize: 13.5, fontWeight: '700' }}>{jw(lang, 'done') + ' ✓'}</Text> : null}
                        {locked ? <Text style={{ color: C.dim, fontSize: 13.5 }}>{'🔒 ' + jw(lang, 'locked', { n: n - 1 })}</Text> : null}

                        {/* your level: its workshops, one button each */}
                        {here && !list.length ? <Text style={{ color: C.dim, fontSize: 14, marginTop: 6 }}>{jw(lang, 'none')}</Text> : null}
                        {!done ? list.map((w) => (
                          <View key={w.id} style={{ marginTop: 10, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 14 }}>
                            <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '800' }} numberOfLines={2}>{title(w)}</Text>
                            <Text style={{ color: C.dim, fontSize: 13, marginTop: 3 }} numberOfLines={1}>
                              {[when(w.starts_at, lang), w.city, money(cost(w, n), w.currency, lang)].filter(Boolean).join(' · ')}
                            </Text>
                            {here && w.status === 'live' ? (
                              w.mine === 'paid' || w.mine === 'attended' ? <Text style={{ color: C.green, fontSize: 14, fontWeight: '800', marginTop: 10 }}>{jw(lang, 'paid')}</Text>
                              : w.mine === 'reserved' ? <Text style={{ color: C.dim, fontSize: 14, fontWeight: '700', marginTop: 10 }}>{'⏳ ' + jw(lang, 'checking')}</Text>
                              : open === w.id ? (
                                <View style={{ marginTop: 10 }}>
                                  {pay ? (
                                    <>
                                      <Text style={{ color: C.text, fontSize: 13.5, lineHeight: 19 }}>{jw(lang, 'pay', { p: money(cost(w, n), w.currency, lang) })}</Text>
                                      {pay.instapay ? <Text selectable style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 8 }}>{'InstaPay · ' + pay.instapay}</Text> : null}
                                      {pay.vodafone ? <Text selectable style={{ color: C.text, fontSize: 15, fontWeight: '800', marginTop: 4 }}>{'Vodafone Cash · ' + pay.vodafone}</Text> : null}
                                      <TextInput value={ref} onChangeText={setRef} placeholder={jw(lang, 'ref')} placeholderTextColor={C.faint} maxLength={60} autoCapitalize="characters"
                                        style={{ color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, marginTop: 10, textAlign: lang === 'ar' ? 'right' : 'left' }} />
                                      <Pressable onPress={() => book(w)} disabled={busy} accessibilityRole="button" style={{ marginTop: 10 }}>
                                        <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.purple, opacity: busy ? 0.6 : 1 }}>
                                          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>{jw(lang, 'send')}</Text>}
                                        </View>
                                      </Pressable>
                                    </>
                                  ) : <Text style={{ color: C.dim, fontSize: 13.5 }}>{jw(lang, 'paysoon')}</Text>}
                                </View>
                              ) : (
                                <Pressable onPress={() => { tapLight(); setMsg(null); setRef(''); setOpen(w.id); }} accessibilityRole="button" style={{ marginTop: 12 }}>
                                  <View style={{ borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: C.purple }}>
                                    <Text style={{ color: '#FFF', fontSize: 14.5, fontWeight: '800' }}>{jw(lang, 'book', { p: shown(w, n) })}</Text>
                                  </View>
                                </Pressable>
                              )
                            ) : null}
                          </View>
                        )) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
              {msg ? <Text style={{ color: C.text, fontSize: 13.5, textAlign: 'center' }}>{msg}</Text> : null}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};
