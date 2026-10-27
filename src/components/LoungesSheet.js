import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, NUM } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { DECK, cardText } from '../constants/activityDeck';
import { loungesList, loungeJoin, loungeLeave, loungeRoom, loungeSay, dmOpen, needPlus } from '../services/live';
import { joinMesh } from '../lib/talkMesh';
import { Face } from '../ui/Face';
import { tapLight, tapMedium, tapSuccess } from '../utils/feedback';
import { useSheetBack } from '../hooks/useSheetBack';
import { MatchBadge } from '../ui/MatchBadge';
import { loungeSignals } from '../services/scale';

/* ─── LIVE LANGUAGE & CULTURE LOUNGES ─────────────────────────────────
   Always open, from home: topic rooms to practise speaking before you
   meet at the weekend café — English Casual Practice, Travel & Visas,
   Spanish and German for beginners, Culture Exchange. Voice runs on the
   same Cloudflare-relayed audio as the workshop rooms (a mesh: ten
   people a room); text is short and fades after six hours. Everybody
   sees which lounges are live and how many are in (Preview Mode);
   going in is Moments Black. Language practice and culture, nothing
   else. The doors are the server's (RUN_ME.sql, "LIVE ACTIVITIES"). */

const S = {
  en: ['Live Language Lounges', 'Drop in any time to practise speaking before the weekend.', '{n} in now', 'Full right now — try again in a minute.', 'Join the voice', 'Mute', 'Unmute', 'Leave', 'Say something…', 'In the room', 'Start with an icebreaker', 'Pick a card, add your line, send.', 'Send', 'Sent — they can answer from their Buddies page.', 'Allow the microphone to talk.', 'It did not go through. Try again.', 'Moments Black'],
  ar: ['غرف اللغات المباشرة', 'ادخل في أي وقت واتمرّن تتكلم قبل الويك إند.', '{n} جوه دلوقتي', 'مليانة دلوقتي — جرّب كمان دقيقة.', 'ادخل الصوت', 'كتم', 'فك الكتم', 'اخرج', 'قول حاجة…', 'في الغرفة', 'ابدأ بكارت تعارف', 'اختار كارت، زوّد جملتك، وابعت.', 'ابعت', 'اتبعتت — يقدروا يردّوا من صفحة الـBuddies.', 'اسمح للمايك عشان تتكلم.', 'ماتبعتش. جرّب تاني.', 'Moments Black'],
  cs: ['Živé jazykové lounge', 'Zastav se kdykoli a procvič mluvení před víkendem.', 'Teď uvnitř: {n}', 'Teď plno — zkus to za minutu.', 'Připojit hlas', 'Ztlumit', 'Zapnout zvuk', 'Odejít', 'Řekni něco…', 'V místnosti', 'Začni kartou', 'Vyber kartu, přidej větu, pošli.', 'Poslat', 'Odesláno — odpovědět mohou ze stránky Buddies.', 'Povol mikrofon, ať můžeš mluvit.', 'Nepodařilo se. Zkus to znovu.', 'Moments Black'],
  es: ['Salas de idiomas en vivo', 'Entra cuando quieras para practicar antes del finde.', '{n} dentro ahora', 'Llena ahora: prueba en un minuto.', 'Unirme a la voz', 'Silenciar', 'Activar', 'Salir', 'Di algo…', 'En la sala', 'Empieza con una carta', 'Elige una carta, añade tu frase y envía.', 'Enviar', 'Enviado: pueden responder desde su página de Buddies.', 'Permite el micrófono para hablar.', 'No se envió. Inténtalo de nuevo.', 'Moments Black'],
  et: ['Keelelounge’id otse', 'Astu sisse millal tahes ja harjuta rääkimist enne nädalavahetust.', 'Praegu sees {n}', 'Praegu täis — proovi minuti pärast.', 'Liitu häälega', 'Vaigista', 'Heli sisse', 'Lahku', 'Ütle midagi…', 'Ruumis', 'Alusta kaardiga', 'Vali kaart, lisa oma lause, saada.', 'Saada', 'Saadetud — nad saavad vastata Buddies lehelt.', 'Luba mikrofon, et rääkida.', 'Ei läinud läbi. Proovi uuesti.', 'Moments Black'],
  fr: ['Salons de langues en direct', 'Passe quand tu veux pour pratiquer avant le week-end.', '{n} dedans', 'Complet pour l’instant — réessaie dans une minute.', 'Rejoindre la voix', 'Couper', 'Réactiver', 'Quitter', 'Dis quelque chose…', 'Dans le salon', 'Commencer par une carte', 'Choisis une carte, ajoute ta phrase, envoie.', 'Envoyer', 'Envoyé — on peut te répondre depuis la page Buddies.', 'Autorise le micro pour parler.', 'Ça n’est pas passé. Réessaie.', 'Moments Black'],
  hi: ['लाइव लैंग्वेज लाउंज', 'वीकेंड से पहले बोलने की प्रैक्टिस के लिए कभी भी आओ।', 'अभी {n} अंदर', 'अभी भरा है — एक मिनट में फिर कोशिश करो।', 'आवाज़ में जुड़ो', 'म्यूट', 'अनम्यूट', 'निकलो', 'कुछ कहो…', 'रूम में', 'आइसब्रेकर से शुरू करो', 'एक कार्ड चुनो, अपनी लाइन जोड़ो, भेजो।', 'भेजो', 'भेज दिया — वे बडीज़ पेज से जवाब दे सकते हैं।', 'बोलने के लिए माइक की अनुमति दो।', 'नहीं गया। फिर कोशिश करो।', 'Moments Black'],
  it: ['Lounge di lingue dal vivo', 'Entra quando vuoi per fare pratica prima del weekend.', '{n} dentro ora', 'Pieno ora: riprova tra un minuto.', 'Entra in voce', 'Muto', 'Riattiva', 'Esci', 'Di’ qualcosa…', 'Nella stanza', 'Inizia con una carta', 'Scegli una carta, aggiungi la tua frase, invia.', 'Invia', 'Inviato: possono rispondere dalla pagina Buddies.', 'Consenti il microfono per parlare.', 'Non è andato. Riprova.', 'Moments Black'],
  ja: ['ライブ語学ラウンジ', '週末の前に、いつでも話す練習をしに来てね。', '今{n}人', '今は満員です。1分後にもう一度。', '音声に参加', 'ミュート', 'ミュート解除', '退出', 'ひとこと…', 'ルームにいる人', 'カードで話しかける', 'カードを選んでひとこと添えて送信。', '送信', '送りました。相手は Buddies ページから返信できます。', '話すにはマイクを許可してください。', '送れませんでした。もう一度どうぞ。', 'Moments Black'],
  ko: ['라이브 언어 라운지', '주말 전에 언제든 들어와서 말하기를 연습하세요.', '지금 {n}명', '지금은 가득 찼어요 — 잠시 후 다시.', '음성 참여', '음소거', '음소거 해제', '나가기', '한마디…', '방에 있는 사람', '아이스브레이커로 시작', '카드를 고르고 한 줄 더해서 보내세요.', '보내기', '보냈어요 — 상대는 버디 페이지에서 답할 수 있어요.', '말하려면 마이크를 허용해 주세요.', '전송되지 않았어요. 다시 해 주세요.', 'Moments Black'],
  nl: ['Live taallounges', 'Kom wanneer je wilt binnen om te oefenen voor het weekend.', '{n} nu binnen', 'Nu vol — probeer het over een minuut.', 'Meedoen met spraak', 'Dempen', 'Geluid aan', 'Verlaten', 'Zeg iets…', 'In de ruimte', 'Begin met een kaart', 'Kies een kaart, voeg je zin toe, stuur.', 'Sturen', 'Verstuurd — ze kunnen antwoorden via hun Buddies-pagina.', 'Sta de microfoon toe om te praten.', 'Het lukte niet. Probeer opnieuw.', 'Moments Black'],
  pt: ['Salas de línguas ao vivo', 'Entra quando quiseres para praticar antes do fim de semana.', '{n} lá dentro', 'Cheia agora — tenta daqui a um minuto.', 'Entrar na voz', 'Silenciar', 'Ativar som', 'Sair', 'Diz alguma coisa…', 'Na sala', 'Começa com uma carta', 'Escolhe uma carta, junta a tua frase, envia.', 'Enviar', 'Enviado — podem responder na página Buddies.', 'Permite o microfone para falar.', 'Não foi. Tenta outra vez.', 'Moments Black'],
  ro: ['Lounge-uri de limbi live', 'Intră oricând să exersezi vorbitul înainte de weekend.', '{n} înăuntru acum', 'Plin acum — încearcă peste un minut.', 'Intră pe voce', 'Mut', 'Pornește sunetul', 'Ieși', 'Spune ceva…', 'În cameră', 'Începe cu o carte', 'Alege o carte, adaugă-ți fraza, trimite.', 'Trimite', 'Trimis — pot răspunde din pagina Buddies.', 'Permite microfonul ca să vorbești.', 'Nu a mers. Încearcă din nou.', 'Moments Black'],
  ru: ['Языковые лаунджи вживую', 'Заходи когда угодно, чтобы потренировать речь перед выходными.', 'Сейчас внутри: {n}', 'Сейчас полно — попробуй через минуту.', 'Войти в голос', 'Выкл. звук', 'Вкл. звук', 'Выйти', 'Скажи что-нибудь…', 'В комнате', 'Начни с карточки', 'Выбери карточку, добавь фразу, отправь.', 'Отправить', 'Отправлено — ответить можно со страницы Buddies.', 'Разреши микрофон, чтобы говорить.', 'Не отправилось. Попробуй ещё раз.', 'Moments Black'],
  tr: ['Canlı dil salonları', 'Hafta sonundan önce konuşma pratiği için istediğin zaman uğra.', 'Şu an {n} kişi', 'Şu an dolu — bir dakika sonra dene.', 'Sese katıl', 'Sessize al', 'Sesi aç', 'Çık', 'Bir şey söyle…', 'Odada', 'Bir kartla başla', 'Bir kart seç, cümleni ekle, gönder.', 'Gönder', 'Gönderildi — Buddies sayfasından yanıtlayabilirler.', 'Konuşmak için mikrofona izin ver.', 'Gitmedi. Tekrar dene.', 'Moments Black'],
  uk: ['Мовні лаунжі наживо', 'Заходь будь-коли, щоб потренувати мовлення перед вихідними.', 'Зараз усередині: {n}', 'Зараз повно — спробуй за хвилину.', 'Увійти в голос', 'Вимкн. звук', 'Увімкн. звук', 'Вийти', 'Скажи щось…', 'У кімнаті', 'Почни з картки', 'Обери картку, додай фразу, надішли.', 'Надіслати', 'Надіслано — відповісти можна зі сторінки Buddies.', 'Дозволь мікрофон, щоб говорити.', 'Не вийшло. Спробуй ще раз.', 'Moments Black'],
  zh: ['实时语言休息室', '周末见面前，随时进来练练口语。', '现在 {n} 人', '现在满了——一分钟后再试。', '加入语音', '静音', '取消静音', '离开', '说点什么…', '房间里', '用一张破冰卡开始', '选一张卡，加一句话，发送。', '发送', '已发送——对方可以在 Buddies 页面回复。', '允许使用麦克风才能说话。', '没有成功，再试一次。', 'Moments Black'],
};
const K = ['title', 'sub', 'live', 'full', 'voice', 'mute', 'unmute', 'leave', 'say', 'here', 'ice', 'iceSub', 'send', 'sent', 'mic', 'err', 'plus'];
const w = (lang, k, v) => {
  const i = K.indexOf(k);
  let s = (S[lang] || S.en)[i] || S.en[i] || '';
  Object.keys(v || {}).forEach((x) => { s = s.replace('{' + x + '}', String(v[x])); });
  return s;
};
const title = (l, lang) => (lang === 'ar' && l.title_ar ? l.title_ar : l.title);

