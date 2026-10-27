import React, { useEffect, useRef, useState } from 'react';
import { titleFor } from '../lib/activityPins';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { DECK, BADGES, badgeName, cardText } from '../constants/activityDeck';
import { myBuddies, myConversations, buddyThread, dmState, buddyPing, myNextEvents, passport, needPlus } from '../services/live';
import { fetchMessages, sendMessage, subscribeMessages } from '../services/messages';
import { Face } from '../ui/Face';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { pw, leftText } from '../constants/passportWords';
import { myPassport, setDmOpen } from '../services/passport';
import { askUpgrade } from '../services/membership';
import { goToTab } from '../lib/mapBus';
import { MatchBadge } from '../ui/MatchBadge';
import { vibeMatches } from '../services/scale';
import { myChats, premiumOf } from '../services/midnight';
import { MidnightTable, mw, Mark } from './MidnightTable';

/* ─── MOMENTS BUDDIES ─────────────────────────────────────────────────
   Earned connection, not a messaging app. Strangers can never write to
   each other: two people who met at a table and BOTH tapped Connect
   within 48 hours are Buddies, and only Buddies get this small,
   text-only chat — plus "Ping to Join", which invites a buddy to the
   next table you booked. The one other door is prompt-first: a reply
   to somebody's Daily Moment answer, or an icebreaker card, and then
   nothing more until they answer ("Practice partners" below). Chat is
   part of Moments Black. Every rule is the server's (RUN_ME.sql). */

const S = {
  en: ['Moments Buddies', 'People you met at a table and both chose to keep.', 'No buddies yet. After an event, tap Connect on the people you liked meeting — if they tap you too, they show up here.', 'Your passport', '{n} buddies', 'Memories', 'Write a message…', 'Ping to Join', 'Invite {n} to one of your next tables:', 'Nothing booked yet — book a seat first, then invite.', 'Invited ✓', 'Chat is part of Moments Black.', 'See Moments Black', 'Waiting for their answer — you can write again once they reply.', 'Replying to their Daily Moment: “{t}”', 'Opened with an icebreaker: “{t}”', 'Remove buddy', 'It did not go through. Try again.', 'Practice partners', 'Vibe badges people gave you'],
  ar: ['Moments Buddies', 'ناس قابلتهم على ترابيزة واتنينكوا اخترتوا تفضلوا على تواصل.', 'لسه مفيش Buddies. بعد أي خروجة، دوس "تواصل" على اللي حبيت تقابلهم — لو هما كمان داسوا، هيظهروا هنا.', 'الباسبور بتاعك', '{n} Buddies', 'ذكريات', 'اكتب رسالة…', 'ادعوه ييجي', 'ادعي {n} لترابيزة من اللي جايين:', 'لسه ماحجزتش حاجة — احجز مكان الأول وبعدين ادعي.', 'اتبعتت الدعوة ✓', 'الشات جزء من Moments Black.', 'شوف Moments Black', 'مستنيين ردّهم — تقدر تكتب تاني لما يردّوا.', 'ردّ على الـDaily Moment بتاعهم: «{t}»', 'بدأت بكارت تعارف: «{t}»', 'شيل من الـBuddies', 'ماتبعتش. جرّب تاني.', 'شركاء ممارسة', 'فايب بادجز اتدّتلك'],
  cs: ['Moments Buddies', 'Lidé, které jsi potkal/a u stolu, a oba jste se rozhodli zůstat v kontaktu.', 'Zatím žádní buddies. Po akci klepni na Spojit u lidí, které jsi rád/a potkal/a — když klepnou i oni, objeví se tady.', 'Tvůj pas', '{n} buddies', 'Vzpomínky', 'Napiš zprávu…', 'Pozvat', 'Pozvi {n} k jednomu z tvých dalších stolů:', 'Zatím nic rezervováno — nejdřív si rezervuj místo.', 'Pozváno ✓', 'Chat je součástí Moments Black.', 'Zobrazit Moments Black', 'Čeká se na odpověď — napsat můžeš, až odpoví.', 'Odpověď na jejich Daily Moment: „{t}“', 'Začátek kartou: „{t}“', 'Odebrat', 'Nepodařilo se. Zkus to znovu.', 'Parťáci na procvičování', 'Odznaky, které jsi dostal/a'],
  es: ['Moments Buddies', 'Gente que conociste en una mesa y que ambos decidisteis conservar.', 'Aún no tienes buddies. Después de un evento, toca Conectar en quien te gustó conocer; si te tocan también, aparecen aquí.', 'Tu pasaporte', '{n} buddies', 'Recuerdos', 'Escribe un mensaje…', 'Invitar', 'Invita a {n} a una de tus próximas mesas:', 'Aún no has reservado nada: reserva primero y luego invita.', 'Invitado ✓', 'El chat es parte de Moments Black.', 'Ver Moments Black', 'Esperando su respuesta: podrás escribir de nuevo cuando responda.', 'Respondiendo a su Daily Moment: «{t}»', 'Empezó con una carta: «{t}»', 'Quitar buddy', 'No se envió. Inténtalo de nuevo.', 'Compañeros de práctica', 'Insignias que te dieron'],
  et: ['Moments Buddies', 'Inimesed, keda kohtasid laua taga ja kellega mõlemad tahtsite ühendust hoida.', 'Buddies’id veel pole. Pärast üritust puuduta Ühenda — kui nemad ka, ilmuvad nad siia.', 'Sinu pass', '{n} buddies’t', 'Mälestused', 'Kirjuta sõnum…', 'Kutsu', 'Kutsu {n} oma järgmise laua juurde:', 'Midagi pole veel broneeritud — broneeri enne koht.', 'Kutsutud ✓', 'Vestlus on Moments Blacki osa.', 'Vaata Moments Black', 'Ootame vastust — saad uuesti kirjutada, kui nad vastavad.', 'Vastus nende Daily Momentile: „{t}“', 'Algas kaardiga: „{t}“', 'Eemalda', 'Ei läinud läbi. Proovi uuesti.', 'Harjutuspartnerid', 'Sulle antud märgid'],
  fr: ['Moments Buddies', 'Des gens rencontrés à une table, et que vous avez choisi tous les deux de garder.', 'Pas encore de buddies. Après un événement, touche Connecter sur ceux que tu as aimé rencontrer — s’ils te touchent aussi, ils apparaissent ici.', 'Ton passeport', '{n} buddies', 'Souvenirs', 'Écris un message…', 'Inviter', 'Invite {n} à une de tes prochaines tables :', 'Rien de réservé — réserve d’abord une place.', 'Invité ✓', 'Le chat fait partie de Moments Black.', 'Voir Moments Black', 'En attente de leur réponse — tu pourras réécrire après.', 'En réponse à leur Daily Moment : « {t} »', 'Commencé avec une carte : « {t} »', 'Retirer', 'Ça n’est pas passé. Réessaie.', 'Partenaires de pratique', 'Les badges qu’on t’a donnés'],
  hi: ['Moments Buddies', 'जिनसे टेबल पर मिले और दोनों ने जुड़े रहना चुना।', 'अभी कोई बडी नहीं। किसी इवेंट के बाद जिनसे मिलकर अच्छा लगा उन पर कनेक्ट दबाओ — वे भी दबाएँ तो यहाँ दिखेंगे।', 'तुम्हारा पासपोर्ट', '{n} बडीज़', 'यादें', 'मैसेज लिखो…', 'बुलाओ', '{n} को अपनी अगली टेबल पर बुलाओ:', 'अभी कुछ बुक नहीं — पहले सीट बुक करो।', 'बुलाया ✓', 'चैट Moments Black का हिस्सा है।', 'Moments Black देखो', 'उनके जवाब का इंतज़ार — जवाब आने पर फिर लिख सकोगे।', 'उनके Daily Moment का जवाब: “{t}”', 'आइसब्रेकर कार्ड से शुरू: “{t}”', 'बडी हटाओ', 'नहीं गया। फिर कोशिश करो।', 'प्रैक्टिस पार्टनर', 'तुम्हें मिले वाइब बैज'],
  it: ['Moments Buddies', 'Persone conosciute a un tavolo che avete scelto entrambi di tenere.', 'Ancora nessun buddy. Dopo un evento tocca Connetti su chi ti è piaciuto conoscere: se toccano anche te, appaiono qui.', 'Il tuo passaporto', '{n} buddies', 'Ricordi', 'Scrivi un messaggio…', 'Invita', 'Invita {n} a uno dei tuoi prossimi tavoli:', 'Niente prenotato: prima prenota un posto.', 'Invitato ✓', 'La chat fa parte di Moments Black.', 'Vedi Moments Black', 'In attesa della risposta: potrai riscrivere quando rispondono.', 'Risposta al loro Daily Moment: «{t}»', 'Iniziata con una carta: «{t}»', 'Rimuovi', 'Non è andato. Riprova.', 'Compagni di pratica', 'I badge che ti hanno dato'],
  ja: ['Moments Buddies', 'テーブルで出会い、おたがいにつながると決めた人たち。', 'まだ Buddy はいません。イベントのあと、会えてよかった人に「つながる」を。相手も押すとここに表示されます。', 'あなたのパスポート', 'Buddy {n}人', '思い出', 'メッセージを書く…', '誘う', '{n}さんを次のテーブルに誘う：', 'まだ予約がありません。先に席を予約してね。', '誘いました ✓', 'チャットは Moments Black の機能です。', 'Moments Black を見る', '返事を待っています。返事が来たらまた書けます。', 'Daily Moment への返信：「{t}」', 'アイスブレイクカードから：「{t}」', 'Buddy から外す', '送れませんでした。もう一度どうぞ。', '練習パートナー', 'もらったバッジ'],
  ko: ['Moments Buddies', '테이블에서 만나 서로 계속 연락하기로 한 사람들.', '아직 버디가 없어요. 이벤트 후 만나서 좋았던 사람에게 연결을 누르세요 — 상대도 누르면 여기에 나타나요.', '내 패스포트', '버디 {n}명', '추억', '메시지 쓰기…', '초대하기', '{n}님을 다음 테이블에 초대:', '아직 예약이 없어요 — 먼저 자리를 예약하세요.', '초대함 ✓', '채팅은 Moments Black 기능이에요.', 'Moments Black 보기', '답장을 기다리는 중 — 답이 오면 다시 쓸 수 있어요.', 'Daily Moment에 답장: “{t}”', '아이스브레이커 카드로 시작: “{t}”', '버디 해제', '전송되지 않았어요. 다시 해 주세요.', '연습 파트너', '받은 바이브 배지'],
  nl: ['Moments Buddies', 'Mensen die je aan een tafel ontmoette en die jullie allebei wilden houden.', 'Nog geen buddies. Tik na een event op Verbinden bij wie je leuk vond — tikken zij jou ook, dan staan ze hier.', 'Je paspoort', '{n} buddies', 'Herinneringen', 'Schrijf een bericht…', 'Uitnodigen', 'Nodig {n} uit voor een van je volgende tafels:', 'Nog niets geboekt — boek eerst een plek.', 'Uitgenodigd ✓', 'Chatten hoort bij Moments Black.', 'Bekijk Moments Black', 'Wachten op hun antwoord — daarna kun je weer schrijven.', 'Antwoord op hun Daily Moment: ‘{t}’', 'Begonnen met een kaart: ‘{t}’', 'Verwijderen', 'Het lukte niet. Probeer opnieuw.', 'Oefenpartners', 'Badges die je kreeg'],
  pt: ['Moments Buddies', 'Pessoas que conheceste numa mesa e que ambos quiseram manter.', 'Ainda não tens buddies. Depois de um evento, toca em Ligar em quem gostaste de conhecer — se te tocarem também, aparecem aqui.', 'O teu passaporte', '{n} buddies', 'Memórias', 'Escreve uma mensagem…', 'Convidar', 'Convida {n} para uma das tuas próximas mesas:', 'Ainda não reservaste nada — reserva primeiro.', 'Convidado ✓', 'O chat faz parte do Moments Black.', 'Ver Moments Black', 'À espera da resposta — podes voltar a escrever quando responderem.', 'Resposta ao Daily Moment: «{t}»', 'Começou com uma carta: «{t}»', 'Remover', 'Não foi. Tenta outra vez.', 'Parceiros de prática', 'Badges que te deram'],
  ro: ['Moments Buddies', 'Oameni pe care i-ai cunoscut la o masă și pe care amândoi ați vrut să-i păstrați.', 'Încă nu ai buddies. După un eveniment, atinge Conectează la cei pe care ți-a plăcut să-i cunoști — dacă te ating și ei, apar aici.', 'Pașaportul tău', '{n} buddies', 'Amintiri', 'Scrie un mesaj…', 'Invită', 'Invită-l pe {n} la una dintre mesele tale următoare:', 'Încă nimic rezervat — rezervă întâi un loc.', 'Invitat ✓', 'Chatul face parte din Moments Black.', 'Vezi Moments Black', 'Așteptăm răspunsul — poți scrie din nou după ce răspund.', 'Răspuns la Daily Moment: „{t}”', 'Început cu o carte: „{t}”', 'Elimină', 'Nu a mers. Încearcă din nou.', 'Parteneri de exersat', 'Insigne primite'],
  ru: ['Moments Buddies', 'Люди, с которыми вы познакомились за столом и оба решили остаться на связи.', 'Пока нет buddies. После встречи нажми «Связаться» у тех, с кем было приятно познакомиться — если они тоже нажмут, появятся здесь.', 'Твой паспорт', 'Buddies: {n}', 'Воспоминания', 'Написать сообщение…', 'Позвать', 'Позови {n} за один из твоих следующих столов:', 'Пока ничего не забронировано — сначала забронируй место.', 'Позвали ✓', 'Чат — часть Moments Black.', 'Посмотреть Moments Black', 'Ждём ответа — написать снова можно после него.', 'Ответ на их Daily Moment: «{t}»', 'Началось с карточки: «{t}»', 'Убрать', 'Не отправилось. Попробуй ещё раз.', 'Партнёры по практике', 'Значки, которые тебе подарили'],
  tr: ['Moments Buddies', 'Bir masada tanıştığın ve ikinizin de kalmasını seçtiğiniz kişiler.', 'Henüz buddy yok. Bir etkinlikten sonra tanışmaktan memnun olduklarına Bağlan’a dokun — onlar da dokunursa burada görünürler.', 'Pasaportun', '{n} buddy', 'Anılar', 'Mesaj yaz…', 'Davet et', '{n} kişisini sonraki masalarından birine davet et:', 'Henüz rezervasyon yok — önce yer ayırt.', 'Davet edildi ✓', 'Sohbet Moments Black’un parçası.', 'Moments Black gör', 'Yanıtları bekleniyor — yanıt verince tekrar yazabilirsin.', 'Daily Moment yanıtına cevap: “{t}”', 'Bir kartla başladı: “{t}”', 'Kaldır', 'Gitmedi. Tekrar dene.', 'Pratik arkadaşları', 'Sana verilen rozetler'],
  uk: ['Moments Buddies', 'Люди, з якими ви познайомилися за столом і обоє вирішили лишитися на зв’язку.', 'Поки немає buddies. Після зустрічі торкнися «Зв’язатися» біля тих, з ким було приємно — якщо вони теж, з’являться тут.', 'Твій паспорт', 'Buddies: {n}', 'Спогади', 'Написати повідомлення…', 'Покликати', 'Поклич {n} за один із твоїх наступних столів:', 'Поки нічого не заброньовано — спершу забронюй місце.', 'Покликали ✓', 'Чат — частина Moments Black.', 'Переглянути Moments Black', 'Чекаємо на відповідь — написати знову можна після неї.', 'Відповідь на їхній Daily Moment: «{t}»', 'Почалося з картки: «{t}»', 'Прибрати', 'Не вийшло. Спробуй ще раз.', 'Партнери з практики', 'Значки, які тобі подарували'],
  zh: ['Moments Buddies', '在同一张桌子认识、并且彼此都想保持联系的人。', '还没有 Buddy。活动结束后，对喜欢认识的人点「联系」——对方也点了你，就会出现在这里。', '你的护照', '{n} 位 Buddy', '回忆', '写条消息…', '邀请', '邀请 {n} 来你接下来的一张桌子：', '还没有预订——先订个位置再邀请。', '已邀请 ✓', '聊天是 Moments Black 的功能。', '查看 Moments Black', '等对方回复——回复后你就能再写了。', '回复 TA 的 Daily Moment：「{t}」', '从一张破冰卡开始：「{t}」', '移除', '没有成功，再试一次。', '练习伙伴', '别人送你的徽章'],
};
const K = ['title', 'sub', 'empty', 'pass', 'nBuddies', 'mem', 'say', 'ping', 'pingTo', 'pingNone', 'pinged', 'plus', 'seePlus', 'wait', 'fromAnswer', 'fromCard', 'removed', 'err', 'partners', 'vibes'];
const w = (lang, k, v) => {
  const i = K.indexOf(k);
  let s = (S[lang] || S.en)[i] || S.en[i] || '';
  Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', String(v[x])); });
  return s;
};
const MIDNIGHT = (() => { try { return /[?&]midnight\b/.test(window.location.search); } catch (e) { return false; } })();
const askPlus = () => needPlus({ ok: false, reason: 'plus' }, 'chat');