/* prompt-first: the first line to somebody new comes with an icebreaker card */
const Icebreaker = ({ person, lang, onDone }) => {
  const [cards] = useState(() => { const all = DECK.warm.map((c, i) => i); const out = []; while (out.length < 3) { const i = all.splice(Math.floor(Math.random() * all.length), 1)[0]; out.push(i); } return out; });
  const [pick, setPick] = useState(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState(null);
  const send = async () => {
    if (pick == null) return;
    tapMedium();
    const body = (cardText(DECK.warm[pick], lang) + (draft.trim() ? '\n' + draft.trim() : '')).slice(0, 500);
    const r = await dmOpen({ to: person.id, card: pick, body });
    if (r && r.ok) { tapSuccess(); setNote(w(lang, 'sent')); setTimeout(onDone, 1400); } else if (!(r && r.reason === 'plus')) setNote(w(lang, 'err'));
  };
  return (
    <View style={{ marginTop: 12, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 16 }}>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: '600' }}>{w(lang, 'ice') + ' · ' + person.name}</Text>
      <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }}>{w(lang, 'iceSub')}</Text>
      {cards.map((i) => (
        <Pressable key={i} onPress={() => { tapLight(); setPick(i); }} accessibilityRole="radio" accessibilityState={{ selected: pick === i }} style={{ marginTop: 8 }}>
          <View style={{ borderRadius: 14, padding: 12, backgroundColor: pick === i ? C.purple : C.bg, borderWidth: 1, borderColor: pick === i ? C.purple : C.line }}>
            <Text style={{ color: pick === i ? '#FFF' : C.text, fontSize: 14.5 }}>{cardText(DECK.warm[i], lang)}</Text>
          </View>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder={w(lang, 'say')} placeholderTextColor={C.faint} maxLength={300}
          style={{ flex: 1, color: C.text, fontSize: 14.5, borderWidth: 1, borderColor: C.line, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: C.bg, textAlign: lang === 'ar' ? 'right' : 'left' }} />
        <Pressable onPress={send} accessibilityRole="button" style={{ marginStart: 8, opacity: pick == null ? 0.5 : 1 }}>
          <View style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.purple }}>
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '600' }}>{w(lang, 'send')}</Text>
          </View>
        </Pressable>
      </View>
      {note ? <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{note}</Text> : null}
    </View>
  );
};

/* alone in the room: say so, and that it is live */
const FIRST = { en: 'You’re the first one here. Stay — the room lights up the moment someone walks in.', ar: 'انت أول واحد هنا. خليك — الأوضة هتنوّر أول ما حد يدخل.',
  cs: 'Jsi tu první. Zůstaň — místnost ožije, jakmile někdo přijde.', es: 'Eres el primero aquí. Quédate: la sala se enciende en cuanto entra alguien.', et: 'Sa oled siin esimene. Jää — ruum ärkab kohe, kui keegi sisse astub.',
  fr: 'Tu es le premier ici. Reste — la salle s’allume dès que quelqu’un entre.', hi: 'आप यहाँ पहले हैं। रुकिए — कोई आते ही कमरा जगमगा उठेगा।', it: 'Sei il primo qui. Resta: la stanza si accende appena entra qualcuno.',
  ja: 'あなたが最初です。そのまま待って — 誰かが入るとすぐにルームが動き出します。', ko: '당신이 첫 번째예요. 기다려 주세요 — 누군가 들어오면 바로 방이 살아나요.', nl: 'Je bent hier de eerste. Blijf — de ruimte gaat aan zodra iemand binnenkomt.',
  pt: 'És o primeiro aqui. Fica — a sala acende assim que alguém entrar.', ro: 'Ești primul aici. Rămâi — camera se aprinde imediat ce intră cineva.', ru: 'Ты здесь первый. Останься — комната оживёт, как только кто-то зайдёт.',
  tr: 'Burada ilk sensin. Kal — biri girdiği anda oda canlanır.', uk: 'Ти тут перший. Залишайся — кімната оживе, щойно хтось зайде.', zh: '你是第一个来的。留下吧 — 有人进来，房间就会亮起来。' };