/* ── the micro-chat: a buddy (other) or a prompt-first thread (threadId) ── */
const Chat = ({ other, threadId, lang, onBack }) => {
  const { user } = useAuth();
  const [st, setSt] = useState(null);
  const [tid, setTid] = useState(threadId || null);
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');
  const [ping, setPing] = useState(null);       // null · list of my next events
  const [pinged, setPinged] = useState({});
  const [err, setErr] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const scroll = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let t = threadId;
      if (!t && other) { const r = await buddyThread(other.id); t = r && r.ok ? r.thread_id : null; }
      if (!alive || !t) return;
      setTid(t);
      dmState(t).then((x) => alive && setSt(x && x.ok ? x : null));
      fetchMessages({ dmThreadId: t }).then((rows) => alive && setMsgs(rows || [])).catch(() => {});
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!tid) return undefined;
    return subscribeMessages({ dmThreadId: tid }, (p) => {
      setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : m.concat(p.new)));
      dmState(tid).then((x) => x && x.ok && setSt(x));
    });
  }, [tid]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !tid) return;
    if (st && !st.plus) { askPlus(); return; }
    tapLight(); setDraft(''); setErr(null);
    try {
      const row = await sendMessage({ dmThreadId: tid, userId: user.id, body });
      setMsgs((m) => (m.some((x) => x.id === row.id) ? m : m.concat(row)));
    } catch (e) { setDraft(body); setErr(w(lang, 'err')); }
    dmState(tid).then((x) => x && x.ok && setSt(x));
  };
  const openPing = async () => { tapLight(); setPing((await myNextEvents()) || []); };
  const doPing = async (e) => {
    tapMedium();
    const r = await buddyPing(person.id, e.kind, e.id);
    if (r && r.ok) { tapSuccess(); setPinged((p) => ({ ...p, [e.id]: true })); } else setErr(w(lang, 'err'));
  };

  const person = (st && st.other) || other || {};
  const op = st && st.opener;
  const opLine = op ? (op.answer ? w(lang, 'fromAnswer', { t: op.answer.body || '' }) : op.card != null && DECK.warm[op.card] ? w(lang, 'fromCard', { t: cardText(DECK.warm[op.card], lang) }) : null) : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="back">
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </Pressable>
        <Face uri={person.avatar_url} name={person.name} size={32} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginStart: 10, flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{person.name}</Text>
          {st && st.other_premium ? <Mark /> : null}
        </View>
        {st && st.buddy ? (
          <Pressable onPress={openPing} accessibilityRole="button">
            <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.purple }}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>{w(lang, 'ping')}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* a Moments+ member inside a pass they earned at the tables: how long it has left */}
      {st && st.plus && !st.vip && st.pass_until && Date.parse(st.pass_until) > now ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, backgroundColor: C.sun }}>
          <Text style={[{ color: '#17131F', fontSize: 13.5, fontWeight: '700' }, NUM]}>{pw(lang, 'left', { t: leftText(Date.parse(st.pass_until) - now, lang) })}</Text>
        </View>
      ) : null}

      {ping ? (
        <View style={{ padding: 16, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.purpleSoft }}>
          <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{w(lang, 'pingTo', { n: person.name || '' })}</Text>
          {!ping.length ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 6 }}>{w(lang, 'pingNone')}</Text> : null}
          {ping.map((e) => (
            <Pressable key={e.kind + e.id} onPress={() => (pinged[e.id] ? null : doPing(e))} accessibilityRole="button" style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line, padding: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14.5, fontWeight: '600' }} numberOfLines={1}>{lang === 'ar' && e.title_ar ? e.title_ar : titleFor(e.title, lang)}</Text>
                  <Text style={[{ color: C.dim, fontSize: 12.5, marginTop: 2 }, NUM]}>{new Date(e.starts_at).toLocaleString(lang === 'ar' ? 'ar-EG' : lang, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Text>
                </View>
                <Text style={{ color: pinged[e.id] ? C.green : C.purple, fontSize: 13.5, fontWeight: '600' }}>{pinged[e.id] ? w(lang, 'pinged') : '→'}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        {opLine ? <Text style={{ color: C.dim, fontSize: 12.5, textAlign: 'center', marginBottom: 10 }}>{opLine}</Text> : null}
        {msgs.map((m) => {
          const mine = m.user_id === (user && user.id);
          return (
            <View key={m.id} style={{ marginTop: 6, alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: mine ? C.purple : C.glass, borderWidth: mine ? 0 : 1, borderColor: C.line }}>
              <Text style={{ color: mine ? '#FFF' : C.text, fontSize: 15, lineHeight: 20 }}>{m.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      {st && !st.plus ? (
        /* Freemium: a free account answers, it never starts — Moments+ starts */
        <View style={{ margin: 16, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass }}>
          <Text style={{ color: C.text, fontSize: 15.5, lineHeight: 22 }}>{mw(lang, 'locked')}</Text>
          <View style={{ flexDirection: 'row', marginTop: 16 }}>
            <Pressable onPress={() => { tapLight(); askUpgrade('member'); }} accessibilityRole="button" style={{ flex: 1, marginEnd: 8 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: C.text }}>
                <Text style={{ color: C.bg, fontSize: 15, fontWeight: '700' }}>{mw(lang, 'seePlus')}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => { tapLight(); goToTab('TOGETHER'); try { window.dispatchEvent(new CustomEvent('mm-close-buddies')); } catch (e) {} }} accessibilityRole="button" style={{ flex: 1 }}>
              <View style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.text }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>{pw(lang, 'find')}</Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : st && !st.can_send ? (
        <Text style={{ color: C.dim, fontSize: 13.5, textAlign: 'center', margin: 16 }}>{w(lang, 'wait')}</Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderColor: C.line }}>
          <TextInput value={draft} onChangeText={setDraft} placeholder={w(lang, 'say')} placeholderTextColor={C.faint} maxLength={500} onSubmitEditing={send}
            style={{ flex: 1, color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.glass, textAlign: lang === 'ar' ? 'right' : 'left' }} />
          <Pressable onPress={send} accessibilityRole="button" accessibilityLabel="send" style={{ marginStart: 8 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-up" size={20} color="#FFF" />
            </View>
          </Pressable>
        </View>
      )}
      {err ? <Text style={{ color: C.coral, fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{err}</Text> : null}
    </View>
  );
};

const Row = ({ person, last, onPress, match, lang, premium }) => (
  <Pressable onPress={onPress} accessibilityRole="button">
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <Face uri={person.avatar_url} name={person.name} size={44} />
      <View style={{ flex: 1, marginStart: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>{person.name}</Text>
          {premium ? <Mark /> : null}
        </View>
        {last ? <Text style={{ color: C.dim, fontSize: 13.5, marginTop: 2 }} numberOfLines={1}>{last}</Text> : null}
        <MatchBadge score={match} lang={lang} style={{ marginTop: 5 }} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </View>
  </Pressable>
);

export const BuddiesSheet = ({ onClose, threadId, other }) => {
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState(null);
  const [convs, setConvs] = useState([]);
  const [pass, setPass] = useState(null);
  const [open, setOpen] = useState(threadId || other ? { threadId, other } : null);
  const [dmOn, setDmOn] = useState(null);
  const [mt, setMt] = useState(false);          // the Midnight Table, inside this sheet
  const [sparks, setSparks] = useState([]);     // Mutual Sparks that are not Table Buddies
  const [prem, setPrem] = useState({});         // who wears the ✦
  const [match, setMatch] = useState({});       // my Vibe Match with each buddy (the server's)       // the privacy switch: may new people write to me
  useSheetBack(open ? () => setOpen(null) : mt ? () => setMt(false) : onClose);
  useEffect(() => {
    myPassport().then((p) => p && p.ok && setDmOn(p.dm_open !== false));
    const close = () => onClose && onClose();
    try { window.addEventListener('mm-close-buddies', close); } catch (e) {}
    return () => { try { window.removeEventListener('mm-close-buddies', close); } catch (e) {} };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = () => {
    myBuddies().then((x) => {
      setList(x || []);
      vibeMatches((x || []).map((b) => b.id)).then((m) => m && setMatch(m));
      premiumOf((x || []).map((b) => b.id)).then((p) => setPrem((q) => ({ ...q, ...p })));
    });
    myConversations().then((x) => setConvs(x || []));
    myChats().then((x) => {
      const all = x || [];
      setSparks(all.filter((c) => c.spark && !c.buddy));
      premiumOf(all.map((c) => c.other && c.other.id)).then((p) => setPrem((q) => ({ ...q, ...p })));
    });
    passport(null).then(setPass);
  };
  useEffect(() => { load(); }, []);

  const vibes = pass && pass.vibes ? BADGES.filter(([b]) => pass.vibes[b]) : [];
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={() => (open ? setOpen(null) : mt ? setMt(false) : onClose())}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {open ? <Chat other={open.other} threadId={open.threadId} lang={lang} onBack={() => { setOpen(null); load(); }} /> : mt ? (
          <MidnightTable lang={lang} onBack={() => { setMt(false); load(); }} onChat={(o) => setOpen({ other: o })} />
        ) : (
          <>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }}>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
                <Ionicons name="chevron-down" size={26} color={C.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}>
              <Text style={{ color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: lang === 'ar' ? 0 : -0.7 }}>{mw(lang, 'chats')}</Text>
              <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{w(lang, 'sub')}</Text>

              {/* the Midnight Table: paused for the final MVP (chat is earned at a table or a Circle) — ?midnight brings it back to look at */}
              {MIDNIGHT ? <Pressable onPress={() => { tapLight(); setMt(true); }} accessibilityRole="button" style={{ marginTop: 16 }}>
                {({ pressed }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 18, backgroundColor: pressed ? C.glassHi : C.glass, borderWidth: 1, borderColor: C.text }}>
                    <Text style={{ color: C.text, fontSize: 22, marginEnd: 14 }}>✦</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{mw(lang, 'title')}</Text>
                      <Text style={{ color: C.dim, fontSize: 13, lineHeight: 18, marginTop: 3 }} numberOfLines={2}>{mw(lang, 'sub')}</Text>
                    </View>
                    <Ionicons name={lang === 'ar' ? 'chevron-back' : 'chevron-forward'} size={18} color={C.dim} />
                  </View>
                )}
              </Pressable> : null}

              {sparks.length ? (
                <View style={{ marginTop: 20 }}>
                  <Text style={{ color: C.dim, fontSize: 12, fontWeight: '600', letterSpacing: lang === 'ar' ? 0 : 0.4 }}>{mw(lang, 'mutual').toUpperCase()}</Text>
                  {sparks.map((c) => <Row key={c.thread_id} person={c.other} premium={prem[c.other.id]} last={c.last} onPress={() => { tapLight(); setOpen({ threadId: c.thread_id }); }} />)}
                </View>
              ) : null}

              {/* who may start a conversation with me */}
              {dmOn != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, marginTop: 16, backgroundColor: C.glass, borderWidth: 1, borderColor: C.line }}>
                  <View style={{ flex: 1, marginEnd: 12 }}>
                    <Text style={{ color: C.text, fontSize: 15.5, fontWeight: '600' }}>{pw(lang, 'dm_open')}</Text>
                    <Text style={{ color: C.dim, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{pw(lang, 'dm_open_s')}</Text>
                  </View>
                  <Switch value={dmOn} accessibilityLabel={pw(lang, 'dm_open')} trackColor={{ false: C.glassHi, true: C.text }} activeThumbColor={C.bg} thumbColor={C.text}
                    onValueChange={async (v) => { setDmOn(v); const r = await setDmOpen(v); if (!(r && r.ok)) setDmOn(!v); }} />
                </View>
              ) : null}

              {/* the passport: what you earned at the tables */}
              {pass ? (
                <View style={{ marginTop: 20, borderRadius: 24, padding: 20, backgroundColor: C.purple }}>
                  <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>{w(lang, 'pass').toUpperCase()}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                    <Text style={[{ color: '#FFF', fontSize: 34, fontWeight: '700', letterSpacing: -0.8 }, NUM]}>{String(pass.buddies || 0)}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600', marginStart: 8 }}>{w(lang, 'title')}</Text>
                  </View>
                  {vibes.length ? (
                    <>
                      <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12.5, marginTop: 12 }}>{w(lang, 'vibes')}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                        {vibes.map(([b, e]) => (
                          <View key={b} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.16)', marginEnd: 6, marginBottom: 6 }}>
                            <Text style={[{ color: '#FFF', fontSize: 12.5 }, NUM]}>{e + ' ' + badgeName(lang, b) + ' · ' + pass.vibes[b]}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                  {pass.capsules && pass.capsules.length ? (
                    <Text style={[{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 10 }, NUM]}>{w(lang, 'mem') + ' · ' + pass.capsules.length}</Text>
                  ) : null}
                </View>
              ) : null}

              {list == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 24 }} /> : !list.length ? (
                <Text style={{ color: C.dim, fontSize: 14.5, lineHeight: 21, marginTop: 24 }}>{w(lang, 'empty')}</Text>
              ) : (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ color: C.dim, fontSize: 12, fontWeight: '600', letterSpacing: lang === 'ar' ? 0 : 0.4 }}>{w(lang, 'title').toUpperCase()}</Text>
                  {list.map((b) => <Row key={b.id} person={b} premium={prem[b.id]} match={match[b.id]} lang={lang} last={b.last ? b.last.body : null} onPress={() => { tapLight(); setOpen({ other: b }); }} />)}
                </View>
              )}

              {convs.length ? (
                <View style={{ marginTop: 20 }}>
                  <Text style={{ color: C.dim, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>{w(lang, 'partners').toUpperCase()}</Text>
                  {convs.map((c) => <Row key={c.thread_id} person={c.other} premium={c.other && prem[c.other.id]} last={c.last ? c.last.body : null} onPress={() => { tapLight(); setOpen({ threadId: c.thread_id }); }} />)}
                </View>
              ) : null}

              {pass && pass.capsules && pass.capsules.length ? (
                <View style={{ marginTop: 20 }}>
                  <Text style={{ color: C.dim, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>{w(lang, 'mem').toUpperCase()}</Text>
                  {pass.capsules.slice(0, 12).map((c) => (
                    <View key={c.kind + c.id} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
                      <Text style={{ color: C.text, fontSize: 15, flex: 1 }} numberOfLines={1}>{titleFor(c.title, lang)}</Text>
                      <Text style={[{ color: C.dim, fontSize: 13 }, NUM]}>{new Date(c.starts_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : lang, { day: 'numeric', month: 'short' })}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
};