const Lounge = ({ lounge, lang, onOut }) => {
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [draft, setDraft] = useState('');
  const [voice, setVoice] = useState(false);
  const [muted, setMuted] = useState(false);
  const [err, setErr] = useState(null);
  const [ice, setIce] = useState(null);
  const mesh = useRef(null);
  const scroll = useRef(null);

  useEffect(() => {
    let alive = true;
    const beat = async () => {
      const r = await loungeJoin(lounge.id);
      if (!alive) return;
      if (!r || r.ok === false) { onOut(r && r.reason); return; }
      setRoom(r);
    };
    beat();
    const hb = setInterval(beat, 15000);                                  // "still here"
    const rd = setInterval(() => loungeRoom(lounge.id).then((r) => alive && r && setRoom(r)), 4000);
    return () => { alive = false; clearInterval(hb); clearInterval(rd); if (mesh.current) { mesh.current.close(); mesh.current = null; } loungeLeave(lounge.id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const talk = async () => {
    tapMedium(); setErr(null);
    const m = await joinMesh({ topic: 'lounge:' + lounge.id, me: { id: user.id, name: '' }, onPeople: () => {}, onError: (why) => setErr(why === 'mic' ? w(lang, 'mic') : w(lang, 'err')) });
    if (m) { mesh.current = m; setVoice(true); }
  };
  const say = async () => {
    const body = draft.trim();
    if (!body) return;
    tapLight(); setDraft('');
    const r = await loungeSay(lounge.id, body);
    if (r && r.ok) loungeRoom(lounge.id).then((x) => x && setRoom(x)); else { setDraft(body); setErr(w(lang, 'err')); }
  };

  if (!room) return <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />;
  /* Keynote, not a form: one stage, centred — the flag, the name, who is
     in, and one round button for the voice. */
  const alone = room.people.length <= 1;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current && scroll.current.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingTop: 8 }}>
        <View style={{ alignItems: 'center', paddingTop: 12 }}>
          <Text style={{ fontSize: 56 }}>{lounge.emoji}</Text>
          <Text style={{ color: C.text, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 10, textAlign: 'center' }}>{title(lounge, lang)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginEnd: 7 }} />
            <Text style={[{ color: C.dim, fontSize: 14.5 }, NUM]}>{w(lang, 'live', { n: room.people.length })}</Text>
          </View>

          {/* who is in: faces on the stage */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 26 }}>
            {room.people.map((p) => (
              <Pressable key={p.id} onPress={() => (p.id === user.id || p.buddy ? null : (tapLight(), setIce(p)))} accessibilityRole="button" style={{ alignItems: 'center', width: 84, marginHorizontal: 6, marginBottom: 14 }}>
                <View style={{ borderRadius: 40, borderWidth: 2.5, borderColor: voice && p.id === user.id ? C.purple : 'transparent', padding: 3 }}>
                  <Face uri={p.avatar_url} name={p.name} size={66} />
                </View>
                <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '600', marginTop: 6 }} numberOfLines={1}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          {alone ? <Text style={{ color: C.dim, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320, marginTop: 2 }}>{FIRST[lang] || FIRST.en}</Text> : null}

          {/* the voice: one round button; inside, mute and leave */}
          {voice ? (
            <View style={{ flexDirection: 'row', marginTop: 26 }}>
              <Pressable onPress={() => { tapLight(); const m = !muted; setMuted(m); if (mesh.current) mesh.current.setMuted(m); }} accessibilityRole="button" accessibilityLabel={w(lang, muted ? 'unmute' : 'mute')} style={{ alignItems: 'center', marginHorizontal: 18 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: muted ? C.glassHi : C.purple }}>
                  <Ionicons name={muted ? 'mic-off' : 'mic'} size={30} color={muted ? C.text : '#FFF'} />
                </View>
                <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{w(lang, muted ? 'unmute' : 'mute')}</Text>
              </Pressable>
              <Pressable onPress={() => { tapLight(); if (mesh.current) { mesh.current.close(); mesh.current = null; } setVoice(false); }} accessibilityRole="button" accessibilityLabel={w(lang, 'leave')} style={{ alignItems: 'center', marginHorizontal: 18 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444' }}>
                  <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </View>
                <Text style={{ color: C.dim, fontSize: 13, marginTop: 8 }}>{w(lang, 'leave')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={talk} accessibilityRole="button" accessibilityLabel={w(lang, 'voice')} style={{ alignItems: 'center', marginTop: 26 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: C.purple }}>
                <Ionicons name="mic" size={36} color="#FFF" />
              </View>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', marginTop: 10 }}>{w(lang, 'voice')}</Text>
            </Pressable>
          )}
        </View>
        {ice ? <Icebreaker person={ice} lang={lang} onDone={() => setIce(null)} /> : null}

        <View style={{ marginTop: 16 }}>
          {room.messages.map((m) => {
            const mine = m.user_id === user.id;
            return (
              <View key={m.id} style={{ marginTop: 6, alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '84%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: mine ? C.purple : C.glass, borderWidth: mine ? 0 : 1, borderColor: C.line }}>
                {!mine ? <Text style={{ color: C.faint, fontSize: 11.5, fontWeight: '600' }}>{m.name}</Text> : null}
                <Text style={{ color: mine ? '#FFF' : C.text, fontSize: 14.5 }}>{m.body}</Text>
              </View>
            );
          })}
        </View>
        {err ? <Text style={{ color: C.coral, fontSize: 13, marginTop: 10 }}>{err}</Text> : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, borderColor: C.line }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder={w(lang, 'say')} placeholderTextColor={C.faint} maxLength={300} onSubmitEditing={say}
          style={{ flex: 1, color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.line, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.glass, textAlign: lang === 'ar' ? 'right' : 'left' }} />
        <Pressable onPress={say} accessibilityRole="button" accessibilityLabel="send" style={{ marginStart: 8 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-up" size={20} color="#FFF" />
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export const LoungesSheet = ({ onClose }) => {
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState(null);
  const [inside, setInside] = useState(null);
  const [note, setNote] = useState(null);
  useSheetBack(inside ? () => setInside(null) : onClose);

  const [sig, setSig] = useState({});   // per lounge: my Vibe Match, and the flags of who is in it now
  const load = () => { loungesList().then((x) => setList(x || { lounges: [] })); loungeSignals().then((x) => x && setSig(x)); };
  useEffect(() => { load(); const h = setInterval(load, 20000); return () => clearInterval(h); }, []);
  const go = (l) => {
    tapMedium(); setNote(null);
    if (list && !list.plus) { needPlus({ ok: false, reason: 'plus' }, 'lounge'); return; }
    setInside(l);
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={() => (inside ? setInside(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => (inside ? setInside(null) : onClose())} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
            {inside ? <Ionicons name="chevron-back" size={26} color={C.text} /> : <Ionicons name="chevron-down" size={26} color={C.text} />}
          </Pressable>
        </View>
        {inside ? <Lounge lounge={inside} lang={lang} onOut={(why) => { setInside(null); if (why === 'full') setNote(w(lang, 'full')); load(); }} /> : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 8 }}>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.7 }}>{w(lang, 'title')}</Text>
            <Text style={{ color: C.dim, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{w(lang, 'sub')}</Text>
            {note ? <Text style={{ color: C.gold, fontSize: 13.5, marginTop: 10 }}>{note}</Text> : null}
            {list == null ? <ActivityIndicator color={C.purple} style={{ marginTop: 24 }} /> : (list.lounges || []).map((l) => (
              <Pressable key={l.id} onPress={() => go(l)} accessibilityRole="button" style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.glass, padding: 18 }}>
                  <Text style={{ fontSize: 28, marginEnd: 14 }}>{l.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 16.5, fontWeight: '600' }}>{title(l, lang)}</Text>
                    <Text style={{ color: C.dim, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{lang === 'ar' && l.about_ar ? l.about_ar : l.about}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: l.live ? C.green : C.line, marginEnd: 6 }} />
                      <Text style={[{ color: l.live ? C.green : C.faint, fontSize: 12.5, fontWeight: '600' }, NUM]}>{w(lang, 'live', { n: l.live })}</Text>
                      {/* one room for every country: the flags of who is in it right now */}
                      {sig[l.id] && sig[l.id].flags && sig[l.id].flags.length ? <Text style={{ fontSize: 12.5, marginStart: 6, letterSpacing: 1 }}>{sig[l.id].flags.slice(0, 6).join('')}</Text> : null}
                    </View>
                    <MatchBadge score={sig[l.id] && sig[l.id].match} lang={lang} style={{ marginTop: 7 }} />
                  </View>
                  {!list.plus ? <Text style={{ color: C.purple, fontSize: 12, fontWeight: '700' }}>{'🔒 ' + w(lang, 'plus')}</Text> : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};
